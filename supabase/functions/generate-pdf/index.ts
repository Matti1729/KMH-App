// supabase/functions/generate-pdf/index.ts
// Perfekte PDF-Generierung mit Browserless.io (Headless Chrome)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { SCOUTING_BG_DATA_URL } from "./_bg-data.ts";
import { TM_LOGO_DATA_URL } from "./_tm-logo.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// Batch-Übersetzung via Claude. Akzeptiert Array von DE-Strings, gibt
// gleichlanges Array von EN-Strings zurück. Bei Fehler oder fehlendem Key
// kommt das Original-Array zurück (Fallback ohne Crash).
async function batchTranslate(texts: string[], targetLang: 'en' = 'en'): Promise<string[]> {
  if (!texts.length || !ANTHROPIC_API_KEY) return texts;
  const systemPrompt = `You are a professional sports translator specialised in football scouting reports. Translate each input string from German to ${targetLang === 'en' ? 'English' : 'German'} accurately, preserving any technical football terminology, player attributes, and scouting jargon. Return the result as a JSON array of strings, in the same order as the input. Do not add explanations or wrap in markdown — output ONLY the raw JSON array.`;
  const userMessage = JSON.stringify(texts);
  // 20-Sekunden-Timeout — wenn Claude hängt, fällt der ganze PDF-Render nicht aus
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      const errText = await response.text();
      console.error("[translate] Claude API error:", response.status, errText.slice(0, 300));
      return texts;
    }
    const data = await response.json();
    const raw = data?.content?.[0]?.text || '';
    console.log("[translate] Claude raw response:", raw.slice(0, 500));
    // Extract JSON array (Claude wraps occasionally with markdown despite instructions)
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error("[translate] No JSON array found in response");
      return texts;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(match[0]);
    } catch (e) {
      console.error("[translate] JSON.parse failed:", e);
      return texts;
    }
    if (Array.isArray(parsed) && parsed.length === texts.length) {
      console.log(`[translate] Successfully translated ${texts.length} strings`);
      return parsed.map((s: any) => typeof s === 'string' ? s : String(s));
    }
    console.error(`[translate] Length mismatch: input=${texts.length}, output=${(parsed as any[])?.length}`);
    return texts;
  } catch (e) {
    clearTimeout(timeoutId);
    console.error("[translate] Exception:", e);
    return texts;
  }
}

// ── Helper: Club-Name-Umlaut-Normalisierung (synchron zu PlayerOverviewScreen.tsx) ──
const CLUB_UMLAUT_MAP: Array<[RegExp, string]> = [
  [/saarbrucken/gi, 'Saarbrücken'],
  [/munchen/gi, 'München'],
  [/nurnberg/gi, 'Nürnberg'],
  [/dusseldorf/gi, 'Düsseldorf'],
  [/monchengladbach/gi, 'Mönchengladbach'],
  [/furth/gi, 'Fürth'],
  [/koln\b/gi, 'Köln'],
  [/wurzburg/gi, 'Würzburg'],
  [/hombug/gi, 'Homburg'],
  [/osnabruck/gi, 'Osnabrück'],
  [/lubeck/gi, 'Lübeck'],
  [/munster/gi, 'Münster'],
  [/zurich/gi, 'Zürich'],
];

function normalizeGermanClubName(club: string | null | undefined): string {
  if (!club) return '';
  let out = club;
  for (const [regex, replacement] of CLUB_UMLAUT_MAP) out = out.replace(regex, replacement);
  return out;
}

const COUNTRY_TO_ISO: Record<string, string> = {
  'Deutschland': 'DE', 'Österreich': 'AT', 'Schweiz': 'CH', 'Frankreich': 'FR',
  'Italien': 'IT', 'Spanien': 'ES', 'Portugal': 'PT', 'Niederlande': 'NL',
  'Belgien': 'BE', 'England': 'GB', 'Polen': 'PL', 'Kroatien': 'HR',
  'Serbien': 'RS', 'Türkei': 'TR', 'Brasilien': 'BR', 'Argentinien': 'AR',
  'USA': 'US', 'Kanada': 'CA', 'Dänemark': 'DK', 'Schweden': 'SE', 'Norwegen': 'NO',
  'Finnland': 'FI', 'Island': 'IS', 'Irland': 'IE', 'Schottland': 'GB',
  'Wales': 'GB', 'Griechenland': 'GR', 'Tschechien': 'CZ', 'Slowakei': 'SK',
  'Ungarn': 'HU', 'Rumänien': 'RO', 'Bulgarien': 'BG', 'Slowenien': 'SI',
  'Bosnien und Herzegowina': 'BA', 'Bosnien-Herzegowina': 'BA', 'Montenegro': 'ME',
  'Nordmazedonien': 'MK', 'Albanien': 'AL', 'Kosovo': 'XK', 'Ukraine': 'UA',
  'Russland': 'RU', 'Japan': 'JP', 'Südkorea': 'KR', 'China': 'CN',
  'Australien': 'AU', 'Mexiko': 'MX', 'Kolumbien': 'CO', 'Chile': 'CL',
  'Peru': 'PE', 'Uruguay': 'UY', 'Paraguay': 'PY', 'Ecuador': 'EC',
  'Ghana': 'GH', 'Nigeria': 'NG', 'Kamerun': 'CM', 'Senegal': 'SN',
  'Elfenbeinküste': 'CI', 'Marokko': 'MA', 'Tunesien': 'TN', 'Ägypten': 'EG',
  'Südafrika': 'ZA', 'Israel': 'IL', 'Iran': 'IR', 'Irak': 'IQ',
  'Saudi-Arabien': 'SA', 'Vereinigte Arabische Emirate': 'AE', 'Indien': 'IN',
  'Afghanistan': 'AF', 'Algerien': 'DZ', 'Andorra': 'AD', 'Angola': 'AO',
  'Armenien': 'AM', 'Aserbaidschan': 'AZ', 'Äthiopien': 'ET', 'Costa Rica': 'CR',
  'Dominikanische Republik': 'DO', 'Estland': 'EE', 'El Salvador': 'SV',
  'Georgien': 'GE', 'Guatemala': 'GT', 'Haiti': 'HT', 'Honduras': 'HN',
  'Hongkong': 'HK', 'Indonesien': 'ID', 'Jamaika': 'JM', 'Jordanien': 'JO',
  'Kasachstan': 'KZ', 'Katar': 'QA', 'Kenia': 'KE', 'Kuba': 'CU',
  'Lettland': 'LV', 'Libanon': 'LB', 'Libyen': 'LY', 'Liechtenstein': 'LI',
  'Litauen': 'LT', 'Luxemburg': 'LU', 'Moldau': 'MD', 'Monaco': 'MC',
  'Namibia': 'NA', 'Neuseeland': 'NZ', 'Pakistan': 'PK', 'Palästina': 'PS',
  'Panama': 'PA', 'Philippinen': 'PH', 'Singapur': 'SG', 'Syrien': 'SY',
  'Taiwan': 'TW', 'Thailand': 'TH', 'Uganda': 'UG', 'Usbekistan': 'UZ',
  'Venezuela': 'VE', 'Vietnam': 'VN', 'Weißrussland': 'BY', 'Zypern': 'CY',
};

