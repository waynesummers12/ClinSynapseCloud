// ======================================================================
// chatRoute.ts
// HTTP handler for POST /chat
// Expects JSON: { message: string, analysis: LabAnalysis, history?: ChatMessage[] }
// Returns: { reply: string }
// ======================================================================

import { runClinSynapseChat, LabAnalysis, ChatMessage } from "./clinSynapseChat.ts";

export async function handleChatRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { message, analysis, history } = body ?? {};

  if (!message || !analysis) {
    return new Response(
      JSON.stringify({ error: "Missing 'message' or 'analysis' in request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const reply = await runClinSynapseChat({
      message: String(message),
      analysis: analysis as LabAnalysis,
      history: (history ?? []) as ChatMessage[],
    });

    // Do NOT log PHI
    return new Response(
      JSON.stringify({ reply }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Chat error:", err);
    return new Response(
      JSON.stringify({ error: "Chat processing failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
