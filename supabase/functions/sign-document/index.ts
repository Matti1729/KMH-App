// supabase/functions/sign-document/index.ts
// Fügt die hinterlegte Signatur eines Beraters in ein PDF aus finance_documents ein.
// Position: unten rechts auf der letzten Seite. Original-PDF bleibt unverändert,
// das signierte PDF landet als separate Datei unter documents/signed/<uuid>.pdf.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { PDFDocument, degrees } from "https://esm.sh/pdf-lib@1.17.1";

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
    const { document_id, page, x_pt, y_pt, width_pt, height_pt, viewport_w_pt, viewport_h_pt } = await req.json();
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

    // Seiten-Metadaten holen: Rotation + CropBox/MediaBox.
    // pdf.js rendert die rotierte Ansicht der CropBox; pdf-libs drawImage
    // arbeitet jedoch in MediaBox-Koordinaten ohne Rotation. Wir müssen den
    // CropBox-Offset addieren UND bei nicht-null Rotation die Koordinaten
    // entsprechend transformieren.
    const rotation = ((targetPage.getRotation().angle % 360) + 360) % 360; // normalisieren auf 0/90/180/270
    const cropBox = targetPage.getCropBox();
    const mediaBox = targetPage.getMediaBox();
    const cropW = cropBox.width;
    const cropH = cropBox.height;

    // Aus Sicht des Clients (rotierte Ansicht): viewport-Größe ist je nach
    // Rotation gegen die CropBox vertauscht.
    const viewW = (rotation === 90 || rotation === 270) ? cropH : cropW;
    const viewH = (rotation === 90 || rotation === 270) ? cropW : cropH;

    const drawWidth = typeof width_pt === "number" && width_pt > 0
      ? Math.min(width_pt, viewW)
      : Math.min(140, viewW - 100);
    const drawHeight = typeof height_pt === "number" && height_pt > 0
      ? Math.min(height_pt, viewH)
      : drawWidth * imgRatio;

    // x_pt/y_pt: bottom-left der Signatur in viewport-Koordinaten (bottom-left
    // origin), also genau das, was der Client aus seiner Preview ausgerechnet hat.
    let viewX: number;
    let viewY: number;
    if (typeof x_pt === "number" && typeof y_pt === "number") {
      viewX = Math.max(0, Math.min(x_pt, viewW - drawWidth));
      viewY = Math.max(0, Math.min(y_pt, viewH - drawHeight));
    } else {
      viewX = viewW - drawWidth - 50;
      viewY = 50;
    }

    // Rotation-Mapping: viewport-Koordinaten (bottom-left origin) auf MediaBox
    // (bottom-left origin) umrechnen. Beim Drawing wird die Signatur ebenfalls
    // um -rotation gedreht (mit drawImage `rotate`), damit sie nach Anwenden
    // der Page-Rotation im Viewer aufrecht steht.
    let drawX: number;
    let drawY: number;
    let drawRotateDeg = 0;
    // pdf-libs drawImage(x, y, w, h, rotate=R): die Image-Bottom-Left bleibt
    // bei (x, y) liegen, dann wird das Image um diesen Punkt um R Grad CCW
    // rotiert und um (w × h) skaliert. Die folgenden Formeln berechnen
    // (x, y) so, dass nach der Page-Rotation die Bottom-Left der Signatur im
    // Viewer auf (viewX, viewY) (bottom-left-Origin in viewport) liegt.
    if (rotation === 0) {
      drawX = cropBox.x + viewX;
      drawY = cropBox.y + viewY;
      drawRotateDeg = 0;
    } else if (rotation === 90) {
      drawX = cropBox.x + cropW - viewY;
      drawY = cropBox.y + viewX;
      drawRotateDeg = 90;
    } else if (rotation === 180) {
      drawX = cropBox.x + cropW - viewX;
      drawY = cropBox.y + cropH - viewY;
      drawRotateDeg = 180;
    } else if (rotation === 270) {
      drawX = cropBox.x + viewY;
      drawY = cropBox.y + cropH - viewX;
      drawRotateDeg = 270;
    } else {
      drawX = cropBox.x + viewX;
      drawY = cropBox.y + viewY;
    }

    targetPage.drawImage(pngImage, {
      x: drawX,
      y: drawY,
      width: drawWidth,
      height: drawHeight,
      rotate: degrees(drawRotateDeg),
    });

    console.log("sign-document debug:", JSON.stringify({
      rotation,
      cropBox,
      mediaBox,
      derivedView: { viewW, viewH },
      clientView: { viewport_w_pt, viewport_h_pt },
      mismatch: (viewport_w_pt && Math.abs(viewport_w_pt - viewW) > 0.5) ||
                (viewport_h_pt && Math.abs(viewport_h_pt - viewH) > 0.5),
      received: { x_pt, y_pt, width_pt, height_pt },
      computed: { drawX, drawY, drawWidth, drawHeight, drawRotateDeg },
    }));

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
