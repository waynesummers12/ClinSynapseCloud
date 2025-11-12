// agents/analysisAgent.ts
// ClinSynapse Hybrid AI: reads both text-based and scanned (image) PDFs using OpenAI GPT-4o Vision fallback.

import OpenAI from "https://deno.land/x/openai@v4.24.1/mod.ts";
import { PDFDocument } from "https://cdn.skypack.dev/pdf-lib?dts";

// --- Extract text from PDF (for text-based PDFs) ---
async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    const data = await Deno.readFile(filePath);
    const pdfDoc = await PDFDocument.load(data);
    const pages = pdfDoc.getPages();
    let text = "";
    for (const page of pages) {
      const content = page.getTextContent?.();
      if (content && Array.isArray(content.items)) {
        text += content.items.map((i: any) => i.str).join(" ");
      }
      text += "\n";
    }
    if (text.trim().length > 0) {
      console.log("🧾 Text-based PDF detected — extracted text successfully.");
    } else {
      console.log("⚠️ No readable text found in PDF — may require OCR fallback.");
    }
    return text.trim();
  } catch (err) {
    console.error("❌ PDF read error (possibly image-only file):", err);
    return "";
  }
}

// --- Main analysis function ---
export async function analyzeLabText(filePath: string) {
  console.log("🔍 Analyzing lab report with ClinSynapse...");

  const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });
  let extractedText = await extractTextFromPDF(filePath);
  let usedOCR = false;

  // --- Fallback to GPT-4o Vision OCR if no readable text ---
  if (!extractedText || extractedText.length < 50) {
    console.log("🧠 Detected scanned or image-based PDF — invoking GPT-4o Vision for OCR...");
    usedOCR = true;
    try {
      const fileData = await Deno.readFile(filePath);
      const base64 = btoa(String.fromCharCode(...fileData));
      const visionResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an OCR assistant. Extract all readable text from this lab report image for medical interpretation.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract every readable word or number from this lab report image." },
              { type: "image_url", image_url: `data:application/pdf;base64,${base64}` },
            ],
          },
        ],
      });
      extractedText = visionResponse.choices?.[0]?.message?.content?.trim() || "";
      if (extractedText) {
        console.log("✅ OCR extraction successful — text obtained via GPT-4o Vision.");
      } else {
        console.log("⚠️ OCR failed — no readable text detected in scanned image.");
      }
    } catch (ocrError) {
      console.error("❌ OCR Vision processing error:", ocrError);
    }
  }

  // --- Now analyze extracted text ---
  const prompt = `
You are ClinSynapse, a clinical AI specializing in interpreting lab results.
Summarize the following lab report clearly in plain English, highlighting key findings, abnormal results, and recommended next steps.

Lab Report Text:
${extractedText || "[No text extracted]"}

Return JSON with:
{
  "summary": "Plain-language explanation of the results",
  "key_values": {"Test Name": "Value and interpretation"},
  "clinical_advice": "Follow-up or lifestyle recommendations"
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are ClinSynapse, a clinical AI that explains lab results to patients." },
        { role: "user", content: prompt },
      ],
    });

    const output = response.choices?.[0]?.message?.content || "⚠️ No AI output returned.";
    console.log(`✅ AI analysis complete. Used OCR: ${usedOCR ? "Yes" : "No"}`);
    if (extractedText.length > 0) {
      console.log(`🧠 Extracted Text Preview: ${extractedText.slice(0, 200)}...`);
    }

    return {
      success: true,
      model: "gpt-4o-mini",
      usedOCR,
      extractedPreview: extractedText.slice(0, 500),
      output,
    };
  } catch (error) {
    console.error("❌ Error during AI analysis:", error);
    return { success: false, error: error.message, usedOCR };
  }
}

