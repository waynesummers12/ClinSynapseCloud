import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { analyzeLabReport } from "../agents/analysisAgent.ts";

// REQUIRED FOR RENDER — Use their injected PORT
const PORT = Number(Deno.env.get("PORT")) || 8080;

console.log("🚀 ClinSynapse server starting...");
console.log(`🌐 Binding server to 0.0.0.0:${PORT}`);
console.log(`📤 Upload endpoint ready at http://0.0.0.0:${PORT}/upload`);

serve(
  async (req) => {
    const url = new URL(req.url);

    // ----------------------------------------------------------
    // PDF DELIVERY ROUTE
    // ----------------------------------------------------------
    if (req.method === "GET" && url.pathname.startsWith("/reports/")) {
      const fileName = url.pathname.replace("/reports/", "");
      if (!fileName) {
        return new Response("Report not found", { status: 404 });
      }

      try {
        const filePath = `./reports/${fileName}`;
        const pdfBytes = await Deno.readFile(filePath);

        return new Response(pdfBytes, {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "content-disposition": `inline; filename="${fileName}"`,
          },
        });
      } catch (err) {
        console.error("❌ PDF load error:", err);
        return new Response("PDF not found", { status: 404 });
      }
    }

    // ----------------------------------------------------------
    // FILE UPLOAD ROUTE
    // ----------------------------------------------------------
    if (req.method === "POST" && url.pathname === "/upload") {
      try {
        const formData = await req.formData();
        const file = formData.get("file");

        if (!file || typeof file !== "object") {
          return new Response("No file uploaded.", { status: 400 });
        }

        // Save file temporarily
        const tempFilePath = `/tmp/${crypto.randomUUID()}-${file.name}`;
        const bytes = new Uint8Array(await file.arrayBuffer());
        await Deno.writeFile(tempFilePath, bytes);

        console.log(`📁 File saved to temp: ${tempFilePath}`);

        // Run analyzer
        const { extractedText, result, usedOCR, pdf_url } =
          await analyzeLabReport(tempFilePath);

        return new Response(
          JSON.stringify({
            success: true,
            extractedText,
            result,
            usedOCR,
            pdf_url,     // <-- return PDF URL to Bubble
          }),
          { headers: { "content-type": "application/json" } },
        );
      } catch (err) {
        console.error("❌ Upload handler failed:", err);
        return new Response("Internal server error", { status: 500 });
      }
    }

    // ----------------------------------------------------------
    // DEFAULT ROOT RESPONSE
    // ----------------------------------------------------------
    return new Response("ClinSynapseCloud API", { status: 200 });
  },
  {
    port: PORT,
    hostname: "0.0.0.0", // REQUIRED FOR RENDER
  },
);







