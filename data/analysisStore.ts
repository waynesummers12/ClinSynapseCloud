// ============================================================================
// analysisStore.ts
// Simple JSON file–based storage for LabAnalysis objects
// ============================================================================

import { ensureDir } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";

const STORE_DIR = "./data/analysis";
await ensureDir(STORE_DIR);

// Helper: build file path
function pathFor(doc_id: string): string {
  return `${STORE_DIR}/${doc_id}.json`;
}

// Save analysis to disk
export async function saveAnalysis(doc_id: string, analysis: any) {
  const path = pathFor(doc_id);
  await Deno.writeTextFile(path, JSON.stringify(analysis, null, 2));
  return true;
}

// Load analysis by ID
export async function getAnalysisByDocId(doc_id: string) {
  try {
    const path = pathFor(doc_id);
    const text = await Deno.readTextFile(path);
    return JSON.parse(text);
  } catch {
    return null;
  }
}

