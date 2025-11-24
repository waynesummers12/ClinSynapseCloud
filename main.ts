// ============================================================================
// main.ts — Entry point for ClinSynapseCloud (Oak server)
// ============================================================================

import { Application } from "https://deno.land/x/oak@v11.1.0/mod.ts";
import router from "./server/http.ts";

const app = new Application();

app.use(router.routes());
app.use(router.allowedMethods());

const PORT = Number(Deno.env.get("PORT") ?? 8000);
console.log(`🚀 ClinSynapseCloud running on port ${PORT}`);

await app.listen({ port: PORT });


