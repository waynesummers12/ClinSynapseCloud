// agents/generateReport.ts
// ---------------------------------------------------------------------------
// LabResultsExplained PDF generator
// - Uses pdf-lib to create a branded multi-page PDF
// - Cover page with logo + summary
// - Key insights page with yellow cards
// - Test-by-test table page(s)
// ---------------------------------------------------------------------------

import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib";
import {
  dirname,
  fromFileUrl,
  join,
} from "https://deno.land/std@0.224.0/path/mod.ts";

// ----------------------- Types ---------------------------------------------

export interface LabTestResult {
  name: string;
  value: string | number;
  unit?: string;
  reference_low?: number | null;
  reference_high?: number | null;
  status?: "low" | "high" | "normal" | "critical" | string; // we’ll color-code this
  interpretation?: string;
}

export interface LREAnalysis {
  patient_name?: string;
  report_date?: string; // ISO string or plain text
  summary: string;
  key_insights: string[]; // short bullets
  tests: LabTestResult[];
}

// ----------------------- Config --------------------------------------------

const PAGE_WIDTH = 612; // US Letter 8.5 x 11 in points
const PAGE_HEIGHT = 792;

const MARGIN_X = 50;
const MARGIN_Y = 60;

// Colors (Theme C)
const COLORS = {
  backgroundDark: rgb(0.06, 0.07, 0.12), // dark navy
  pink: rgb(0.96, 0.42, 0.80),
  pinkSoft: rgb(0.98, 0.72, 0.90),
  textOnDark: rgb(1, 1, 1),
  textMain: rgb(0.10, 0.12, 0.18),
  textMuted: rgb(0.36, 0.40, 0.48),
  yellowCard: rgb(1.0, 0.93, 0.70),
  yellowBorder: rgb(0.98, 0.83, 0.45),
  tableHeader: rgb(0.95, 0.96, 0.99),
  tableStripe: rgb(0.98, 0.99, 1),
  statusHigh: rgb(0.89, 0.26, 0.36),
  statusLow: rgb(0.10, 0.48, 0.82),
  statusNormal: rgb(0.26, 0.64, 0.38),
  statusCritical: rgb(0.60, 0.00, 0.20),
};

// Where to save reports on disk
const REPORTS_DIR = "./reports";

const BASE_URL =
  Deno.env.get("PUBLIC_BASE_URL") ?? "https://clinsynapsecloud.onrender.com";

// ----------------------- Helpers -------------------------------------------

function statusColor(status?: string) {
  if (!status) return COLORS.statusNormal;
  const s = status.toLowerCase();
  if (s.includes("critical")) return COLORS.statusCritical;
  if (s.includes("high")) return COLORS.statusHigh;
  if (s.includes("low")) return COLORS.statusLow;
  if (s.includes("normal")) return COLORS.statusNormal;
  return COLORS.statusNormal;
}

// Safe text wrap for simple paragraphs
function drawWrappedText(options: {
  page: any;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  lineHeight: number;
  font: any;
  fontSize: number;
}) {
  const { page, text, x, maxWidth, lineHeight, font, fontSize } = options;
  let { y } = options;

  const words = text.split(/\s+/);
  let line = "";

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width > maxWidth && line) {
      page.drawText(line, { x, y, size: fontSize, font, color: COLORS.textMain });
      line = word;
      y -= lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    page.drawText(line, { x, y, size: fontSize, font, color: COLORS.textMain });
    y -= lineHeight;
  }
  return y;
}

// Resolve path to logo in /assets
async function loadLogoBytes(): Promise<Uint8Array> {
  const here = dirname(fromFileUrl(import.meta.url));
  const logoPath = join(here, "..", "assets", "Lab Results Explained AI Logo.png");
  return await Deno.readFile(logoPath);
}

// ----------------------- Core PDF Builder ----------------------------------

