// supabase/functions/extract-performance-data/index.ts
// Liest Performance-Mess-Dateien aus (CSV/Excel deterministisch, PDF/Bild per Claude)
// und gibt NORMALISIERTE Kandidaten zurück. Schreibt NICHTS in die DB — die Übernahme
// passiert erst nach Bestätigung im Client.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// Plausibilitätsbereiche je Typ (Untergrenze, Obergrenze).
const RANGES: Record<string, [number, number]> = {
  height: [120, 230], weight: [30, 150],
  sprint_10m: [1.2, 3.0], sprint_20m: [2.0, 5.0], sprint_30m: [3.0, 7.0],
  vmax: [20, 45],
  cmj: [10, 80], sj: [10, 80], dj: [10, 80], ht: [10, 80],
  dj_rsi: [0.2, 4.0], ht_rsi: [0.2, 4.0],
};

const unitFor = (type: string): string => {
  if (type.startsWith("sprint")) return "s";
  if (type === "vmax") return "km/h";
  if (type === "weight") return "kg";
  if (type === "cmj" || type === "sj" || type === "dj" || type === "ht" || type === "height") return "cm";
  return "";
};

const norm = (s: unknown): string =>
  String(s ?? "").toLowerCase()
    .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");

// Header -> bekannter Typ. RSI-Varianten zuerst (enthalten "dj"/"ht").
function matchType(header: unknown): string | null {
  const h = norm(header);
  if (!h) return null;
  const has = (...keys: string[]) => keys.some((k) => h.includes(k));
  if (has("djrsi") || (has("rsi") && has("dropjump"))) return "dj_rsi";
  if (has("htrsi") || (has("rsi") && (has("hoptest") || has("hop")))) return "ht_rsi";
  if (has("grosse", "korpergrosse", "bodyheight") || h === "height") return "height";
  if (has("gewicht", "bodyweight", "korpergewicht") || h === "weight" || h === "masse") return "weight";
  if (has("10m", "split10", "sprint10", "10meter") || h === "t10") return "sprint_10m";
  if (has("20m", "split20", "sprint20", "20meter") || h === "t20") return "sprint_20m";
  if (has("30m", "split30", "sprint30", "30meter") || h === "t30") return "sprint_30m";
  if (has("vmax", "topspeed", "hochstgeschwindigkeit", "maxspeed", "maximalgeschwindigkeit")) return "vmax";
  if (has("cmj", "countermovement")) return "cmj";
  if (has("squatjump") || h === "sj") return "sj";
  if (has("dropjump") || h === "dj") return "dj";
  if (has("hoptest") || h === "ht" || h === "hop") return "ht";
  return null;
}

const isDateHeader = (header: unknown): boolean => {
  const h = norm(header);
  return h.includes("datum") || h.includes("date") || h === "tag";
};
const isNameHeader = (header: unknown): boolean => {
  const h = norm(header);
  return ["name", "athlet", "spieler", "player", "athlete", "vorname", "nachname"].some((k) => h.includes(k));
};

function excelSerialToISO(serial: number): string | null {
  // Excel-Serien (Tage seit 1899-12-30).
  if (!isFinite(serial) || serial < 20000 || serial > 60000) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().substring(0, 10);
}

function toISO(d: Date): string | null {
  if (isNaN(d.getTime())) return null;
  return d.toISOString().substring(0, 10);
}

function parseDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return toISO(v);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/);
  if (m) { let y = m[3]; if (y.length === 2) y = "20" + y; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  if (/^\d{5}(\.\d+)?$/.test(s)) return excelSerialToISO(Number(s));
  return null;
}

// Wert deterministisch normalisieren: Komma->Punkt, ms->s, m->cm (für Größe).
function normValue(type: string, raw: unknown): { value: number; warnings: string[] } | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim().replace(/,/g, ".").replace(/[^\d.\-]/g, "");
  let v = parseFloat(s);
  if (isNaN(v)) return null;
  const warnings: string[] = [];
  if (type.startsWith("sprint") && v > 100) { v = v / 1000; warnings.push("ms→s"); }
  if (type === "height" && v > 0 && v < 3) { v = v * 100; warnings.push("m→cm"); }
  return { value: Math.round(v * 1000) / 1000, warnings };
}

interface ValueCand { type: string | null; value: number; unit: string; confidence: "high" | "low"; source: string; outOfRange: boolean; warnings: string[]; }
interface RowCand { date: string | null; label: string; values: ValueCand[]; }

