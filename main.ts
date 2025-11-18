// ============================================================================
// main.ts — Web Server for ClinSynapseCloud + LabResultsExplained
// ============================================================================

import { Application, Router, send } from "https://deno.land/x/oak@v11.1.0/mod.ts";
import { analysisAgent } from "./agents/analysisAgent.ts";
import { generateReportAndSave } from "./agents/reports/generateReport.ts";
import { healthCheck } from "./agents/healthCheck.ts";

const app = new Application();
const router = new Router();

// ---------------------------------------------------------------------------
// HEALTH CHECK (pdf engine test)
// ---------------------------------------------------------------------------
router.get("/health/pdf", async (ctx) => {
  ctx.response.headers.set("Content-Type", "application/json");
  ctx.response.body = await healthCheck();
});

// ---------------------------------------------------------------------------
// MAIN LAB REPORT ENDPOINT
// POST /analyze  (multipart file upload)
// ---------------------------------------------------------------------------
router.post("/analyze", async (ctx) => {
  try {
    const body = ctx.request.body({ type: "form-data" });
    const form = await body.value.read();

    const uploaded = form.files?.[0];

    if (!uploaded) {
      ctx.response.status = 400;
      ctx.response.body = { success: false, error: "No file received" };
      return;
    }

    const bytes = await Deno.readFile(uploaded.filename);

    const analysis = await analysisAgent(bytes);

    const pdfUrl = await generateReportAndSave(analysis, analysis.id);

    ctx.response.body = {
      success: true,
      ...analysis,
      pdf_url: pdfUrl
    };
  } catch (err) {
    console.error("ERROR:", err);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: "Internal server error",
      details: err.message
    };
  }
});






// ---------------------------------------------------------------------------
// STATIC FILES — Serve generated PDFs under /reports
// ---------------------------------------------------------------------------
router.get("/reports/:file", async (ctx) => {
  const fileName = ctx.params.file;
  await send(ctx, fileName, {
    root: `${Deno.cwd()}/reports`,
  });
});

// ---------------------------------------------------------------------------
// START SERVER
// ---------------------------------------------------------------------------
const PORT = Deno.env.get("PORT") ?? "8000";

console.log(`🚀 Server running on port ${PORT}`);
app.use(router.routes());
app.use(router.allowedMethods());
await app.listen({ port: Number(PORT) });
