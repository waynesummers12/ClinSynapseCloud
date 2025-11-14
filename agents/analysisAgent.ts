// agents/analysisAgent.ts
// ============================================================
//  ClinSynapseCloud – Lab Report Analyzer using EdenAI
// ============================================================

import "jsr:@std/dotenv/load";
import OpenAI from "https://deno.land/x/openai@v4.52.0/mod.ts";

const EDENAI_API_KEY = Deno.env.get("EDENAI_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

// -----------------------------------------------
// OCR using EdenAI (supports any PDF format)
// -----------------------------------------------
async function extractTextWithEdenAI(filePath: string): Promise<string> {
  const pdfBytes = await Deno.readFile(filePath);

  const form = new FormData();
  form.append("providers", "google,microsoft,amazon,abbyy");
  form.append("fallback_providers", "google,microsoft,amazon,abbyy");
  form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "lab.pdf");

  const res = await fetch("https://api.edenai.run/v2/ocr/ocr", {
    method: "POST",
    headers: { Authorization: `Bearer ${EDENAI_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("❌ EdenAI OCR error:", err);
    throw new Error("EdenAI OCR failed");
  }

  const data = await res.json();

  let merged = "";
  for (const provider in data) {
    if (data[provider]?.text) merged += data[provider].text + "\n";
  }

  return merged.trim();
}

// -----------------------------------------------
// GPT lab interpretation
// -----------------------------------------------
async function runLLMAnalysis(text: string) {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a clinical lab interpretation assistant." },
      {
        role: "user",
        content: `Extract, summarize, and analyze the following lab report:\n\n${text}\n\nReturn JSON with:\nsummary, flagged_abnormal, recommendations`,
      },
    ],
  });

  const content = completion.choices[0].message?.content || "{}";

  try {
    return JSON.parse(content);
  } catch {
    return { summary: content };
  }
}

// -----------------------------------------------
// MAIN ANALYZER FUNCTION
// -----------------------------------------------
export async function analyzeLabReport(filePath: string) {
  console.log("🧠 ClinSynapseCloud Analyzer Starting...");

  // OCR (always succeeds)
  const extractedText = await extractTextWithEdenAI(filePath);

  // Lab interpretation
  const result = await runLLMAnalysis(extractedText);

  return {
    extractedText,
    result,
    usedOCR: true,
  };
}