const looksNumeric = (raw: unknown): boolean => {
  if (raw == null || raw === "") return false;
  const s = String(raw).trim().replace(/,/g, ".").replace(/[^\d.\-]/g, "");
  return s !== "" && !isNaN(parseFloat(s));
};

function buildFromTable(headers: unknown[], dataRows: unknown[][]): { rows: RowCand[]; unmapped: { header: string; sample: string }[] } {
  const colMap = headers.map((hd, i) => ({ i, header: String(hd ?? ""), type: matchType(hd), isDate: isDateHeader(hd), isName: isNameHeader(hd) }));
  const dateCol = colMap.find((c) => c.isDate);
  const nameCol = colMap.find((c) => c.isName);
  const valueCols = colMap.filter((c) => c.type);
  // Nicht zugeordnete Spalten mit numerischem Inhalt: pro Zeile als type=null mitschicken,
  // damit der Nutzer sie im Review manuell zuordnen kann (statt sie still zu verwerfen).
  const unmappedNumericCols = colMap.filter((c) => !c.type && !c.isDate && !c.isName && c.header.trim() && dataRows.some((r) => looksNumeric(r[c.i])));

  const unmapped: { header: string; sample: string }[] = [];
  for (const c of unmappedNumericCols) {
    const sampleRow = dataRows.find((r) => r[c.i] != null && r[c.i] !== "");
    unmapped.push({ header: c.header, sample: sampleRow ? String(sampleRow[c.i]) : "" });
  }

  const rows: RowCand[] = [];
  for (const r of dataRows) {
    if (!r || r.every((cell) => cell == null || cell === "")) continue;
    const date = dateCol ? parseDate(r[dateCol.i]) : null;
    const label = nameCol ? String(r[nameCol.i] ?? "").trim() : "";
    const values: ValueCand[] = [];
    for (const c of valueCols) {
      const nv = normValue(c.type!, r[c.i]);
      if (!nv) continue;
      const range = RANGES[c.type!];
      const outOfRange = !!range && (nv.value < range[0] || nv.value > range[1]);
      values.push({ type: c.type!, value: nv.value, unit: unitFor(c.type!), confidence: "high", source: c.header, outOfRange, warnings: nv.warnings });
    }
    for (const c of unmappedNumericCols) {
      const nv = normValue("", r[c.i]);
      if (!nv) continue;
      values.push({ type: null, value: nv.value, unit: "", confidence: "low", source: c.header, outOfRange: false, warnings: [] });
    }
    if (values.length) rows.push({ date, label, values });
  }
  return { rows, unmapped };
}

function parseCSV(text: string): { headers: string[]; dataRows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!lines.length) return { headers: [], dataRows: [] };
  const first = lines[0];
  const delim = first.includes("\t") ? "\t" : ((first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ";" : ",");
  const split = (line: string) => line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));
  return { headers: split(lines[0]), dataRows: lines.slice(1).map(split) };
}

