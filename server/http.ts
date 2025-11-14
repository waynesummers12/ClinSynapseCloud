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
        const { extractedText, result, usedOCR } =
          await analyzeLabReport(tempFilePath);

        return new Response(
          JSON.stringify({
            success: true,
            extractedText,
            result,
            usedOCR,
          }),
          { headers: { "content-type": "application/json" } },
        );
      } catch (err) {
        console.error("❌ Upload handler failed:", err);
        return new Response("Internal server error", { status: 500 });
      }
    }

     return new Response("ClinSynapseCloud API", { status: 200 });
  },
  {
    port: PORT,
    hostname: "0.0.0.0", // REQUIRED FOR RENDER
  }
);







