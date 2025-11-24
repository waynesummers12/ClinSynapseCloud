// server/http.ts
// ============================================================================
// Oak Router for ClinSynapseCloud
// ============================================================================

import { Router } from "https://deno.land/x/oak@v11.1.0/mod.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

import { handleChatRequest } from "./chatRoute.ts";
import { analysisAgent } from "../agents/analysisAgent.ts";
import { generateReportAndSave } from "../agents/reports/generateReport.ts";

const REPORTS_DIR = "./reports";
const router = new Router();

// -----------------------------------------------------------------------------
// CORS (Bubble requires this)
// -----------------------------------------------------------------------------
router.options("/(.*)", (ctx) => {
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  ctx.response.status = 200;
});

// -----------------------------------------------------------------------------
// GET /reports/:file
// -----------------------------------------------------------------------------
router.get("/reports/:file", async (ctx) => {
  const safe = ctx.params.file.replace(/[^a-zA-Z0-9.\-_]/g, "");
  const path = join(REPORTS_DIR, safe);

  try {
    const pdf = await Deno.readFile(path);
    ctx.response.headers.set("Content-Type", "application/pdf");
    ctx.response.body = pdf;
  } catch {
    ctx.response.status = 404;
    ctx.response.body = { error: "Report not found" };
  }
});

// -----------------------------------------------------------------------------
// POST /analyze (multipart file API for LRE)
// -----------------------------------------------------------------------------
router.post("/analyze", async (ctx) => {
  try {
    const body = ctx.request.body({ type: "form-data" });
    const form = await body.value.read();

    const uploaded = form.files?.[0];

    if (!uploaded) {
      ctx.response.status = 400;
      ctx.response.body = { error: "No file uploaded" };
      return;
    }

    const bytes = await Deno.readFile(uploaded.filename);

    // IMPORTANT: include filename
    const result = await analysisAgent(bytes, uploaded.filename);

    const pdfUrl = await generateReportAndSave(result, result.id);

    ctx.response.body = {
      success: true,
      ...result,
      pdf_url: pdfUrl,
    };
  } catch (err) {
    console.error("Analyze error:", err);
    ctx.response.status = 500;
    ctx.response.body = { error: err.message };
  }
});

// -----------------------------------------------------------------------------
// POST /chat (Bubble JSON API)
// -----------------------------------------------------------------------------
router.post("/chat", async (ctx) => {
  const json = await ctx.request.body.json();

  const req = new Request(ctx.request.url, {
    method: "POST",
    headers: ctx.request.headers,
    body: JSON.stringify(json),
  });

  const response = await handleChatRequest(req);

  ctx.response.status = response.status;
  ctx.response.headers.set("Content-Type", "application/json");
  ctx.response.body = await response.text();
});

// -----------------------------------------------------------------------------
export default router;
