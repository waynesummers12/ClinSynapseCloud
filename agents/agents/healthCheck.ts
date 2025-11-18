// ======================================================================
// healthCheck.ts
// Confirms pdfmake + fonts load correctly inside Render
// Does NOT save any file — only returns a simple success message
// ======================================================================

import pdfMake from "https://deno.land/x/pdfmake@0.2.7/build/pdfmake.js";
import vfsFonts from "https://deno.land/x/pdfmake@0.2.7/build/vfs_fonts.js";

pdfMake.vfs = vfsFonts.pdfMake.vfs;

export async function healthCheck() {
  try {
    const docDefinition = {
      content: [{ text: "LabResultsExplained — PDF Engine OK", fontSize: 14 }],
    };

    const pdf = pdfMake.createPdf(docDefinition);

    await new Promise((resolve) =>
      pdf.getBuffer((buffer: ArrayBuffer) => resolve(buffer))
    );

    return {
      status: "ok",
      pdf_engine: "ready",
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      status: "error",
      message: String(err),
      timestamp: new Date().toISOString(),
    };
  }
}