// PNG-Flaggen via flagcdn.com — einheitliches Rendering im PDF (Browserless Headless
// Chrome auf Linux rendert Unicode-Emoji-Flags anders als Apple/Chrome auf macOS,
// daher zeigt das Spielerprofil eine andere Flagge als das PDF wenn wir Emojis nutzen).
function countryToFlag(country: string): string {
  const iso = COUNTRY_TO_ISO[country];
  if (iso && iso.length === 2) {
    // flagcdn.com PNGs: aktuelle Wikipedia-Flaggen (z.B. neue Syrien-Unabhängigkeitsflagge
    // statt alter Assad-Regime-Flagge die Twemoji noch zeigt). Fixed 21×14 mit cover.
    return `<img src="https://flagcdn.com/w80/${iso.toLowerCase()}.png" width="21" height="14" style="width: 21px; height: 14px; min-width: 21px; min-height: 14px; max-width: 21px; max-height: 14px; object-fit: cover; display: inline-block; vertical-align: middle; -webkit-print-color-adjust: exact; print-color-adjust: exact;" />`;
  }
  return '';
}

function nationalityToFlags(nationality: string | null | undefined): string {
  if (!nationality) return '';
  return nationality.split(/[,\/]+/).map(n => n.trim()).filter(Boolean).map(n => countryToFlag(n)).filter(Boolean).join(' ');
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BROWSERLESS_API_KEY = Deno.env.get("BROWSERLESS_API_KEY");

interface CareerEntry {
  club: string;
  league: string;
  from_date: string;
  to_date: string;
  stats: string;
  games?: string;
  goals?: string;
  assists?: string;
  is_current: boolean;
  season_label?: string; // Freitext-Override für Saison-Anzeige (gewinnt vor Datums-Ableitung)
}

interface Player {
  first_name: string;
  last_name: string;
  photo_url: string;
  position: string;
  secondary_position: string;
  club: string;
  league: string;
  loan_from_club?: string;
  loan_from_club_league?: string;
  birth_date: string;
  nationality: string;
  height: number;
  strong_foot: string;
  contract_end: string;
  transfermarkt_url: string;
  strengths: string;
  listing: string;
  responsibility: string;
}

interface RequestBody {
  player: Player;
  careerEntries: CareerEntry[];
  playerDescription: string;
  additionalInfo?: string;
  highlightVideoUrl?: string;
  highlightVideoTitle?: string;
  advisorEmail?: string;
  advisorPhone?: string;
  clubLogoUrl?: string;
  loanFromClubLogoUrl?: string;
  lang?: 'de' | 'en';
}

// i18n: Labels für UI-Elemente im PDF (Header, Card-Titles, Stats-Wörter, etc.).
// Stand-Datum + Locale werden ebenfalls je Sprache angepasst.
const I18N: Record<'de' | 'en', Record<string, string>> = {
  de: {
    expose: 'EXPOSÉ',
    asOf: 'Stand',
    nationality: 'Nationalität',
    dateOfBirth: 'Geburtsdatum',
    contractEnd: 'Vertragsende',
    transfermarkt: 'Transfermarkt',
    playerProfile: 'Spielerprofil',
    position: 'Position',
    secondaryPosition: 'Nebenposition',
    height: 'Größe',
    foot: 'Fuß',
    careerHistory: 'Karriereverlauf der letzten Jahre',
    strengths: 'Stärken',
    additionalInfo: 'Weitere Informationen',
    watchVideo: '▶ Spielerprofil-Video ansehen',
    since: 'Seit',
    matchOne: 'Spiel',
    matchMany: 'Spiele',
    goalOne: 'Tor',
    goalMany: 'Tore',
    assistOne: 'Assist',
    assistMany: 'Assists',
    footRight: 'Rechts',
    footLeft: 'Links',
    footBoth: 'Beidfüßig',
    email: 'E-Mail',
    phone: 'Telefon',
    address: 'Adresse',
    cooperationAgency: 'Kooperationsagentur',
  },
  en: {
    expose: 'EXPOSÉ',
    asOf: 'As of',
    nationality: 'Nationality',
    dateOfBirth: 'Date of Birth',
    contractEnd: 'Contract End',
    transfermarkt: 'Transfermarkt',
    playerProfile: 'Player Profile',
    position: 'Position',
    secondaryPosition: 'Secondary Position',
    height: 'Height',
    foot: 'Foot',
    careerHistory: 'Career History (Recent Years)',
    strengths: 'Strengths',
    additionalInfo: 'Additional Information',
    watchVideo: '▶ Watch Player Profile Video',
    since: 'Since',
    matchOne: 'Match',
    matchMany: 'Matches',
    goalOne: 'Goal',
    goalMany: 'Goals',
    assistOne: 'Assist',
    assistMany: 'Assists',
    footRight: 'Right',
    footLeft: 'Left',
    footBoth: 'Both',
    email: 'Email',
    phone: 'Phone',
    address: 'Address',
    cooperationAgency: 'Partner Agency',
  },
};

// Lookup-Tabelle für gängige Stärken-/Potenziale-Begriffe (DE → EN).
// Wenn ein Begriff nicht hier gelistet ist, bleibt er beim PDF-Render in Deutsch
// (User-Input ist freitextlich; vollautomatische Übersetzung würde einen
// AI-Translate-Call pro Begriff brauchen).
const STRENGTH_TRANSLATIONS_DE_EN: Record<string, string> = {
  // Zweikampf / Duelle
  'zweikampf': 'Duelling',
  'zweikampf defensiv': 'Defensive Duels',
  'zweikampf offensiv': 'Offensive Duels',
  'zweikampfstärke': 'Duelling Strength',
  // Kopfball
  'kopfball': 'Heading',
  'kopfballstärke': 'Heading Ability',
  'defensivkopfball': 'Defensive Heading',
  'offensivkopfball': 'Offensive Heading',
  'defensiv-offensivkopfball': 'Defensive/Offensive Heading',
  // Pässe / Bälle
  'passspiel': 'Passing',
  'kurzpassspiel': 'Short Passing',
  'langer ball': 'Long Pass',
  'lange bälle': 'Long Passes',
  'diagonalball': 'Diagonal Pass',
  'diagonalbälle': 'Diagonal Passes',
  'flanken': 'Crossing',
  'einwürfe': 'Throw-Ins',
  'weite einwürfe': 'Long Throw-Ins',
  'weite einwürfe (eckenersatz)': 'Long Throw-Ins (Corner Substitute)',
  'eckenersatz': 'Corner Substitute',
  // Spielintelligenz
  'spielintelligenz': 'Game Intelligence',
  'spielverständnis': 'Game Understanding',
  'übersicht': 'Vision',
  'stellungsspiel': 'Positioning',
  'antizipation': 'Anticipation',
  // Technik
  'technik': 'Technique',
  'ballkontrolle': 'Ball Control',
  'dribbling': 'Dribbling',
  'ballbehauptung': 'Ball Retention',
  // Athletik
  'schnelligkeit': 'Speed',
  'antritt': 'Acceleration',
  'sprintkraft': 'Sprint Power',
  'ausdauer': 'Stamina',
  'kondition': 'Stamina',
  'beidfüßigkeit': 'Two-Footedness',
  'beidfüßig': 'Two-Footed',
  'athletik': 'Athleticism',
  'sprungkraft': 'Jumping Ability',
  // Offensive
  'torgefährlichkeit': 'Goal Threat',
  'abschluss': 'Finishing',
  'torabschluss': 'Finishing',
  'schusskraft': 'Shot Power',
  'schusstechnik': 'Shot Technique',
  'standardsituationen': 'Set Pieces',
  'standards': 'Set Pieces',
  'freistöße': 'Free Kicks',
  'elfmeter': 'Penalties',
  'kopfballtore': 'Headed Goals',
  // Defensive
  'tackling': 'Tackling',
  'ballrückeroberung': 'Ball Recovery',
  'abwehrverhalten': 'Defending',
  'pressing': 'Pressing',
  'gegenpressing': 'Counter-Pressing',
  // Mentalität
  'mentalität': 'Mentality',
  'führungsspieler': 'Leadership',
  'führungsstärke': 'Leadership',
  'führungsstärke (character)': 'Leadership (Character)',
  'führungsstärke (charakter)': 'Leadership (Character)',
  'kommunikation': 'Communication',
  'einsatzbereitschaft': 'Work Rate',
  'laufbereitschaft': 'Work Rate',
  'aggressivität': 'Aggression',
  'charakter': 'Character',
  'professionalität': 'Professionalism',
  // Spielaufbau / Defensiv-Verhalten
  'aufbauspiel': 'Build-up Play',
  'aufbau': 'Build-up',
  'spielaufbau': 'Build-up Play',
  'spieleröffnung': 'Build-up',
  'nach vorne verteidigen': 'Forward Defending',
  'nach vorn verteidigen': 'Forward Defending',
  'verteidigen nach vorne': 'Forward Defending',
  'tiefenstaffelung': 'Defensive Depth',
  'raumdeckung': 'Zonal Marking',
  'manndeckung': 'Man Marking',
  'umschaltspiel': 'Transition',
  'umschaltverhalten': 'Transition',
  'spielverlagerung': 'Switch of Play',
  'spielverlagerungen': 'Switches of Play',
};
// Stärken-Übersetzung: erst Exact-Match (ganzer Begriff), dann Substring-Replace
// für Items, die mehrere Begriffe in einer Zeile vereinen (z.B. "weite Einwürfe
// (Eckenersatz) Torgefährlichkeit"). Längste Keys zuerst, damit verschachtelte
// Begriffe nicht durcheinander geraten.
const SORTED_STRENGTH_KEYS = Object.keys(STRENGTH_TRANSLATIONS_DE_EN).sort((a, b) => b.length - a.length);
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function translateStrength(raw: string, lang: 'de' | 'en'): string {
  if (lang !== 'en') return raw;
  const trimmed = (raw || '').trim();
  if (!trimmed) return raw;
  // 1. Exact-Match (ganzer Eintrag = ein bekannter Begriff)
  const lower = trimmed.toLowerCase();
  if (STRENGTH_TRANSLATIONS_DE_EN[lower]) return STRENGTH_TRANSLATIONS_DE_EN[lower];
  // 2. Substring-Replace: alle bekannten Begriffe sukzessive im String ersetzen
  let result = trimmed;
  for (const k of SORTED_STRENGTH_KEYS) {
    const regex = new RegExp(escapeRegex(k), 'gi');
    result = result.replace(regex, STRENGTH_TRANSLATIONS_DE_EN[k]);
  }
  return result;
}

// cm → US-Format (feet'inches"). 188 cm → "6'2\""
function cmToFeetInches(cm: number): string {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);
  // Edge-case: 11.5 inches → 12 → bumpt feet
  if (inches === 12) return `${feet + 1}'0"`;
  return `${feet}'${inches}"`;
}

