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
    // Ohne Angaben Fallback: letzte Seite, unten rechts (Padding 50pt, Breite 140pt).
    const { document_id, page, x_pt, y_pt, width_pt } = await req.json();
    if (!document_id) {
      return new Response(JSON.stringify({ error: "document_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Dokument laden
    const { data: doc, error: docErr } = await sb
      .from("finance_documents")
      .select("id, storage_path, filename, signed")
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

    // PDF + Signatur-PNG aus Storage laden
    const [pdfRes, pngRes] = await Promise.all([
      sb.storage.from("documents").download(doc.storage_path),
      sb.storage.from("documents").download(sig.storage_path),
    ]);
    if (pdfRes.error || !pdfRes.data) {
      return new Response(JSON.stringify({ error: "PDF konnte nicht geladen werden" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (pngRes.error || !pngRes.data) {
      return new Response(JSON.stringify({ error: "Signatur konnte nicht geladen werden" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pdfBytes = new Uint8Array(await pdfRes.data.arrayBuffer());
    const pngBytes = new Uint8Array(await pngRes.data.arrayBuffer());

    // pdf-lib: PNG einbetten und an gewünschter Position platzieren.
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pngImage = await pdfDoc.embedPng(pngBytes);
    const pages = pdfDoc.getPages();
    const ratio = pngImage.height / pngImage.width;

    // Vom Client gewünschte Seite (1-basiert) oder Fallback letzte Seite
    const pageIdx = typeof page === "number" && page >= 1 && page <= pages.length
      ? page - 1
      : pages.length - 1;
    const targetPage = pages[pageIdx];
    const { width: pageW, height: pageH } = targetPage.getSize();

    const drawWidth = typeof width_pt === "number" && width_pt > 0
      ? Math.min(width_pt, pageW)
      : Math.min(140, pageW - 100);
    const drawHeight = drawWidth * ratio;

    let drawX: number;
    let drawY: number;
    if (typeof x_pt === "number" && typeof y_pt === "number") {
      // Client liefert bottom-left-Koordinate des Signatur-Rechtecks
      drawX = Math.max(0, Math.min(x_pt, pageW - drawWidth));
      drawY = Math.max(0, Math.min(y_pt, pageH - drawHeight));
    } else {
      // Fallback: unten rechts mit 50pt Padding
      drawX = pageW - drawWidth - 50;
      drawY = 50;
    }

    targetPage.drawImage(pngImage, {
      x: drawX,
      y: drawY,
      width: drawWidth,
      height: drawHeight,
    });

    const signedBytes = await pdfDoc.save();

    // Signiertes PDF in Storage hochladen
    const signedPath = `signed/${doc.id}.pdf`;
    const { error: upErr } = await sb.storage
      .from("documents")
      .upload(signedPath, signedBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) {
      return new Response(JSON.stringify({ error: `Upload-Fehler: ${upErr.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
