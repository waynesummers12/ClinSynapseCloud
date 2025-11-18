// ============================================================================
// generateReport.ts (v2)
// Builds a polished, professional medical-style PDF for LabResultsExplained
// - Medical blue theme
// - Premium card layout
// - Gradient risk bar for every test
// ============================================================================

// ============================================================================
// generateReport.ts (v2)
// ============================================================================

// IMPORTANT: pdfmake must be imported as namespace modules
import pdfMake from "https://deno.land/x/pdfmake@0.2.7/build/pdfmake.js";
import vfsFonts from "https://deno.land/x/pdfmake@0.2.7/build/vfs_fonts.js";

pdfMake.vfs = vfsFonts.pdfMake.vfs;


import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

const REPORTS_DIR = "./reports";


// ---------------------------------------------------------------------------
// Helper: color for status label text
// ---------------------------------------------------------------------------
function statusColor(status: string) {
  switch (status) {
    case "normal":
      return "#43A047"; // green
    case "borderline_high":
    case "borderline_low":
      return "#FB8C00"; // orange
    case "high":
    case "low":
      return "#E53935"; // red
    default:
      return "#000000";
  }
}

// ---------------------------------------------------------------------------
// Helper: marker position on gradient bar based on status
// Returns a fraction from 0 to 1 (0 = far left, 1 = far right)
// ---------------------------------------------------------------------------
function markerPositionFromStatus(status: string): number {
  switch (status) {
    case "low":
      return 0.1;
    case "borderline_low":
      return 0.25;
    case "normal":
      return 0.45;
    case "borderline_high":
      return 0.7;
    case "high":
      return 0.9;
    default:
      return 0.5;
  }
}

