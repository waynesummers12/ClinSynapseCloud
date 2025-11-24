// server/chatRoute.ts
import { runClinSynapseChat } from "../agents/clinSynapseChat.ts";

export async function handleChatRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { doc_id, message, history } = body ?? {};

  if (!doc_id || !message) {
    return new Response(JSON.stringify({ error: "Missing doc_id or message" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const reply = await runClinSynapseChat({
      doc_id,
      message,
      history: history ?? [],
    });

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Chat error:", err);
    return new Response(JSON.stringify({ error: "Chat failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}