function parseXLSX(bytes: Uint8Array): { headers: string[]; dataRows: unknown[][] } {
  const wb = XLSX.read(bytes, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" }) as unknown[][];
  if (!aoa.length) return { headers: [], dataRows: [] };
  return { headers: (aoa[0] as unknown[]).map((x) => String(x ?? "")), dataRows: aoa.slice(1) };
}

const CLAUDE_PROMPT = `Du extrahierst Leistungsdiagnostik-Messwerte aus dem beigefügten Dokument/Bild.
Antworte NUR mit validem JSON (kein Markdown), Schema:
{"rows":[{"date":"YYYY-MM-DD oder null","label":"Name falls vorhanden, sonst leer","values":[{"type":"<KEY>","value":<zahl>,"unit":"<einheit>","confidence":"high|low"}]}]}
Erlaubte type-KEYS (nur diese verwenden, sonst weglassen):
- height (Körpergröße cm), weight (Gewicht kg)
- sprint_10m, sprint_20m, sprint_30m (Sprintzeiten in Sekunden), vmax (km/h)
- cmj, sj (Sprunghöhe cm), dj (Drop Jump Höhe cm), dj_rsi (Drop Jump RSI),
  ht (Hop Test Höhe cm), ht_rsi (Hop Test RSI)
Regeln:
- Werte als reine Zahl (Punkt als Dezimaltrenner). Sprintzeiten in Sekunden (ms -> s).
- confidence "low", wenn der Wert schwer lesbar/unsicher ist.
- Wenn pro Testtag mehrere Werte vorliegen, eine row pro Datum mit allen values.
- Nichts erfinden. Unklare Felder weglassen.
JSON:`;

async function extractViaClaude(fileBase64: string, mimeType: string): Promise<{ rows: RowCand[] }> {
  const isPdf = mimeType.includes("pdf");
  const block = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } }
    : { type: "image", source: { type: "base64", media_type: mimeType || "image/jpeg", data: fileBase64 } };

  const MAX_RETRIES = 2;
  let resp: Response | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 120000);
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        messages: [{ role: "user", content: [block, { type: "text", text: CLAUDE_PROMPT }] }],
      }),
    });
    clearTimeout(t);
    if (resp.status === 429 && attempt < MAX_RETRIES - 1) {
      const retryAfter = parseInt(resp.headers.get("retry-after") || "0") || (attempt + 1) * 2;
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }
    break;
  }
  if (!resp || !resp.ok) throw new Error(`Claude API Fehler: ${resp?.status || "unbekannt"}`);
  const data = await resp.json();
  const text = data.content?.[0]?.text || "";
  const jsonStr = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
  const parsed = JSON.parse(jsonStr);
  const rawRows: any[] = Array.isArray(parsed?.rows) ? parsed.rows : [];

  // Claude-Werte ebenfalls validieren/normalisieren (Range-Flag, Einheit absichern).
  const rows: RowCand[] = [];
  for (const r of rawRows) {
    const values: ValueCand[] = [];
    for (const v of (Array.isArray(r?.values) ? r.values : [])) {
      if (!RANGES[v?.type]) continue;
      const nv = normValue(v.type, v.value);
      if (!nv) continue;
      const range = RANGES[v.type];
      const outOfRange = nv.value < range[0] || nv.value > range[1];
      values.push({ type: v.type, value: nv.value, unit: unitFor(v.type), confidence: v.confidence === "low" ? "low" : "high", source: "KI-Auslesung", outOfRange, warnings: nv.warnings });
    }
    if (values.length) rows.push({ date: parseDate(r?.date), label: String(r?.label ?? "").trim(), values });
  }
  return { rows };
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fileBase64, fileName = "", mimeType = "" } = await req.json();
    if (!fileBase64) {
      return new Response(JSON.stringify({ error: "Keine Datei übergeben." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const lowerName = String(fileName).toLowerCase();
    const mt = String(mimeType).toLowerCase();
    const isCsv = lowerName.endsWith(".csv") || mt.includes("csv");
    const isXlsx = lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || mt.includes("spreadsheet") || mt.includes("excel");
    const isPdf = lowerName.endsWith(".pdf") || mt.includes("pdf");
    const isImage = mt.startsWith("image/") || /\.(png|jpe?g|webp|heic)$/.test(lowerName);

    let result: { rows: RowCand[]; unmapped?: { header: string; sample: string }[]; warnings?: string[] };

    if (isCsv) {
      const text = new TextDecoder().decode(b64ToBytes(fileBase64));
      const { headers, dataRows } = parseCSV(text);
      result = buildFromTable(headers, dataRows);
    } else if (isXlsx) {
      const bytes = b64ToBytes(fileBase64);
      const { headers, dataRows } = parseXLSX(bytes);
      result = buildFromTable(headers, dataRows);
    } else if (isPdf || isImage) {
      if (!ANTHROPIC_API_KEY) {
        return new Response(JSON.stringify({ error: "KI-Auslesung nicht konfiguriert (ANTHROPIC_API_KEY fehlt)." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      result = await extractViaClaude(fileBase64, mt || (isPdf ? "application/pdf" : "image/jpeg"));
    } else {
      return new Response(JSON.stringify({ error: "Dateiformat nicht unterstützt. Erlaubt: CSV, Excel, PDF, Bild." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const totalValues = result.rows.reduce((n, r) => n + r.values.length, 0);
    return new Response(
      JSON.stringify({ rows: result.rows, unmapped: result.unmapped || [], warnings: result.warnings || [], meta: { rowCount: result.rows.length, valueCount: totalValues, source: isCsv ? "csv" : isXlsx ? "xlsx" : isPdf ? "pdf" : "image" } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: `Fehler beim Auslesen: ${(error as Error).message}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