// Englische Position-Bezeichnungen (Long-Form)
const POSITION_MAP_EN: Record<string, string> = {
  'TW': 'Goalkeeper',
  'IV': 'Centre-Back',
  'LV': 'Left-Back',
  'RV': 'Right-Back',
  'DM': 'Defensive Midfield',
  'ZM': 'Central Midfield',
  'OM': 'Attacking Midfield',
  'LA': 'Left Wing',
  'RA': 'Right Wing',
  'ST': 'Striker',
};

// Video-URL → Thumbnail-URL für die Card im PDF.
// YouTube: hqdefault.jpg (immer verfügbar, anders als maxresdefault).
// Anderes (Storage-MP4 / Vimeo / unbekannt): Fallback auf Spielerfoto.
function resolveVideoThumbnail(videoUrl?: string, playerPhotoUrl?: string): string | null {
  if (!videoUrl) return null;
  const yt = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  if (yt) return `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`;
  return playerPhotoUrl || null;
}

const POSITION_MAP: Record<string, string> = {
  'TW': 'Torwart',
  'IV': 'Innenverteidiger',
  'LV': 'Linker Verteidiger',
  'RV': 'Rechter Verteidiger',
  'DM': 'Defensives Mittelfeld',
  'ZM': 'Zentrales Mittelfeld',
  'OM': 'Offensives Mittelfeld',
  'LA': 'Linke Außenbahn',
  'RA': 'Rechte Außenbahn',
  'ST': 'Stürmer',
};

function calculateAge(birthDate: string): number {
  if (!birthDate) return 0;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// Datumsformatierung sprach-abhängig:
//   DE → "DD.MM.YYYY"
//   EN → "Aug 5th 2020" (US-Style: Monat-Abk + Tag-mit-Ordinal-Suffix + Jahr)
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function ordinalSuffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}
function formatEnDate(day: number, month: number, year: number): string {
  return `${EN_MONTHS[month]} ${day}${ordinalSuffix(day)} ${year}`;
}

function formatDate(dateStr: string, lang: 'de' | 'en' = 'de'): string {
  if (!dateStr) return '';
  // Eingabe kann "DD.MM.YYYY" oder "YYYY-MM-DD" sein
  let day: number, month0: number, year: number;
  if (dateStr.includes('.')) {
    const p = dateStr.split('.');
    if (p.length !== 3) return dateStr;
    day = parseInt(p[0], 10); month0 = parseInt(p[1], 10) - 1; year = parseInt(p[2], 10);
  } else {
    const p = dateStr.split('-');
    if (p.length !== 3) return dateStr;
    year = parseInt(p[0], 10); month0 = parseInt(p[1], 10) - 1; day = parseInt(p[2], 10);
  }
  if (lang === 'en') return formatEnDate(day, month0, year);
  return `${String(day).padStart(2, '0')}.${String(month0 + 1).padStart(2, '0')}.${year}`;
}

function formatDateDE(dateStr: string, lang: 'de' | 'en' = 'de'): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month0 = date.getMonth();
    const year = date.getFullYear();
    if (lang === 'en') return formatEnDate(day, month0, year);
    return `${String(day).padStart(2, '0')}.${String(month0 + 1).padStart(2, '0')}.${year}`;
  } catch {
    return '-';
  }
}

