// server/http.ts
// -----------------------------------------------------------------------------
// HTTP server for ClinSynapseCloud
// Endpoints:
//   POST /analyze → accepts file upload, runs analysis, generates PDF, returns JSON
//   GET  /reports/:file → serves PDF reports
// -----------------------------------------------------------------------------
import { handleChatRequest } from "./chatRoute.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { extname, join } from "https://deno.land/std@0.224.0/path/mod.ts";

import { analysisAgent } from "../agents/analysisAgent.ts";
import { generateReportAndSave } from "../agents/reports/generateReport.ts";

// Directory where PDFs are stored
const REPORTS_DIR = "./reports";

// Allow CORs for Bubble.io frontend
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// -----------------------------------------------------------------------------
// Utility: Read multipart form-data
// -----------------------------------------------------------------------------
async function parseMultipartForm(req: Request): Promise<{ file: Uint8Array; filename: string }> {
  const contentType = req.headers.get("content-type");
  if (!contentType || !contentType.includes("multipart/form-data")) {
    throw new Error("Invalid content-type. Must be multipart/form-data.");
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) throw new Error("No file uploaded. Field name must be 'file'.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  return { file: bytes, filename: file.name };
}

// -----------------------------------------------------------------------------
// Route: GET /reports/<file>
// Serves stored PDFs so Bubble can download
// -----------------------------------------------------------------------------
async function handleReportRequest(file: string): Promise<Response> {
  const safeFile = file.replace(/[^a-zA-Z0-9.\-_]/g, "");
  const filePath = join(REPORTS_DIR, safeFile);

  try {
    const pdf = await Deno.readFile(filePath);
    return new Response(pdf, {
      headers: {
        ...headers,
        "Content-Type": "application/pdf",
      },
    });
  } catch (_e) {
    return new Response(JSON.stringify({ error: "Report not found" }), {
      status: 404,
      headers,
    });
  }
}

// -----------------------------------------------------------------------------
// Route: POST /analyze
// Accepts PDF/image → runs analysis → generates PDF → returns JSON to Bubble
// -----------------------------------------------------------------------------
async function handleAnalyzeRequest(req: Request): Promise<Response> {
  try {
    // ---- Parse upload file
    const { file, filename } = await parseMultipartForm(req);

    // ---- Run the analysis agent
    const result = await analysisAgent(file, filename);

    // result should contain:
    // { summary, key_insights, tests, id }

    // ---- Build PDF-friendly structure
    const analysisForPdf = {
      patient_name: result.patient_name ?? "Patient",
      report_date: new Date().toLocaleDateString(),
      summary: result.summary ?? "No summary available.",
      key_insights: result.key_insights ?? [],
      tests: result.tests ?? [],
    };

    // ---- Generate PDF + save to /reports
    const pdfUrl = await generateReportAndSave(analysisForPdf, result.id);

    // ---- Return JSON for Bubble
    return new Response(
      JSON.stringify({
        success: true,
        id: result.id,
        summary: result.summary,
        key_insights: result.key_insights,
        tests: result.tests,
        pdf_url: pdfUrl,
      }),
      {
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err) {
    console.error("Error in /analyze:", err);
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

  // OPTIONS → for CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  // Serve PDF reports: GET /reports/<file>
  if (req.method === "GET" && url.pathname.startsWith("/reports/")) {
    const file = url.pathname.replace("/reports/", "");
    return handleReportRequest(file);
  }

  // Analysis endpoint
  if (req.method === "POST" && url.pathname === "/analyze") {
    return handleAnalyzeRequest(req);
  }
// Chat endpoint
if (req.method === "POST" && url.pathname === "/chat") {
  return handleChatRequest(req);
}
  // Default 404
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers,
  });
}

// -----------------------------------------------------------------------------
// Start Server
// -----------------------------------------------------------------------------
const port = Number(Deno.env.get("PORT") ?? 8000);

console.log(`🚀 ClinSynapseCloud server running on port ${port}`);

serve(router, { port });