// ---------------------------------------------------------------------------
// Helper: gradient risk bar canvas for a given status
// ---------------------------------------------------------------------------
function buildGradientBarCanvas(status: string) {
  const totalWidth = 220;
  const barHeight = 10;
  const xStart = 0;

  const markerFrac = markerPositionFromStatus(status);
  const markerX = xStart + markerFrac * totalWidth;

  return {
    stack: [
      {
        canvas: [
          // Green segment
          {
            type: "rect",
            x: xStart,
            y: 0,
            w: totalWidth / 3,
            h: barHeight,
            color: "#43A047",
          },
          // Yellow/Orange segment
          {
            type: "rect",
            x: xStart + totalWidth / 3,
            y: 0,
            w: totalWidth / 3,
            h: barHeight,
            color: "#FB8C00",
          },
          // Red segment
          {
            type: "rect",
            x: xStart + (2 * totalWidth) / 3,
            y: 0,
            w: totalWidth / 3,
            h: barHeight,
            color: "#E53935",
          },
          // Marker line
          {
            type: "line",
            x1: markerX,
            y1: -3,
            x2: markerX,
            y2: barHeight + 3,
            lineWidth: 2,
            lineColor: "#000000",
          },
          // Border around bar
          {
            type: "rect",
            x: xStart,
            y: 0,
            w: totalWidth,
            h: barHeight,
            lineWidth: 0.5,
            lineColor: "#263238",
          },
        ],
        margin: [0, 2, 0, 2],
      },
      {
        columns: [
          { text: "Low", fontSize: 8, color: "#555555" },
          { text: "Normal", fontSize: 8, alignment: "center", color: "#555555" },
          { text: "High", fontSize: 8, alignment: "right", color: "#555555" },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Helper: logo as Base64 (optional, safe if missing)
// ---------------------------------------------------------------------------
async function loadLogo(): Promise<string> {
  try {
    const data = await Deno.readFile(
      "./assets/Lab Results Explained AI Logo.png",
    );
    const base64 = btoa(String.fromCharCode(...data));
    return `data:image/png;base64,${base64}`;
  } catch {
    return ""; // Fallback: no logo
  }
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function generateReportAndSave(
  analysis: {
    patient_name: string;
    report_date: string;
    summary: string;
    key_insights: string[];
    tests: Array<{
      name: string;
      category?: string;
      value: string | number;
      units?: string;
      ref_range?: string;
      status: string;
      comment?: string;
    }>;
  },
  id: string,
): Promise<string> {
  await Deno.mkdir(REPORTS_DIR, { recursive: true });
  const logo = await loadLogo();

  // ---------------------------
  // Key Insights list
  // ---------------------------
  const insightList =
    analysis.key_insights && analysis.key_insights.length > 0
      ? analysis.key_insights.map((txt) => ({
          text: "• " + txt,
          margin: [0, 2, 0, 2],
          fontSize: 11,
        }))
      : [
          {
            text:
              "No major issues detected. All values appear within typical reference ranges.",
            margin: [0, 2, 0, 2],
            fontSize: 11,
          },
        ];

  // ---------------------------
  // Build table rows (text details only)
  // ---------------------------
  const detailRows: any[] = [];
  for (const t of analysis.tests) {
    detailRows.push([
      { text: t.name, fontSize: 11 },
      { text: String(t.value) + (t.units ? ` ${t.units}` : ""), fontSize: 11 },
      { text: t.ref_range ?? "-", fontSize: 11 },
      {
        text: t.status || "-",
        color: statusColor(t.status),
        bold: true,
        fontSize: 11,
      },
      { text: t.comment ?? "-", fontSize: 10 },
    ]);

    // Row with gradient bar below the test row
    detailRows.push([
      {
        colSpan: 5,
        margin: [0, 0, 0, 6],
        stack: [
          {
            text: "Position in risk range",
            fontSize: 8,
            color: "#666666",
            margin: [0, 0, 0, 2],
          },
          buildGradientBarCanvas(t.status),
        ],
      },
      {},
      {},
      {},
      {},
    ]);
  }

  // ---------------------------
  // PDF Document Definition
  // ---------------------------
  const docDefinition: any = {
    pageSize: "A4",
    pageMargins: [40, 60, 40, 60],

    content: [
      // HEADER
      {
        columns: [
          logo
            ? {
                image: logo,
                width: 120,
              }
            : {
                text: "LabResultsExplained",
                fontSize: 22,
                bold: true,
                color: "#1E88E5",
              },
          {
            stack: [
              {
                text: "Lab Results Explained — AI Report",
                fontSize: 18,
                bold: true,
                alignment: "right",
                color: "#0D47A1",
              },
              {
                text: `Report Date: ${analysis.report_date}`,
                alignment: "right",
                fontSize: 10,
                color: "#555555",
              },
              {
                text: `Patient: ${analysis.patient_name}`,
                alignment: "right",
                fontSize: 10,
                color: "#555555",
              },
            ],
          },
        ],
        margin: [0, 0, 0, 16],
      },

      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }] },
      { text: "", margin: [0, 10] },

      // SUMMARY CARD
      {
        text: "Summary",
        style: "sectionHeader",
        margin: [0, 0, 0, 4],
      },
      {
        table: {
          widths: ["*"],
          body: [
            [
              {
                stack: [
                  {
                    text: "🧠 High-level Overview",
                    bold: true,
                    fontSize: 12,
                    margin: [0, 0, 0, 4],
                    color: "#0D47A1",
                  },
                  {
                    text: analysis.summary || "No summary available.",
                    fontSize: 11,
                    margin: [0, 2, 0, 0],
                    color: "#263238",
                  },
                ],
                fillColor: "#F4F6F9",
                margin: [10, 8, 10, 10],
              },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 2, 0, 16],
      },

      // KEY INSIGHTS
      {
        text: "Key Insights",
        style: "sectionHeader",
        margin: [0, 0, 0, 4],
      },
      {
        table: {
          widths: ["*"],
          body: [
            [
              {
                stack: [
                  {
                    text: "⭐ What stands out in your labs",
                    bold: true,
                    fontSize: 12,
                    margin: [0, 0, 0, 4],
                    color: "#0D47A1",
                  },
                  ...insightList,
                ],
                fillColor: "#FFFFFF",
                margin: [10, 8, 10, 8],
              },
            ],
          ],
        },
        layout: {
          hLineColor: () => "#E0E0E0",
          vLineWidth: () => 0,
          hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 0 : 0.5),
        },
        margin: [0, 0, 0, 16],
      },

      // DETAILED RESULTS
      {
        text: "Detailed Lab Results",
        style: "sectionHeader",
        margin: [0, 0, 0, 8],
      },

      {
        table: {
          headerRows: 1,
          widths: ["*", "auto", "auto", "auto", "*"],
          body: [
            [
              { text: "Test", bold: true, fontSize: 11 },
              { text: "Value", bold: true, fontSize: 11 },
              { text: "Ref Range", bold: true, fontSize: 11 },
              { text: "Status", bold: true, fontSize: 11 },
              { text: "Notes", bold: true, fontSize: 11 },
            ],
            ...detailRows,
          ],
        },
        layout: {
          fillColor: (rowIndex: number) =>
            rowIndex === 0 ? "#E3F2FD" : rowIndex % 2 === 0 ? "#FAFAFA" : null,
          hLineColor: () => "#E0E0E0",
          vLineColor: () => "#E0E0E0",
        },
        margin: [0, 0, 0, 20],
      },

      // DISCLAIMER
      {
        text: "Important Information",
        style: "sectionHeader",
        margin: [0, 0, 0, 4],
      },
      {
        text:
          "This report is generated by AI to help you better understand your lab results. " +
          "It is for educational and informational purposes only and is not a substitute " +
          "for professional medical advice, diagnosis, or treatment. Always consult your " +
          "healthcare provider with questions about your results.",
        fontSize: 9,
        color: "#555555",
      },
    ],

    // FOOTER WITH PAGE NUMBER + URL
    footer: (currentPage: number, pageCount: number) => {
      return {
        columns: [
          {
            text:
              "LabResultsExplained — For informational use only. Not medical advice.",
            alignment: "left",
            fontSize: 8,
            color: "#777777",
          },
          {
            text: `Page ${currentPage} of ${pageCount}`,
            alignment: "center",
            fontSize: 8,
            color: "#777777",
          },
          {
            text: "www.labresultsexplained.us",
            alignment: "right",
            fontSize: 8,
            color: "#1E88E5",
          },
        ],
        margin: [40, 0, 40, 20],
      };
    },

    styles: {
      sectionHeader: {
        fontSize: 15,
        bold: true,
        color: "#1E88E5",
      },
    },
  };

  // ---------------------------
  // Generate PDF
  // ---------------------------
  const pdf = (pdfMake as any).createPdf(docDefinition);
  const pdfBytes: Uint8Array = await new Promise((resolve) =>
    pdf.getBuffer((buffer: ArrayBuffer) => resolve(new Uint8Array(buffer))),
  );

  const fileName = `lre-report-${id}.pdf`;
  const pdfPath = join(REPORTS_DIR, fileName);

  await Deno.writeFile(pdfPath, pdfBytes);

  console.log(`📄 PDF report saved: ${pdfPath}`);

  // Public URL for Bubble
  const baseUrl = Deno.env.get("PUBLIC_BASE_URL") ??
    "https://clinsynapsecloud.onrender.com";

  return `${baseUrl}/reports/${fileName}`;
}




