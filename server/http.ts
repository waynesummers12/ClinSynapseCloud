// server/http.ts
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { analyzeLabReport } from "../agents/analysisAgent.ts";

console.log("🚀 ClinSynapse server starting...");
console.log("✅ Upload endpoint ready on http://localhost:8080/upload");

// Start server
serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "POST" && url.pathname === "/upload") {
    try {
      const formData = await req.formData();
      const file = formData.get("file");

      if (!file || typeof file !== "string") {
        console.error("❌ No file received in upload request.");
        return new Response("No file uploaded.", { status: 400 });
      }

      // -------------------------
      // Save uploaded file
      // -------------------------
      const tempFilePath = `/tmp/${crypto.randomUUID()}-${file.name}`;
      const fileBytes = new Uint8Array(await file.arrayBuffer());

      await Deno.writeFile(tempFilePath, fileBytes);
      console.log(`📁 File saved to: ${tempFilePath}`);

      // -------------------------
      // Main Analyzer Call
      // -------------------------
      const { extractedText, result } = await analyzeLabReport(tempFilePath);

      // -------------------------
      // Logging output JSON file
      // -------------------------
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const logPath = `${Deno.env.get("HOME")}/ClinSynapse/logs/${timestamp}_result.json`;

        await Deno.writeTextFile(
          logPath,
          JSON.stringify(
            {
              timestamp,
              uploadedFile: tempFilePath,
              extractedText: extractedText || "No text extracted.",
              result,
              usedOCR: result?.usedOCR || false,
            },
            null,
            2
          )
        );

        console.log(`📝 Log written to: ${logPath}`);
      } catch (logErr) {
        console.error("⚠️ Failed to write log file:", logErr);
      }

      // Return result to client
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("❌ Upload handler error:", err);
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  return new Response("ClinSynapseCloud server online.", { status: 200 });
});