// Liga-Phasen/Kategorien-Suffix entfernen ("U17 DFB-Nachwuchsliga - Liga A" → "U17 DFB-Nachwuchsliga")
// Der erste " - "-Block wird gestrippt; Vereinsnamen mit "DFB-Pokal" bleiben unverändert weil
// dort kein Whitespace um den Bindestrich liegt.
function normalizeLeagueName(name: string): string {
  if (!name) return '';
  return name.replace(/\s+-\s+.+$/, '').trim();
}

function generateHtml(player: Player, careerEntries: CareerEntry[], playerDescription: string, additionalInfo: string, highlightVideoUrl: string | undefined, highlightVideoTitle: string | undefined, lang: 'de' | 'en', translations: Map<string, string>, advisorEmail?: string, advisorPhone?: string, clubLogoUrl?: string, loanFromClubLogoUrl?: string): string {
  const t = I18N[lang];
  const dateLocale = lang === 'en' ? 'en-GB' : 'de-DE';
  const positionFullMap = lang === 'en' ? POSITION_MAP_EN : POSITION_MAP;
  // tFreeText: Freitext (Description, Additional-Info-Bullets) — nutzt Claude-Translation-Map
  // tStrength: Stärken — Lookup-First, dann Translation-Map, dann Substring-Replace
  const tFreeText = (s: string): string => {
    if (lang !== 'en' || !s) return s;
    return translations.get(s) || s;
  };
  const tStrengthFinal = (s: string): string => {
    if (lang !== 'en' || !s) return s;
    const trimmed = s.trim();
    const exact = STRENGTH_TRANSLATIONS_DE_EN[trimmed.toLowerCase()];
    if (exact) return exact;
    if (translations.has(trimmed)) return translations.get(trimmed)!;
    return translateStrength(trimmed, 'en');  // Substring-Replace-Fallback
  };
  // Robust translation: nimmt Kürzel ("IV") UND deutsche Long-Forms ("Innenverteidiger") als Input
  // und liefert die richtige Sprachversion. Erspart Datenmigration auf Kürzel.
  const DE_LONG_TO_CODE: Record<string, string> = {};
  Object.entries(POSITION_MAP).forEach(([code, name]) => { DE_LONG_TO_CODE[name.toLowerCase()] = code; });
  const translatePos = (raw: string): string => {
    const v = (raw || '').trim();
    if (!v) return '';
    if (positionFullMap[v]) return positionFullMap[v];                 // Kürzel z.B. "IV"
    const code = DE_LONG_TO_CODE[v.toLowerCase()];
    if (code && positionFullMap[code]) return positionFullMap[code];   // deutsche Long-Form → englisch
    return v;                                                          // unbekannt → Original belassen
  };
  const birthDateFormatted = formatDateDE(player.birth_date, lang);
  const contractEndFormatted = formatDateDE(player.contract_end, lang);
  const age = calculateAge(player.birth_date);
  const normalizedClub = normalizeGermanClubName(player.club);
  const normalizedLeague = normalizeLeagueName(player.league || '');
  const normalizedLoanClub = player.loan_from_club ? normalizeGermanClubName(player.loan_from_club) : '';
  const normalizedLoanLeague = player.loan_from_club_league ? normalizeLeagueName(player.loan_from_club_league) : '';
  const flagsHtml = nationalityToFlags(player.nationality);
  const longestName = Math.max((player.last_name || '').length, (player.first_name || '').length);
  const nameSize = longestName > 16 ? 36 : longestName > 12 ? 44 : 52;
  const nameLineHeight = nameSize + 4;

  // Adresse basierend auf Listung
  const isKMH = !player.listing || player.listing.toLowerCase().includes('karl') || player.listing.toLowerCase().includes('kmh');

  const responsibility = player.responsibility || '';
  let advisorNames = responsibility.split(/,\s*|&\s*/).map(s => s.trim()).filter(s => s);
  if (!isKMH) {
    advisorNames = ['Matti Langer'];
  }
  const advisorsHtml = advisorNames.length > 0
    ? advisorNames.map(name => `<div style="color: #fff !important; font-size: 13px;">${name}</div>`).join('')
    : '<div style="color: #fff !important; font-size: 13px;">-</div>';
  const addressStreet = isKMH ? 'Klaußnerweg 6' : 'Hermann-Müller-Straße 22';
  const addressCity = isKMH ? '82061 Neuried' : '04416 Markkleeberg';

  // E-Mail: Immer basierend auf Listung (KMH oder PM)
  const email = isKMH ? 'office@kmhsport.com' : 'info@pm-sportmanagement.com';

  // Telefon: Feste Nummern basierend auf Listung
  const phone = isKMH ? '089 72458696' : '+49 173 4508619';

  // Liga-Priorität: niedrigere Zahl = höhere Liga (wird zuerst angezeigt)
  const getLeaguePriority = (league: string): number => {
    const l = league.toLowerCase();
    // Herren-Ligen
    if (!l.includes('u19') && !l.includes('u17') && !l.includes('u21') && !l.includes('u23') && !l.includes('junioren') && !l.includes('jugend') && !l.includes('nachwuchs')) {
      if (l === 'bundesliga' || l === '1. bundesliga') return 1;
      if (l.includes('2. bundesliga')) return 2;
      if (l.includes('3. liga')) return 3;
      if (l.includes('regionalliga')) return 4;
      if (l.includes('oberliga')) return 5;
      if (l.includes('pokal')) return 10;
      return 50;
    }
    // Junioren: U23 > U21 > U19 > U17
    if (l.includes('u23')) return 101;
    if (l.includes('u21')) return 102;
    if (l.includes('u19')) return 103;
    if (l.includes('u17')) return 104;
    return 110;
  };

  // Karriere-Einträge nach Verein + Saison gruppieren
  const groupedCareer: { club: string; from_date: string; to_date: string; is_current: boolean; season_label?: string; competitions: { league: string; games: string; goals: string; assists: string; stats: string }[] }[] = [];
  for (const entry of careerEntries || []) {
    const key = `${entry.club}_${entry.from_date}`;
    const existing = groupedCareer.find(g => `${g.club}_${g.from_date}` === key);
    if (existing) {
      existing.competitions.push({ league: entry.league, games: entry.games || '', goals: entry.goals || '', assists: entry.assists || '', stats: entry.stats || '' });
      // Erstes nicht-leeres season_label in der Gruppe gewinnt
      if (!existing.season_label && entry.season_label) existing.season_label = entry.season_label;
    } else {
      groupedCareer.push({ club: entry.club, from_date: entry.from_date, to_date: entry.to_date, is_current: entry.is_current, season_label: entry.season_label, competitions: [{ league: entry.league, games: entry.games || '', goals: entry.goals || '', assists: entry.assists || '', stats: entry.stats || '' }] });
    }
  }
  // Wettbewerbe innerhalb jeder Gruppe nach Liga-Hierarchie sortieren
  for (const group of groupedCareer) {
    group.competitions.sort((a, b) => getLeaguePriority(a.league) - getLeaguePriority(b.league));
  }
  // Saison-Gruppen sortieren: aktuelle Saison (is_current) zuerst, dann nach from_date desc
  // (neueste Saison oben). Akzeptiert "DD.MM.YYYY" und "YYYY-MM-DD".
  const parseFromDate = (s: string): number => {
    if (!s) return 0;
    if (s.includes('.')) {
      const p = s.split('.');
      if (p.length === 3) return new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10)).getTime();
    }
    if (s.includes('-')) return new Date(s).getTime();
    return 0;
  };
  groupedCareer.sort((a, b) => {
    if (a.is_current && !b.is_current) return -1;
    if (!a.is_current && b.is_current) return 1;
    return parseFromDate(b.from_date) - parseFromDate(a.from_date);
  });

  // Saison-Notation aus Datums ableiten: "01.07.2024" + "30.06.2025" → "24/25"
  const seasonFromDates = (from_date: string, to_date?: string): string => {
    const fy = (from_date || '').match(/(\d{4})$/);
    const ty = (to_date || '').match(/(\d{4})$/);
    if (fy && ty) return `${fy[1].slice(2)}/${ty[1].slice(2)}`;
    if (fy) {
      const y = parseInt(fy[1], 10);
      return `${String(y).slice(2)}/${String(y + 1).slice(2)}`;
    }
    return '';
  };

  const careerHtml = groupedCareer.map((group) => {
    const season = seasonFromDates(group.from_date, group.to_date);
    let dateDisplay = '';
    // Freitext-Override aus dem PDF-Editor gewinnt vor allem anderen.
    if (group.season_label && group.season_label.trim()) {
      dateDisplay = group.season_label.trim();
    } else if (group.is_current && season) {
      dateDisplay = `${t.since} ${season}`;
    } else if (season) {
      dateDisplay = season;
    } else if (group.from_date && group.to_date) {
      dateDisplay = `${formatDate(group.from_date, lang)} - ${formatDate(group.to_date, lang)}`;
    } else if (group.from_date) {
      dateDisplay = `${t.since} ${formatDate(group.from_date, lang)}`;
    }

    const isMeaningful = (v: string | undefined): boolean => {
      if (!v) return false;
      const trimmed = String(v).trim();
      if (trimmed === '' || trimmed === '-') return false;
      const n = parseInt(trimmed, 10);
      return !isNaN(n) && n > 0;
    };
    const isOne = (v: string | undefined) => parseInt(String(v || '').trim(), 10) === 1;

    const statsHtml = group.competitions.map(comp => {
      const parts = [];
      if (comp.games && String(comp.games).trim() !== '' && String(comp.games).trim() !== '-') {
        parts.push(`${comp.games} ${isOne(comp.games) ? t.matchOne : t.matchMany}`);
      }
      if (isMeaningful(comp.goals)) parts.push(`${comp.goals} ${isOne(comp.goals) ? t.goalOne : t.goalMany}`);
      if (isMeaningful(comp.assists)) parts.push(`${comp.assists} ${isOne(comp.assists) ? t.assistOne : t.assistMany}`);
      const content = parts.join(' · ') || comp.stats || '';
      const leagueName = normalizeLeagueName(comp.league || '');
      return `
        <div style="font-size: 10px; line-height: 14px;">
          <span style="font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: rgba(255,255,255,0.5);">${leagueName}</span>${content ? `<span style="color: rgba(255,255,255,0.5); margin: 0 6px;">·</span><span style="font-weight: 500; color: #fff;">${content}</span>` : ''}
        </div>
      `;
    }).join('');

    return `
    <div style="margin-bottom: 20px; position: relative;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <svg width="9" height="9" viewBox="0 0 512 512" style="flex-shrink: 0;"><path d="M184 112l144 144-144 144" stroke="${group.is_current ? '#22c55e' : 'rgba(255,255,255,0.5)'}" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="48"/></svg>
        <div style="flex: 1; font-size: 14px; font-weight: 700; color: #fff;">${group.club || ''}</div>
        ${dateDisplay ? `<span style="font-size: 11px; color: rgba(255,255,255,0.6); font-weight: 500; white-space: nowrap; flex-shrink: 0;">${dateDisplay}</span>` : ''}
      </div>
      <div style="padding-left: 15px; margin-top: 6px; display: flex; flex-direction: column; gap: 4px;">
        ${statsHtml}
      </div>
    </div>
  `;
  }).join('');

  const strengthsHtml = player.strengths
    ? player.strengths.split(';').map(s => `<span style="background-color: #fff !important; border: 1px solid #ddd; padding: 5px 12px; border-radius: 8px; font-size: 12px; color: #333; margin-right: 6px; margin-bottom: 6px; display: inline-block; -webkit-print-color-adjust: exact; print-color-adjust: exact;">${s.trim()}</span>`).join('')
    : '-';

  const positionFull = translatePos(player.position);
  const secondaryPositions = player.secondary_position
    ? player.secondary_position.split(',').map(p => translatePos(p)).filter(Boolean).join(', ')
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=794">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Josefin+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 0; }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    html, body {
      width: 210mm;
      height: 297mm;
      max-height: 297mm;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #000;
      overflow: hidden;
    }
    a { color: #3182ce; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div style="width: 210mm; height: 297mm; max-height: 297mm; overflow: hidden; position: relative; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
    <!-- Globaler BG-Layer (durchgehend für die ganze Seite) -->
    <img src="${SCOUTING_BG_DATA_URL}" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; object-fit: cover; object-position: right center; opacity: 0.85; -webkit-print-color-adjust: exact; print-color-adjust: exact;" />
    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.35) !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>

    <!-- Content-Wrapper über dem BG -->
    <div style="position: relative; z-index: 1; width: 100%; height: 100%;">
    <!-- Header (sitzt direkt auf dem globalen BG, ohne eigenen Frame) -->
    <div style="position: relative;">
      <div style="position: relative; z-index: 1; padding: 20px 24px;">
        <!-- Top row: Foto | Name+Club | Section-Label -->
        <div style="display: flex; align-items: center; gap: 24px;">
          ${player.photo_url ? `
          <img src="${player.photo_url}" crossorigin="anonymous" style="width: 130px; height: 175px; object-fit: cover; flex-shrink: 0;" />
          ` : `
          <div style="width: 130px; height: 175px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <span style="font-family: 'Josefin Sans', sans-serif; font-size: 42px; font-weight: 700; color: rgba(255,255,255,0.4) !important;">${(player.first_name?.[0] || '') + (player.last_name?.[0] || '')}</span>
          </div>
          `}

          <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; min-width: 0;">
            <div style="font-family: 'Josefin Sans', sans-serif; font-size: ${nameSize}px; font-weight: 400; letter-spacing: 2px; text-transform: uppercase; color: #fff !important; line-height: ${nameLineHeight}px;">${player.first_name || ''}</div>
            <div style="font-family: 'Josefin Sans', sans-serif; font-size: ${nameSize}px; font-weight: 400; letter-spacing: 2px; text-transform: uppercase; color: #fff !important; line-height: ${nameLineHeight}px;">${player.last_name || ''}</div>
            ${(() => {
              // Dynamische Schriftgröße: Standard 18px; bei langem kombiniertem Text
              // shrink schrittweise auf 16/14/12/11px, damit nichts umbricht.
              const combinedLen = (normalizedClub || '').length + (normalizedLeague ? normalizedLeague.length + 3 : 0);
              let clubLeagueSize = 18;
              if (combinedLen > 32) clubLeagueSize = 16;
              if (combinedLen > 42) clubLeagueSize = 14;
              if (combinedLen > 52) clubLeagueSize = 12;
              if (combinedLen > 64) clubLeagueSize = 11;
              const ls = clubLeagueSize <= 12 ? 1.5 : 2.5;
              return `
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 6px; flex-wrap: nowrap; white-space: nowrap; min-width: 0;">
              ${clubLogoUrl ? `<img src="${clubLogoUrl}" crossorigin="anonymous" style="width: 28px; height: 28px; object-fit: contain; flex-shrink: 0;" />` : ''}
              <span style="font-family: 'Josefin Sans', sans-serif; font-size: ${clubLeagueSize}px; font-weight: 300; letter-spacing: ${ls}px; text-transform: uppercase; color: rgba(255,255,255,0.7) !important; white-space: nowrap;">${normalizedClub || '-'}</span>
              ${normalizedLeague ? `<span style="font-family: 'Josefin Sans', sans-serif; font-size: ${clubLeagueSize}px; font-weight: 300; letter-spacing: ${ls}px; color: rgba(255,255,255,0.75) !important; white-space: nowrap;"> · </span><span style="font-family: 'Josefin Sans', sans-serif; font-size: ${clubLeagueSize}px; font-weight: 300; letter-spacing: ${ls}px; text-transform: uppercase; color: rgba(255,255,255,0.7) !important; white-space: nowrap;">${normalizedLeague}</span>` : ''}
            </div>
            ${normalizedLoanClub ? `
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 4px; flex-wrap: nowrap; white-space: nowrap; min-width: 0;">
              <span style="font-family: 'Josefin Sans', sans-serif; font-size: ${Math.max(clubLeagueSize - 4, 9)}px; font-weight: 500; letter-spacing: ${Math.max(ls - 0.5, 1)}px; text-transform: uppercase; color: #22c55e !important; white-space: nowrap; flex-shrink: 0;">${lang === 'en' ? 'on loan from' : 'ausgeliehen von'}</span>
              ${loanFromClubLogoUrl ? `<img src="${loanFromClubLogoUrl}" crossorigin="anonymous" style="width: 22px; height: 22px; object-fit: contain; flex-shrink: 0;" />` : ''}
              <span style="font-family: 'Josefin Sans', sans-serif; font-size: ${Math.max(clubLeagueSize - 2, 11)}px; font-weight: 300; letter-spacing: ${Math.max(ls - 0.5, 1.2)}px; text-transform: uppercase; color: rgba(255,255,255,0.55) !important; white-space: nowrap;">${normalizedLoanClub}</span>
              ${normalizedLoanLeague ? `<span style="font-family: 'Josefin Sans', sans-serif; font-size: ${clubLeagueSize}px; font-weight: 300; letter-spacing: ${ls}px; color: rgba(255,255,255,0.75) !important; white-space: nowrap;"> · </span><span style="font-family: 'Josefin Sans', sans-serif; font-size: ${Math.max(clubLeagueSize - 2, 11)}px; font-weight: 300; letter-spacing: ${Math.max(ls - 0.5, 1.2)}px; text-transform: uppercase; color: rgba(255,255,255,0.55) !important; white-space: nowrap;">${normalizedLoanLeague}</span>` : ''}
            </div>` : ''}`;
            })()}
          </div>

          <div style="align-self: flex-start; padding-top: 4px; flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
            <span style="font-family: 'Josefin Sans', sans-serif; font-size: 18px; font-weight: 300; letter-spacing: 4px; text-transform: uppercase; color: rgba(255,255,255,0.5) !important; line-height: 18px; white-space: nowrap;">${t.expose}</span>
            <span style="font-size: 9px; color: rgba(255,255,255,0.6) !important; font-weight: 500; line-height: 12px; white-space: nowrap;">${t.asOf}: ${(() => { const d = new Date(); return lang === 'en' ? formatEnDate(d.getDate(), d.getMonth(), d.getFullYear()) : `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`; })()}</span>
          </div>
        </div>

        <!-- Divider -->
        <div style="height: 1px; background: rgba(255,255,255,0.3) !important; margin-top: 14px; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>

        <!-- Stats-Row (5 Spalten) -->
        <div style="display: flex; gap: 16px; padding: 12px 8px 0;">
          <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <div style="font-size: 9px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: rgba(255,255,255,0.5) !important;">${t.nationality}</div>
            <div style="display: flex; gap: 4px; justify-content: center; align-items: center; min-height: 16px;">${flagsHtml || '<span style="font-size: 13px; color: #fff;">-</span>'}</div>
          </div>
          <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <div style="font-size: 9px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: rgba(255,255,255,0.5) !important;">${t.dateOfBirth}</div>
            <div style="font-size: 13px; font-weight: 500; color: #fff !important; text-align: center;">${birthDateFormatted}${age ? ` (${age})` : ''}</div>
          </div>
          <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <div style="font-size: 9px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: rgba(255,255,255,0.5) !important;">${t.contractEnd}</div>
            <div style="font-size: 13px; font-weight: 500; color: #fff !important; text-align: center;">${contractEndFormatted}</div>
          </div>
          <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <div style="font-size: 9px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: rgba(255,255,255,0.5) !important;">${t.transfermarkt}</div>
            <div style="font-size: 13px; font-weight: 500; color: #fff !important; text-align: center;">
              ${player.transfermarkt_url
                ? `<a href="${player.transfermarkt_url}" target="_blank" rel="noopener" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center;"><img src="${TM_LOGO_DATA_URL}" style="height: 18px; width: auto; vertical-align: middle; -webkit-print-color-adjust: exact; print-color-adjust: exact;" /></a>`
                : '-'}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div style="display: flex; padding: 16px; max-height: 880px; overflow: hidden;">
      <!-- Left Column -->
      <div style="width: 260px; padding-right: 20px; flex-shrink: 0;">
        <!-- Spielerprofil Card -->
        <div style="background-color: rgba(0,0,0,0.5) !important; border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; padding: 16px; margin-bottom: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
          <div style="font-family: 'Josefin Sans', sans-serif; font-size: 12px; font-weight: 300; letter-spacing: 4px; text-transform: uppercase; color: rgba(255,255,255,0.7); margin-bottom: 10px;">${t.playerProfile}</div>
          <div style="height: 1px; background-color: rgba(255,255,255,0.2) !important; margin-bottom: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>

          ${(() => {
            const chevron = `<svg width="9" height="9" viewBox="0 0 512 512" style="flex-shrink: 0; margin-top: 5px;"><path d="M184 112l144 144-144 144" stroke="rgba(255,255,255,0.5)" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="48"/></svg>`;
            const labelStyle = 'font-size: 9px; color: rgba(255,255,255,0.5); font-weight: 600; letter-spacing: 0.5px; margin-bottom: 4px;';
            const itemRow = (val: string) => `<div style="display: flex; align-items: flex-start; gap: 6px; margin-bottom: 3px;">${chevron}<span style="font-size: 13px; color: #fff; font-weight: 500; line-height: 18px;">${val}</span></div>`;
            const multiRows = (raw: string) => raw.split(',').map(s => s.trim()).filter(Boolean).map(itemRow).join('');
            // Position-Werte (Long-Form) je Sprache übersetzen — nutzt translatePos
            // (akzeptiert Kürzel UND deutsche Long-Forms als Input)
            const translatePosition = (raw: string) => translatePos(raw);
            // Fuß-Werte (rechts/links/beidfüßig) übersetzen
            const translateFoot = (raw: string) => {
              const r = (raw || '').toLowerCase();
              if (r.includes('beid') || r.includes('both')) return t.footBoth;
              if (r.includes('recht') || r.includes('right')) return t.footRight;
              if (r.includes('link') || r.includes('left')) return t.footLeft;
              return raw || '-';
            };
            return `
            <div style="margin-bottom: 10px;">
              <div style="${labelStyle}">${t.position.toUpperCase()}</div>
              ${itemRow(positionFull || '-')}
            </div>

            ${secondaryPositions ? `
            <div style="margin-bottom: 10px;">
              <div style="${labelStyle}">${t.secondaryPosition.toUpperCase()}</div>
              ${secondaryPositions.split(',').map(s => s.trim()).filter(Boolean).map(s => itemRow(translatePosition(s))).join('')}
            </div>` : ''}

            <div style="margin-bottom: 10px;">
              <div style="${labelStyle}">${t.height.toUpperCase()}</div>
              ${itemRow(player.height ? (lang === 'en' ? `${cmToFeetInches(Number(player.height))} (${player.height} cm)` : `${player.height} cm`) : '-')}
            </div>

            <div style="margin-bottom: 10px;">
              <div style="${labelStyle}">${t.foot.toUpperCase()}</div>
              ${itemRow(player.strong_foot ? translateFoot(player.strong_foot) : '-')}
            </div>

            ${(player as any).pdf_optional_fields?.contract_scope && (player as any).contract_scope ? `
            <div style="margin-bottom: 10px;">
              <div style="${labelStyle}">VERTRAG GILT FÜR</div>
              ${itemRow((player as any).contract_scope)}
            </div>` : ''}

            ${(player as any).pdf_optional_fields?.contract_option && (player as any).contract_option ? `
            <div>
              <div style="${labelStyle}">OPTION</div>
              ${itemRow((player as any).contract_option)}
            </div>` : ''}`;
          })()}
        </div>

        <!-- Stärken Card -->
        <div style="background-color: rgba(0,0,0,0.5) !important; border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; padding: 16px; margin-bottom: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
          <div style="font-family: 'Josefin Sans', sans-serif; font-size: 12px; font-weight: 300; letter-spacing: 4px; text-transform: uppercase; color: rgba(255,255,255,0.7); margin-bottom: 10px;">${t.strengths}</div>
          <div style="height: 1px; background-color: rgba(255,255,255,0.2) !important; margin-bottom: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>
          ${(() => {
            if (!player.strengths) return '<div style="font-size: 13px; color: rgba(255,255,255,0.5);">-</div>';
            const chevron = `<svg width="9" height="9" viewBox="0 0 512 512" style="flex-shrink: 0; margin-top: 5px;"><path d="M184 112l144 144-144 144" stroke="#22c55e" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="48"/></svg>`;
            return player.strengths.split(';').map(s => s.trim()).filter(Boolean).map(s =>
              `<div style="display: flex; align-items: flex-start; gap: 6px; margin-bottom: 3px;">${chevron}<span style="font-size: 13px; color: #fff; font-weight: 500; line-height: 18px;">${tStrengthFinal(s)}</span></div>`
            ).join('');
          })()}
        </div>

        <!-- Management Box (gleicher Light-Style wie Spielerprofil/Stärken) -->
        <div style="background-color: rgba(0,0,0,0.5) !important; border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; padding: 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
          <div style="font-family: 'Josefin Sans', sans-serif; font-size: 12px; font-weight: 300; letter-spacing: 4px; text-transform: uppercase; color: rgba(255,255,255,0.7); margin-bottom: 10px;">${player.listing || 'Karl Herzog Sportmanagement'}</div>
          <div style="height: 1px; background-color: rgba(255,255,255,0.2) !important; margin-bottom: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>

          ${(() => {
            const chevron = `<svg width="9" height="9" viewBox="0 0 512 512" style="flex-shrink: 0; margin-top: 5px;"><path d="M184 112l144 144-144 144" stroke="rgba(255,255,255,0.5)" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="48"/></svg>`;
            const labelStyle = 'font-size: 9px; color: rgba(255,255,255,0.5); font-weight: 600; letter-spacing: 0.5px; margin-bottom: 4px;';
            const itemRow = (val: string) => `<div style="display: flex; align-items: flex-start; gap: 6px; margin-bottom: 3px;">${chevron}<span style="font-size: 12px; color: #fff; font-weight: 500; line-height: 18px;">${val}</span></div>`;
            return `
            <div style="margin-bottom: 10px;">
              <div style="${labelStyle}">${t.email.toUpperCase()}</div>
              ${itemRow(email)}
            </div>

            <div style="margin-bottom: 10px;">
              <div style="${labelStyle}">${t.phone.toUpperCase()}</div>
              ${itemRow(phone || '-')}
            </div>

            <div${isKMH ? '' : ' style="margin-bottom: 10px;"'}>
              <div style="${labelStyle}">${t.address.toUpperCase()}</div>
              ${itemRow(addressStreet)}
              ${itemRow(addressCity)}
            </div>

            ${!isKMH ? `
            <div>
              <div style="${labelStyle}">${t.cooperationAgency.toUpperCase()}</div>
              ${itemRow('Karl Herzog Sportmanagement')}
            </div>` : ''}`;
          })()}
        </div>
      </div>

      <!-- Right Column (helle Card auf blauem BG für Lesbarkeit) -->
      <div style="flex: 1; margin-left: 16px; background-color: rgba(0,0,0,0.5) !important; border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; padding: 16px; min-width: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
        <div style="font-family: 'Josefin Sans', sans-serif; font-size: 12px; font-weight: 300; letter-spacing: 4px; text-transform: uppercase; color: rgba(255,255,255,0.7); margin-bottom: 10px;">${t.careerHistory}</div>
        <div style="height: 1px; background-color: rgba(255,255,255,0.2) !important; margin-bottom: 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>

        ${careerHtml}

        ${(() => {
          const infoPoints = (additionalInfo || '').split(';').map(s => s.trim()).filter(Boolean);
          const hasContent = playerDescription || infoPoints.length > 0;
          if (!hasContent) return '';
          const chevron = `<svg width="9" height="9" viewBox="0 0 512 512" style="flex-shrink: 0; margin-top: 5px;"><path d="M184 112l144 144-144 144" stroke="#22c55e" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="48"/></svg>`;
          const bulletsHtml = infoPoints.length > 0 ? `
            <div style="display: flex; flex-direction: column; gap: 4px;">
              ${infoPoints.map(p => `
                <div style="display: flex; align-items: flex-start; gap: 6px;">
                  ${chevron}
                  <span style="font-size: 13px; color: #fff; font-weight: 500; line-height: 18px; flex: 1;">${tFreeText(p)}</span>
                </div>
              `).join('')}
            </div>
          ` : '';
          const dividerHtml = (infoPoints.length > 0 && playerDescription) ? `
            <div style="height: 1px; background-color: rgba(255,255,255,0.15) !important; margin: 12px 0; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>
          ` : '';
          return `
            <div style="margin-top: 40px;">
              <div style="font-family: 'Josefin Sans', sans-serif; font-size: 12px; font-weight: 300; letter-spacing: 4px; text-transform: uppercase; color: rgba(255,255,255,0.7); margin-bottom: 10px;">${t.additionalInfo}</div>
              <div style="height: 1px; background-color: rgba(255,255,255,0.2) !important; margin-bottom: 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>
              <div style="background-color: rgba(255,255,255,0.05) !important; padding: 12px; border-radius: 8px; border-left: 3px solid rgba(255,255,255,0.5); -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                ${bulletsHtml}
                ${dividerHtml}
                ${playerDescription ? `<div style="font-size: 12px; color: rgba(255,255,255,0.85); line-height: 18px; font-style: italic;">${tFreeText(playerDescription.trim())}</div>` : ''}
              </div>
            </div>
          `;
        })()}

        ${(() => {
          if (!highlightVideoUrl) return '';
          const thumb = resolveVideoThumbnail(highlightVideoUrl, player.photo_url);
          const bgLayer = thumb
            ? `<img src="${thumb}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; -webkit-print-color-adjust: exact; print-color-adjust: exact;" />`
            : `<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.6) !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>`;
          // Play-Icon: weißer Border + weißes Dreieck.
          const playSvg = `
            <svg width="60" height="60" viewBox="0 0 60 60" style="filter: drop-shadow(0 4px 14px rgba(0,0,0,0.6));">
              <circle cx="30" cy="30" r="28" fill="rgba(0,0,0,0.55)" stroke="#fff" stroke-width="2.5"/>
              <path d="M24 18 L42 30 L24 42 Z" fill="#fff"/>
            </svg>
          `;
          const titlePart = highlightVideoTitle ? ` · ${highlightVideoTitle}` : '';
          return `
            <div style="margin-top: 16px;">
              <a href="${highlightVideoUrl}" target="_blank" rel="noopener noreferrer" style="display: block; text-decoration: none; position: relative; height: 150px; border-radius: 8px; overflow: hidden; border: 1px solid #22c55e; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                ${bgLayer}
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.7) 100%); -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                  ${playSvg}
                </div>
                <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 10px 14px; background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.9) 100%); -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                  <span style="font-family: 'Josefin Sans', sans-serif; font-size: 11px; font-weight: 400; letter-spacing: 3px; text-transform: uppercase; color: rgba(255,255,255,0.6);">${t.watchVideo}${titlePart}</span>
                </div>
              </a>
            </div>
          `;
        })()}

      </div>
    </div>

    <!-- Footer Badge -->
    <div style="position: absolute; bottom: 15px; left: 0; right: 0; background-color: #000 !important; padding: 6px 0; display: flex; justify-content: center; align-items: center; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
      <span style="color: #fff !important; font-size: 10px; font-weight: 600; letter-spacing: ${isKMH ? '8' : '3'}px; text-transform: uppercase; padding-left: ${isKMH ? '8' : '3'}px;">${isKMH ? 'OFFICIAL LICENSED FIFA AGENTS' : 'PM SPORTMANAGEMENT X KARL HERZOG SPORTMANAGEMENT'}</span>
    </div>
    </div><!-- /content-wrapper -->
  </div>
