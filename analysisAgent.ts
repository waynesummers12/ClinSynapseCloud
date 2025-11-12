// agents/analysisAgent.ts
// ClinSynapse Hybrid AI: reads both text-based and scanned (image) PDFs using OpenAI GPT-4o Vision fallback

import OpenAI from "https://deno.land/x/openai@v4.24.1/mod.ts";
import { PDFDocument } from "https://cdn.skypack.dev/pdf-lib?dts";

async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    const data = await Deno.readFile(filePath);
    const pdfDoc = await PDFDocument.load(data);
    const pages = pdfDoc.getPages();
    let text = "";

    // Try native text extraction first
    for (const page of pages) {
      const pageText = page.getTextContent?.()?.items?.map((i: any) => i.str).join(" ");
      if (pageText) text += pageText + "\n";
    }

    return text.trim() || "";
  } catch (err) {
    console.error("❌ PDF text extraction failed:", err);
    return "";
  }
}

// --- Main analysis ---
export async function analyzeLabText(filePath: string) {
  console.log("🔍 Analyzing lab report with ClinSynapse...");
  const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });

  let pdfText = await extractTextFromPDF(filePath);
  let isScanned = pdfText.length < 100;

  // --- Fallback to GPT-4o Vision OCR if no readable text ---
  if (isScanned) {
  console.log("🧠 Detected scanned or image-based PDF → using GPT-4o Vision for OCR...");

  const fileData = await Deno.readFile(filePath);
  const base64 = Array.from(fileData).map(b => String.fromCharCode(b)).join("");
  const base64Pdf = btoa(base64);

  const visionResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are an expert OCR assistant. Extract every readable word from this lab report image or scanned PDF for downstream analysis.",
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: `data:application/pdf;base64,${base64Pdf}`,
          },
        ],
      },
    ],
  });

  pdfText =
    visionResponse.choices?.[0]?.message?.content ||
    "Could not extract text from scanned PDF.";
}


  // --- Analyze with GPT-4o-mini ---
  const prompt = `
You are ClinSynapse, a clinical AI specializing in interpreting lab results.
Summarize the lab report below for a patient in plain English.
Highlight key findings, abnormal results, and suggested next steps.

Lab Report Text:
${pdfText}

Return JSON:
{
  "summary": "Brief explanation of the lab results",
  "key_values": {"Test Name": "Value and interpretation"},
  "clinical_advice": "Follow-up or next steps"
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are ClinSynapse, a clinical AI specializing in lab result interpretation.",
        },
        { role: "user", content: prompt },
      ],
    });

    const output =
      response.choices?.[0]?.message?.content || "⚠️ No AI output returned.";
    console.log("✅ AI analysis complete.");
    return { success: true, model: "gpt-4o-mini", output };
  } catch (error) {
    console.error("❌ Error during AI analysis:", error);
    return { success: false, error: error.message };
  }
}

