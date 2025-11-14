// agents/analysisAgent.ts
// ============================================================
//  ClinSynapseCloud – Lab Report Analyzer
//  OCR + PDF Text Extraction + GPT-4o-mini Analysis
// ============================================================

import "jsr:@std/dotenv/load";
import { PDFDocument } from "https://cdn.skypack.dev/pdf-lib?dts";
import OpenAI from "https://deno.land/x/openai@v4.24.1/mod.ts";

// ============================================================
// Utility: Convert PDF page → PNG Base64 (OCR fallback)
// ============================================================

async function pdfPageToPNGBase64(filePath: string): Promise<string> {
  const pdfBytes = await Deno.readFile(filePath);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const page = pdfDoc.getPages()[0];
  const png = await page.renderAsPng({
    scale: 2,
  });

  return `data:image/png;base64,${btoa(
    String.fromCharCode(...new Uint8Array(png.bytes))
  )}`;
}

// ============================================================
// Utility: Extract Text from PDF (Primary Extraction)
// ============================================================

async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    const pdfBytes = await Deno.readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    let fullText = "";
    const pages = pdfDoc.getPages();

    for (const p of pages) {
      const text = await p.getText();
      if (text) fullText += "\n" + text;
    }

    return fullText.trim();
  } catch (err) {
    console.error("❌ extractTextFromPDF error:", err);
    return "";
  }
}

// ============================================================
// Normalize lab test names (250+ dictionary) — abbreviated here
// ============================================================

const labNormalizationMap: Record<string, string> = {
  "hba1c": "Hemoglobin A1c",
  "hemoglobin a1c": "Hemoglobin A1c",
  "a1c": "Hemoglobin A1c",

  "glucose": "Glucose",
  "blood glucose": "Glucose",

  "hdl": "HDL Cholesterol",
  "hdl cholesterol": "HDL Cholesterol",

  "ldl": "LDL Cholesterol",
  "ldl cholesterol": "LDL Cholesterol",

  "cholesterol": "Total Cholesterol",

  // (Your full 250-entry dictionary goes here — I can rebuild it again if needed)
};

// Normalize name
function normalizeLabName(name: string): string {
  const key = name.trim().toLowerCase();
  return labNormalizationMap[key] || name;
}

// ============================================================
// Generate Thumbnail for Bubble Front-end
// ============================================================

async function generatePreviewImageBase64(filePath: string): Promise<string> {
  try {
    return await pdfPageToPNGBase64(filePath);
  } catch {
    return "";
  }
}

// ============================================================
// GPT-4o-mini Lab Summary
// ============================================================

async function runLLMAnalysis(
  openai: OpenAI,
  text: string
): Promise<Record<string, unknown>> {
  const prompt = `
You are a clinical laboratory interpretation assistant. Analyze the following report:

${text}

Return JSON:
{
  "summary": "...",
  "flagged_abnormal": [],
  "recommendations": []
}
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  try {
    return JSON.parse(completion.choices[0].message?.content ?? "{}");
  } catch {
    return { summary: completion.choices[0].message?.content ?? "" };
  }
}

// ============================================================
// 4. MAIN ANALYZER
// ============================================================

export async function analyzeLabReport(
  filePath: string
): Promise<{
  extractedText: string;
  result: Record<string, unknown>;
  usedOCR: boolean;
}> {
  console.log("🧠 ClinSynapseCloud Analyzer Starting...");

  const openai = new OpenAI({
    apiKey: Deno.env.get("OPENAI_API_KEY"),
  });

  // Thumbnail for Bubble preview (optional)
  const previewImageBase64 = await generatePreviewImageBase64(filePath);

  // 1) Primary text extraction
  let extractedText = await extractTextFromPDF(filePath);
  let usedOCR = false;

  // 2) If text is too short → OCR with GPT-4o Vision
  if (!extractedText || extractedText.length < 50) {
    console.log("⚠️ Low text detected → OCR fallback triggered.");

    const pngBase64 = await pdfPageToPNGBase64(filePath);

    const visionResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract all text from this lab report image:" },
            {
              type: "input_image",
              image_url: pngBase64,
            },
          ],
        },
      ],
    });

    extractedText = visionResponse.choices[0].message?.content ?? "";
    usedOCR = true;
  }

  // 3) Run LLM structured summary
  const result = await runLLMAnalysis(openai, extractedText);

  return {
    extractedText,
    result,
    usedOCR,
  };
}




