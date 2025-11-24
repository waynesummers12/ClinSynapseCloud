// ======================================================================
// clinSynapseChat.ts
// Core chat engine for LabResultsExplained (ClinSynapse-style)
// - Uses GPT-5.1 (or your chosen model) for reasoning
// - Takes the structured analysis object + chat history
// - Returns a single friendly, safe reply
// ======================================================================

import { getAnalysisByDocId } from "../data/analysisStore.ts";

export interface LabTest {
  name: string;
  category?: string;
  value: string | number;
  units?: string;
  ref_range?: string;
  status: string;      // "low" | "normal" | "high" | etc.
  comment?: string;
}

export interface LabAnalysis {
  patient_name: string;
  report_date: string;
  summary: string;
  key_insights: string[];
  tests: LabTest[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClinSynapseChatInput {
  message: string;           // latest user question
  analysis: LabAnalysis;     // current report context
  history?: ChatMessage[];   // optional previous turns for this report
}

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

if (!OPENAI_API_KEY) {
  console.warn(
    "⚠️ OPENAI_API_KEY not set. Chat endpoint will fail until you configure it in Render.",
  );
}

// Build a compact context block with labs + insights
function buildContextBlock(analysis: LabAnalysis): string {
  const testsSummary = analysis.tests
    .map((t) =>
      `${t.name}: value=${t.value}${t.units ? " " + t.units : ""}, status=${t.status}${
        t.ref_range ? ` (ref: ${t.ref_range})` : ""
      }`
    )
    .join("\n");

  const insights = analysis.key_insights?.length
    ? analysis.key_insights.map((i) => `• ${i}`).join("\n")
    : "No major critical insights flagged.";

  return `
Patient: ${analysis.patient_name || "N/A"}
Report date: ${analysis.report_date || "N/A"}

High-level summary:
${analysis.summary || "No summary available."}

Key insights:
${insights}

Structured lab values:
${testsSummary}
  `.trim();
}

// System message: how the model should behave
function buildSystemPrompt(): string {
  return `
You are an AI clinical lab interpretation assistant for a product called LabResultsExplained.

Your job:
- Explain lab results in clear, plain English.
- Help patients understand patterns, possible implications, and smart questions to ask their clinician.
- NEVER diagnose, prescribe treatment, or give medical orders.
- Always remind the user that this is not medical advice and they must speak with a licensed clinician.

Style:
- Calm, friendly, reassuring, non-alarmist.
- Use short paragraphs and bullet points.
- Avoid jargon unless you immediately explain it.
- Always structure answers with headings like: "What this result means", "Possible causes", "Questions to ask your doctor", "When to seek urgent care".

Safety:
- If something looks dangerously high/low (e.g., very abnormal glucose, potassium, troponin, etc.),
  clearly suggest urgent medical attention while still disclaiming that this is not a diagnosis.
- Do NOT invent lab values that are not present.
- If something is unclear, say that you don't have enough information.

Context:
- You will be given structured lab data, a high-level summary, and key insights.
- You may get prior chat turns to maintain continuity.
  `.trim();
}

async function callOpenAIChat(messages: { role: string; content: string }[]): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o", // or "gpt-4.1" etc., your choice
      messages,
      temperature: 0.3, // more conservative for medical
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("OpenAI error:", response.status, text);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content returned from OpenAI.");
  }
  return content;
}

// Main exported function
export async function runClinSynapseChat({
  doc_id,
  message,
  history = []
}: {
  doc_id: string;
  message: string;
  history?: ChatMessage[];
}): Promise<string> {


  // Load the stored analysis
  const analysis = await getAnalysisByDocId(doc_id);
  if (!analysis) {
    throw new Error(`No stored analysis found for doc_id=${doc_id}`);
  }

  const systemPrompt = buildSystemPrompt();
  const contextBlock = buildContextBlock(analysis);

  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
    {
      role: "system",
      content:
        "Here are the patient's labs and AI-generated summary for reference:\n\n" +
        contextBlock,
    },
  ];

  // add history as-is
  for (const h of history) {
    messages.push({ role: h.role, content: h.content });
  }

  // latest user question
  messages.push({
    role: "user",
    content: message,
  });

  const reply = await callOpenAIChat(messages);

  // append a safety disclaimer at the end of every reply
  const disclaimer =
    "\n\n⚠️ This explanation is for informational and educational purposes only and is **not** medical advice, diagnosis, or treatment. Always discuss your results with a licensed healthcare professional.";
  return reply.trim() + disclaimer;
}
