// server/http.ts
// -----------------------------------------------------------------------------
// HTTP server for ClinSynapseCloud
// Endpoints:
//   POST /analyze  → accepts file upload, runs analysis, generates PDF
//   POST /chat     → chat endpoint for follow-up questions
//   GET  /reports/:file → serves PDF reports
// -----------------------------------------------------------------------------

import { handleChatRequest } from "./chatRoute.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

import { analysisAgent } from "../agents/analysisAgent.ts";
import { generateReportAndSave } from "../agents/reports/generateReport.ts";

// Folder where PDFs are stored
const REPORTS_DIR = "./reports";

// CORS
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// -----------------------------------------------------------------------------
// Helper: parse multipart form-data
// -----------------------------------------------------------------------------
async function parseMultipartForm(req: Request): Promise<{ file: Uint8Array; filename: string }> {
  const type = req.headers.get("content-type");
  if (!type || !type.includes("multipart/form-data")) {
    throw new Error("Content-Type must be multipart/form-data");
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;

  if (!file) throw new Error("Missing file");

  const bytes = new Uint8Array(await file.arrayBuffer());
  return { file: bytes, filename: file.name };
}

// -----------------------------------------------------------------------------
// GET /reports/<filename>
// -----------------------------------------------------------------------------
async function handleReportRequest(file: string): Promise<Response> {
  const safe = file.replace(/[^a-zA-Z0-9.\-_]/g, "");
  const path = join(REPORTS_DIR, safe);

  try {
    const pdf = await Deno.readFile(path);
    return new Response(pdf, {
      headers: {
        ...headers,
        "Content-Type": "application/pdf",
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Report not found" }), {
      status: 404,
      headers,
    });
  }
}

// -----------------------------------------------------------------------------
// POST /analyze
// -----------------------------------------------------------------------------
async function handleAnalyzeRequest(req: Request): Promise<Response> {
  try {
    const { file, filename } = await parseMultipartForm(req);

    const result = await analysisAgent(file, filename);

    const pdfPayload = {
      patient_name: result.patient_name ?? "Patient",
      report_date: new Date().toLocaleDateString(),
      summary: result.summary ?? "",
      key_insights: result.key_insights ?? [],
      tests: result.tests ?? [],
    };

    const pdfUrl = await generateReportAndSave(pdfPayload, result.id);

    return new Response(
      JSON.stringify({
        success: true,
        id: result.id,
        summary: result.summary,
        key_insights: result.key_insights,
        tests: result.tests,
        pdf_url: pdfUrl,
      }),
      { headers: { ...headers, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Analyze error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers,
    });
  }
}

// -----------------------------------------------------------------------------
// MAIN ROUTER
// -----------------------------------------------------------------------------
function router(req: Request): Promise<Response> | Response {
  const url = new URL(req.url);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  // Serve PDF reports
  if (req.method === "GET" && url.pathname.startsWith("/reports/")) {
    const file = url.pathname.replace("/reports/", "");
    return handleReportRequest(file);
  }

  // Analyze
  if (req.method === "POST" && url.pathname === "/analyze") {
    return handleAnalyzeRequest(req);
  }

  // Chat endpoint
  if (req.method === "POST" && url.pathname === "/chat") {
    return handleChatRequest(req);
  }

  // 404 fallback
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers,
  });
}

// -----------------------------------------------------------------------------
// START SERVER
// -----------------------------------------------------------------------------
const port = Number(Deno.env.get("PORT") ?? 8000);
console.log(`🚀 ClinSynapseCloud server running on port ${port}`);
serve(router, { port });










