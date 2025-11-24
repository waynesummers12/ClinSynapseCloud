// server/http.ts
// ============================================================================
// Oak Router for ClinSynapseCloud
// ============================================================================

import { Router } from "https://deno.land/x/oak@v11.1.0/mod.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

import { handleChatRequest } from "./chatRoute.ts";
import { analysisAgent } from "../agents/analysisAgent.ts";
import { generateReportAndSave } from "../agents/reports/generateReport.ts";
import { healthCheck } from "../agents/healthCheck.ts";

const REPORTS_DIR = "./reports";
const router = new Router();

// ============================================================================
// CORS — required for Bubble
// ============================================================================
router.options("/(.*)", (ctx) => {
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  ctx.response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  ctx.response.status = 200;
});

// ============================================================================
// GET /health — optional PDF engine test
// ============================================================================
router.get("/health", async (ctx) => {
  const result = await healthCheck();
  ctx.response.headers.set("Content-Type", "application/json");
  ctx.response.body = result;
});

// ============================================================================
// GET /reports/:file  → serve saved PDF files
// ============================================================================
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

// ============================================================================
// POST /analyze → multipart form-data upload from Bubble
// ============================================================================
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

    // Run analysis
    const result = await analysisAgent(bytes);

    // Generate PDF & save
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

// ============================================================================
// POST /chat → Bubble sends JSON: { doc_id, message, history }
// ============================================================================
router.post("/chat", async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    const { doc_id, message, history = [] } = body ?? {};

    if (!doc_id || !message) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Missing doc_id or message" };
      return;
    }

    // Let chatRoute.ts handle everything
    const replyRes = await handleChatRequest(
      new Request("", {
        method: "POST",
        body: JSON.stringify({ doc_id, message, history }),
        headers: { "Content-Type": "application/json" },
      })
    );

    ctx.response.status = replyRes.status;
    ctx.response.headers.set("Content-Type", "application/json");
    ctx.response.body = await replyRes.json();

  } catch (err) {
    console.error("❌ Error in /chat:", err);
    ctx.response.status = 500;
    ctx.response.body = { error: err.message };
  }
});

// ============================================================================
// EXPORT ROUTER
// ============================================================================
export default router;

