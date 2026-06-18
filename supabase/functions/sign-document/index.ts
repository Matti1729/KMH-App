// supabase/functions/sign-document/index.ts
// Fügt die hinterlegte Signatur eines Beraters in ein PDF aus finance_documents ein.
// Position: unten rechts auf der letzten Seite. Original-PDF bleibt unverändert,
// das signierte PDF landet als separate Datei unter documents/signed/<uuid>.pdf.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      throw new Error("Missing env");
    }

    // Auth via User-JWT
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const advisorId = userData.user.id;

    // page ist 1-basiert; x_pt/y_pt vom bottom-left origin (pdf-lib-Konvention).
    // width_pt + height_pt liefern die exakte Größe wie im Modal angezeigt;
    // ohne diese Angaben Fallback: letzte Seite, unten rechts (Padding 50pt, Breite 140pt).
    const { document_id, page, x_pt, y_pt, width_pt, height_pt } = await req.json();
    if (!document_id) {
      return new Response(JSON.stringify({ error: "document_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Dokument laden (inkl. alter signed_path für Cleanup beim Re-Sign)
    const { data: doc, error: docErr } = await sb
      .from("finance_documents")
      .select("id, storage_path, filename, signed, signed_path")
      .eq("id", document_id)
      .single();
    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: "Dokument nicht gefunden" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Signatur des Beraters laden
    const { data: sig, error: sigErr } = await sb
      .from("advisor_signatures")
      .select("storage_path")
      .eq("advisor_id", advisorId)
      .maybeSingle();
    if (sigErr || !sig?.storage_path) {
      return new Response(JSON.stringify({ error: "Keine Signatur hinterlegt. Bitte zuerst im Profil eine Signatur hochladen." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PDF + Signatur-PNG aus Storage laden — Fehler je Datei separat melden,
    // damit der Client weiß, ob das Original-PDF oder die Signatur fehlt.
    const pdfRes = await sb.storage.from("documents").download(doc.storage_path);
    if (pdfRes.error || !pdfRes.data) {
      return new Response(JSON.stringify({
        error: `Original-PDF nicht in Storage gefunden (Pfad: ${doc.storage_path}). Bitte das Dokument löschen und neu hochladen.`,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const pngRes = await sb.storage.from("documents").download(sig.storage_path);
    if (pngRes.error || !pngRes.data) {
      return new Response(JSON.stringify({
        error: `Signatur nicht in Storage gefunden (Pfad: ${sig.storage_path}). Bitte die Signatur im Profil neu hochladen.`,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pdfBytes = new Uint8Array(await pdfRes.data.arrayBuffer());
    const sigBytes = new Uint8Array(await pngRes.data.arrayBuffer());

    // pdf-lib: PNG einbetten und an gewünschter Position platzieren.
    // Falls die Signatur als JPEG abgelegt wurde (alte Uploads vor der Canvas-Konvertierung),
    // fallback auf embedJpg.
    const pdfDoc = await PDFDocument.load(pdfBytes);
    let pngImage;
    try {
      pngImage = await pdfDoc.embedPng(sigBytes);
    } catch (pngErr: any) {
      try {
        pngImage = await pdfDoc.embedJpg(sigBytes);
      } catch (jpgErr: any) {
        return new Response(JSON.stringify({
          error: `Signatur-Bild konnte nicht eingebettet werden (kein gültiges PNG oder JPG). Bitte im Profil neu hochladen.`,
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    const pages = pdfDoc.getPages();
    const imgRatio = pngImage.height / pngImage.width;

    // Vom Client gewünschte Seite (1-basiert) oder Fallback letzte Seite
    const pageIdx = typeof page === "number" && page >= 1 && page <= pages.length
      ? page - 1
      : pages.length - 1;
    const targetPage = pages[pageIdx];

    // pdf.js rendert die Seite anhand der CropBox; pdf-libs drawImage zeichnet
    // dagegen in MediaBox-Koordinaten. Wenn CropBox != MediaBox (z.B. bei
    // gescannten PDFs mit Crop) gäbe es einen konstanten X/Y-Versatz. Wir
    // arbeiten daher konsequent mit cropBox und rechnen ggf. den Offset zur
    // MediaBox dazu. Außerdem nutzen wir cropBox-Breite/Höhe fürs Clamping.
    const cropBox = targetPage.getCropBox();
    const cropW = cropBox.width;
    const cropH = cropBox.height;

    const drawWidth = typeof width_pt === "number" && width_pt > 0
      ? Math.min(width_pt, cropW)
      : Math.min(140, cropW - 100);
    // Höhe: bevorzugt vom Client (entspricht 1:1 dem Preview im Modal),
    // sonst aus Image-Aspect-Ratio. Damit landet die Signatur genau dort,
    // wo der User sie hingezogen hat.
    const drawHeight = typeof height_pt === "number" && height_pt > 0
      ? Math.min(height_pt, cropH)
      : drawWidth * imgRatio;

    let drawX: number;
    let drawY: number;
    if (typeof x_pt === "number" && typeof y_pt === "number") {
      // Client liefert bottom-left-Koordinate im CropBox-Koordinatensystem.
      // Auf MediaBox umrechnen durch Addition des CropBox-Offsets.
      const cropX = Math.max(0, Math.min(x_pt, cropW - drawWidth));
      const cropY = Math.max(0, Math.min(y_pt, cropH - drawHeight));
      drawX = cropBox.x + cropX;
      drawY = cropBox.y + cropY;
    } else {
      // Fallback: unten rechts mit 50pt Padding (relativ zur CropBox)
      drawX = cropBox.x + cropW - drawWidth - 50;
      drawY = cropBox.y + 50;
    }

    targetPage.drawImage(pngImage, {
      x: drawX,
      y: drawY,
      width: drawWidth,
      height: drawHeight,
    });

    const signedBytes = await pdfDoc.save();

    // Signiertes PDF unter eindeutigem Pfad ablegen — Supabase Storage/CDN
    // cached aggressiv, deshalb verwendet jeder Re-Sign einen frischen Dateinamen.
    const signedPath = `signed/${doc.id}_${Date.now()}.pdf`;
    const { error: upErr } = await sb.storage
      .from("documents")
      .upload(signedPath, signedBytes, {
        contentType: "application/pdf",
        upsert: false,
        cacheControl: "no-cache, no-store, max-age=0, must-revalidate",
      });
    if (upErr) {
      return new Response(JSON.stringify({ error: `Upload-Fehler: ${upErr.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Alte signierte PDF aufräumen (falls vorhanden und nicht versehentlich
    // identisch — verhindert Storage-Orphans bei wiederholtem Signieren).
    if (doc.signed_path && doc.signed_path !== signedPath) {
      await sb.storage.from("documents").remove([doc.signed_path]);
    }

    // DB-Update
    const { error: updErr } = await sb
      .from("finance_documents")
      .update({
        signed: true,
        signed_path: signedPath,
        signed_at: new Date().toISOString(),
        signed_by: advisorId,
      })
      .eq("id", doc.id);
    if (updErr) {
      return new Response(JSON.stringify({ error: `DB-Update-Fehler: ${updErr.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, signed_path: signedPath }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("sign-document error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