export async function buildLREPdf(analysis: LREAnalysis): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // -------- Cover Page ------------------------------------------------------
  const cover = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  // dark background
  cover.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: COLORS.backgroundDark,
  });

  // Logo
  try {
    const logoBytes = await loadLogoBytes();
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const logoWidth = 260;
    const logoHeight = (logoImage.height / logoImage.width) * logoWidth;
    cover.drawImage(logoImage, {
      x: (PAGE_WIDTH - logoWidth) / 2,
      y: PAGE_HEIGHT - logoHeight - 120,
      width: logoWidth,
      height: logoHeight,
    });
  } catch (_e) {
    // If logo fails to load, just skip – PDF still renders
  }

  // Title text
  cover.drawText("Your Personalized Lab Report", {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 320,
    size: 24,
    font: fontBold,
    color: COLORS.textOnDark,
  });

  const patientLine = analysis.patient_name
    ? `For: ${analysis.patient_name}`
    : "For: Patient";
  cover.drawText(patientLine, {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 350,
    size: 14,
    font: fontRegular,
    color: COLORS.textOnDark,
  });

  const dateLine = analysis.report_date
    ? `Report date: ${analysis.report_date}`
    : "";
  if (dateLine) {
    cover.drawText(dateLine, {
      x: MARGIN_X,
      y: PAGE_HEIGHT - 370,
      size: 12,
      font: fontRegular,
      color: COLORS.textOnDark,
    });
  }

  // Summary box
  cover.drawRectangle({
    x: MARGIN_X,
    y: PAGE_HEIGHT - 520,
    width: PAGE_WIDTH - MARGIN_X * 2,
    height: 120,
    color: COLORS.textOnDark,
    opacity: 0.12,
    borderColor: COLORS.pinkSoft,
    borderWidth: 1,
  });

  let summaryY = PAGE_HEIGHT - 440;
  summaryY = drawWrappedText({
    page: cover,
    text: analysis.summary,
    x: MARGIN_X + 16,
    y: summaryY,
    maxWidth: PAGE_WIDTH - MARGIN_X * 2 - 32,
    lineHeight: 16,
    font: fontRegular,
    fontSize: 11,
  });

  cover.drawText("This report is for informational purposes only and is not a diagnosis.", {
    x: MARGIN_X,
    y: 80,
    size: 8,
    font: fontRegular,
    color: COLORS.textOnDark,
  });

  // -------- Key Insights Page ----------------------------------------------
  const insightsPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  insightsPage.drawText("Key Insights", {
    x: MARGIN_X,
    y: PAGE_HEIGHT - MARGIN_Y,
    size: 20,
    font: fontBold,
    color: COLORS.textMain,
  });

  insightsPage.drawText("Top findings and patterns detected from your lab results:", {
    x: MARGIN_X,
    y: PAGE_HEIGHT - MARGIN_Y - 22,
    size: 11,
    font: fontRegular,
    color: COLORS.textMuted,
  });

  let y = PAGE_HEIGHT - MARGIN_Y - 60;

  const insights = analysis.key_insights && analysis.key_insights.length
    ? analysis.key_insights
    : ["No major concerns detected. Continue regular follow-up with your clinician."];

  const cardHeight = 70;
  const cardGap = 12;

  insights.forEach((insight, index) => {
    if (y - cardHeight < 70) {
      // new page if we run out of space
      y = PAGE_HEIGHT - MARGIN_Y;
    }

    insightsPage.drawRectangle({
      x: MARGIN_X,
      y: y - cardHeight,
      width: PAGE_WIDTH - MARGIN_X * 2,
      height: cardHeight,
      color: COLORS.yellowCard,
      borderColor: COLORS.yellowBorder,
      borderWidth: 1,
      opacity: 1,
    });

    const label =
      index === 0
        ? "Most important insight"
        : index === 1
        ? "Pattern to watch"
        : "Additional insight";

    insightsPage.drawText(label, {
      x: MARGIN_X + 14,
      y: y - 16,
      size: 9,
      font: fontBold,
      color: COLORS.textMuted,
    });

    drawWrappedText({
      page: insightsPage,
      text: insight,
      x: MARGIN_X + 14,
      y: y - 32,
      maxWidth: PAGE_WIDTH - MARGIN_X * 2 - 24,
      lineHeight: 13,
      font: fontRegular,
      fontSize: 11,
    });

    y -= cardHeight + cardGap;
  });

  // -------- Test Table Page(s) ---------------------------------------------
  let tablePage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let tableY = PAGE_HEIGHT - MARGIN_Y;

  function drawTableHeader() {
    tablePage.drawText("Detailed Results", {
      x: MARGIN_X,
      y: tableY,
      size: 18,
      font: fontBold,
      color: COLORS.textMain,
    });

    tableY -= 26;

    tablePage.drawText(
      "Each value is compared to typical reference ranges. Always discuss results with your clinician.",
      {
        x: MARGIN_X,
        y: tableY,
        size: 9,
        font: fontRegular,
        color: COLORS.textMuted,
      },
    );

    tableY -= 20;

    // header background
    tablePage.drawRectangle({
      x: MARGIN_X,
      y: tableY - 18,
      width: PAGE_WIDTH - MARGIN_X * 2,
      height: 18,
      color: COLORS.tableHeader,
    });

    const cols = [MARGIN_X + 8, MARGIN_X + 170, MARGIN_X + 260, MARGIN_X + 360, MARGIN_X + 470];

    const headers = ["Test", "Your value", "Ref. range", "Status", "Notes"];
    headers.forEach((h, i) => {
      tablePage.drawText(h, {
        x: cols[i],
        y: tableY - 6,
        size: 9,
        font: fontBold,
        color: COLORS.textMain,
      });
    });

    tableY -= 26;
  }

  const cols = [MARGIN_X + 8, MARGIN_X + 170, MARGIN_X + 260, MARGIN_X + 360, MARGIN_X + 470];
  drawTableHeader();

  const tests = analysis.tests ?? [];
  for (const test of tests) {
    if (tableY < 80) {
      // new page if we run out of space
      tablePage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      tableY = PAGE_HEIGHT - MARGIN_Y;
      drawTableHeader();
    }

    const stripe = tests.indexOf(test) % 2 === 0;
    if (stripe) {
      tablePage.drawRectangle({
        x: MARGIN_X,
        y: tableY - 18,
        width: PAGE_WIDTH - MARGIN_X * 2,
        height: 18,
        color: COLORS.tableStripe,
      });
    }

    const range =
      test.reference_low != null && test.reference_high != null
        ? `${test.reference_low} – ${test.reference_high}${test.unit ? " " + test.unit : ""}`
        : "-";

    const valueText = `${test.value}${test.unit ? " " + test.unit : ""}`;

    tablePage.drawText(test.name ?? "-", {
      x: cols[0],
      y: tableY - 6,
      size: 9,
      font: fontRegular,
      color: COLORS.textMain,
    });

    tablePage.drawText(valueText, {
      x: cols[1],
      y: tableY - 6,
      size: 9,
      font: fontRegular,
      color: COLORS.textMain,
    });

    tablePage.drawText(range, {
      x: cols[2],
      y: tableY - 6,
      size: 9,
      font: fontRegular,
      color: COLORS.textMain,
    });

    // status as a colored chip
    const status = test.status ?? "normal";
    const chipColor = statusColor(status);
    const chipWidth = 60;
    const chipHeight = 12;

    tablePage.drawRectangle({
      x: cols[3],
      y: tableY - 14,
      width: chipWidth,
      height: chipHeight,
      color: chipColor,
      opacity: 0.18,
      borderColor: chipColor,
      borderWidth: 0.5,
    });

    tablePage.drawText(status.toUpperCase(), {
      x: cols[3] + 4,
      y: tableY - 6,
      size: 8,
      font: fontBold,
      color: chipColor,
    });

    if (test.interpretation) {
      const maxNoteWidth = PAGE_WIDTH - cols[4] - 8;
      const textWidth = fontRegular.widthOfTextAtSize(
        test.interpretation,
        8,
      );
      const truncated =
        textWidth > maxNoteWidth
          ? test.interpretation.slice(0, 40) + "…"
          : test.interpretation;

      tablePage.drawText(truncated, {
        x: cols[4],
        y: tableY - 6,
        size: 8,
        font: fontRegular,
        color: COLORS.textMuted,
      });
    }

    tableY -= 20;
  }

  return await pdfDoc.save();
}

// ----------------------- Save + URL Helper ---------------------------------

export async function generateReportAndSave(
  analysis: LREAnalysis,
  id: string,
): Promise<string> {
  const pdfBytes = await buildLREPdf(analysis);

  await Deno.mkdir(REPORTS_DIR, { recursive: true });

  const filename = `lre-report-${id}.pdf`;
  const filepath = join(REPORTS_DIR, filename);

  await Deno.writeFile(filepath, pdfBytes);

  // This assumes your server exposes /reports as static files.
  // e.g., GET /reports/lre-report-123.pdf
  return `${BASE_URL}/reports/${filename}`;
}


