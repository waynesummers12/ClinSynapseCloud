// ============================================================================
// main.ts — Entry point Web Server for ClinSynapseCloud
// ============================================================================

import { Application } from "https://deno.land/x/oak@v11.1.0/mod.ts";
import router from "./server/http.ts";   // <<— default import

const app = new Application();

// Attach router (with /chat, /analyze, /reports, etc.)
app.use(router.routes());
app.use(router.allowedMethods());

const PORT = Number(Deno.env.get("PORT") ?? 8000);
console.log(`🚀 ClinSynapseCloud server running on port ${PORT}`);

await app.listen({ port: PORT });

