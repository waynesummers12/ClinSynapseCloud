// server/http.ts
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { analyzeLabReport } from "../agents/analysisAgent.ts";

console.log("🚀 ClinSynapse server starting...");
console.log("✅ Upload endpoint ready on http://localhost:8080/upload");

serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "POST" && url.pathname === "/upload") {
    try {
      const formData = await req.formData();
      const file = formData.get("file");

      if (!file || typeof file === "string") {
        console.error("❌ No file received in upload request.");
        return new Response("No file uploaded.", { status: 400 });
      }

      // Save uploaded file to safe temporary path
      const tempFilePath = `/tmp/${crypto.randomUUID()}-${file.name}`;
      const fileBytes = new Uint8Array(await file.arrayBuffer());
      await Deno.writeFile(tempFilePath, fileBytes);
      console.log(`📄 File saved to: ${tempFilePath}`);

      // 🔥 FIXED: Use the correct function name
      const { extractedText, ...result } = await analyzeLabReport(tempFilePath);

      // --- Logging ---
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
            },
            null,
            2,
          ),
        );

        console.log(`🧾 Log saved to ${logPath}`);
      } catch (logError) {
        console.error("⚠️ Failed to write log:", logError);
      }

      console.log("✅ Analysis complete.");

      return new Response(JSON.stringify(result, null, 2), {
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("🔥 Server error:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          stack: error.stack,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  return new Response("ClinSynapse server is running.", { status: 200 });
});