</body>
</html>`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("PDF Generation started");

    if (!BROWSERLESS_API_KEY) {
      console.error("BROWSERLESS_API_KEY is missing!");
      throw new Error("BROWSERLESS_API_KEY not configured");
    }
    console.log("BROWSERLESS_API_KEY is set");

    const { player, careerEntries, playerDescription, additionalInfo, highlightVideoUrl, highlightVideoTitle, advisorEmail, advisorPhone, clubLogoUrl, loanFromClubLogoUrl, lang }: RequestBody = await req.json();
    const language: 'de' | 'en' = lang === 'en' ? 'en' : 'de';
    console.log("Received player:", player?.first_name, player?.last_name);

    if (!player) {
      return new Response(
        JSON.stringify({ error: "Player data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auto-Translation aller Freitext-User-Inhalte wenn EN. Lookup-First für Stärken,
    // Claude-Batch für Description/Bullets/unbekannte Stärken.
    const translations = new Map<string, string>();
    if (language === 'en') {
      const strengthsItems = (player?.strengths || '').split(';').map((s: string) => s.trim()).filter(Boolean);
      const unknownStrengths = strengthsItems.filter((s: string) => !STRENGTH_TRANSLATIONS_DE_EN[s.toLowerCase()]);
      const additionalInfoItems = (additionalInfo || '').split(';').map((s: string) => s.trim()).filter(Boolean);
      const description = (playerDescription || '').trim();
      const toTranslate: string[] = [
        ...unknownStrengths,
        ...additionalInfoItems,
        ...(description ? [description] : []),
      ];
      // Dedupe damit gleiche Strings nur einmal an Claude gehen
      const unique = Array.from(new Set(toTranslate));
      if (unique.length > 0) {
        console.log(`[translate] Translating ${unique.length} strings to EN`);
        const translated = await batchTranslate(unique, 'en');
        unique.forEach((src, i) => translations.set(src, translated[i] || src));
      }
    }

    // HTML generieren (exakt wie in der App-Vorschau)
    const html = generateHtml(player, careerEntries || [], playerDescription || '', additionalInfo || '', highlightVideoUrl, highlightVideoTitle, language, translations, advisorEmail, advisorPhone, clubLogoUrl, loanFromClubLogoUrl);
    console.log("HTML generated, length:", html.length);

    // Browserless.io API aufrufen
    console.log("Calling Browserless API...");
    const browserlessResponse = await fetch(
      `https://chrome.browserless.io/pdf?token=${BROWSERLESS_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          html: html,
          options: {
            format: "A4",
            printBackground: true,
            preferCSSPageSize: true,
            margin: {
              top: "0",
              right: "0",
              bottom: "0",
              left: "0",
            },
          },
          gotoOptions: {
            waitUntil: "networkidle0",
            timeout: 30000,
          },
        }),
      }
    );

    if (!browserlessResponse.ok) {
      const errorText = await browserlessResponse.text();
      console.error("Browserless error status:", browserlessResponse.status);
      console.error("Browserless error body:", errorText);
      throw new Error(`Browserless API error: ${browserlessResponse.status} - ${errorText.substring(0, 200)}`);
    }

    // PDF als ArrayBuffer holen
    const pdfBuffer = await browserlessResponse.arrayBuffer();
    
    // In Base64 konvertieren (Deno-safe Methode)
    const base64Pdf = base64Encode(new Uint8Array(pdfBuffer));

    return new Response(
      JSON.stringify({
        pdf: base64Pdf,
        filename: `Expose_${player.last_name || 'Spieler'}_${player.first_name || ''}${language === 'en' ? '_english' : ''}.pdf`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("PDF Generation Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "PDF generation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
