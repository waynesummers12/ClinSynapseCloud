// reports/generateReport.ts
// Deno + pdf-lib based PDF generator for LabResultsExplained

import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib";

export interface LabTest {
  name: string;
  value: string | number;
  unit?: string;
  referenceRange?: string;
  interpretation?: string;
  flag?: "HIGH" | "LOW" | "CRITICAL" | "NORMAL" | string;
  category?: string;
}

export interface LabAnalysis {
  summary: string;
  keyInsights: string[]; // already generated key points
  tests: LabTest[];
  patientName?: string;
  reportDate?: string;
  patientDob?: string;
}

const REPORTS_DIR = "./reports";
const BASE_URL = "https://clinsynapsecloud.onrender.com"; // adjust if needed

function flagColor(flag?: string) {
  if (!flag) return rgb(0, 0, 0);
  const f = flag.toUpperCase();
  if (f === "HIGH") return rgb(0.8, 0.1, 0.1);
  if (f === "LOW") return rgb(0.1, 0.2, 0.7);
  if (f === "CRITICAL") return rgb(0.9, 0.2, 0.0);
  return rgb(0, 0.5, 0); // NORMAL / default greenish
}

export async function generateLabReportPDF(
  analysis: LabAnalysis,
  reportId: string,
): Promise<string> {
  const pdfDoc = await PDFDocument.create();

  // === Fonts ===
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Letter size in points: 612 x 792
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;

  // === Cover Page ===
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let { width: pw, height: ph } = page.getSize();

  // Logo
const logoBytes = await Deno.readFile(
  new URL("../../assets/lre-logo.png", import.meta.url),
);
  const logoImage = await pdfDoc.embedPng(logoBytes);
  const logoScale = 0.4;
  const logoWidth = logoImage.width * logoScale;
  const logoHeight = logoImage.height * logoScale;

  page.drawImage(logoImage, {
    x: (pw - logoWidth) / 2,
    y: ph - margin - logoHeight,
    width: logoWidth,
    height: logoHeight,
  });

  let y = ph - margin - logoHeight - 40;

  // Title
  const title = "Your Personalized Lab Report";
  const titleFontSize = 24;
  const titleWidth = fontBold.widthOfTextAtSize(title, titleFontSize);

  page.drawText(title, {
    x: (pw - titleWidth) / 2,
    y,
    size: titleFontSize,
    font: fontBold,
    color: rgb(0.05, 0.05, 0.1),
  });

  y -= 40;

  // Patient info block
  const infoFontSize = 11;
  const lineGap = 16;

  const lines: string[] = [];
  if (analysis.patientName) lines.push(`Name: ${analysis.patientName}`);
  if (analysis.reportDate) lines.push(`Report Date: ${analysis.reportDate}`);
  if (analysis.patientDob) lines.push(`Date of Birth: ${analysis.patientDob}`);

  if (lines.length > 0) {
    const boxHeight = lines.length * lineGap + 16;
    const boxWidth = pw - margin * 2;

    page.drawRectangle({
      x: margin,
      y: y - boxHeight + 8,
      width: boxWidth,
      height: boxHeight,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.85, 0.85, 0.9),
      borderWidth: 1,
    });

    let infoY = y + boxHeight - lineGap - 4;
    for (const line of lines) {
      page.drawText(line, {
        x: margin + 12,
        y: infoY,
        size: infoFontSize,
        font: fontRegular,
        color: rgb(0.1, 0.1, 0.15),
      });
      infoY -= lineGap;
    }
    y -= boxHeight + 24;
  }

  // Overall summary heading
  page.drawText("Summary", {
    x: margin,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.15),
  });
  y -= 20;

  // Summary box
  const summaryText = analysis.summary || "No summary available.";
  const summaryFontSize = 11;
  const summaryMaxWidth = pw - margin * 2 - 16;

  const summaryLines = wrapText(summaryText, summaryFontSize, summaryMaxWidth, fontRegular);
  const summaryBoxHeight = summaryLines.length * (summaryFontSize + 4) + 16;

  page.drawRectangle({
    x: margin,
    y: y - summaryBoxHeight + 8,
    width: pw - margin * 2,
    height: summaryBoxHeight,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.92, 0.92, 0.96),
    borderWidth: 1,
  });

  let summaryY = y + summaryBoxHeight - (summaryFontSize + 6);
  for (const line of summaryLines) {
    page.drawText(line, {
      x: margin + 10,
      y: summaryY,
      size: summaryFontSize,
      font: fontRegular,
      color: rgb(0.1, 0.1, 0.15),
    });
    summaryY -= summaryFontSize + 4;
  }

  // === Page 2: Key Insights ===
  page = pdfDoc.addPage([pageWidth, pageHeight]);
  ({ width: pw, height: ph } = page.getSize());
  y = ph - margin;

  page.drawText("Key Insights", {
    x: margin,
    y,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.2),
  });
  y -= 24;

  const insightFontSize = 11;
  const insightMaxWidth = pw - margin * 2 - 20;

  if (analysis.keyInsights && analysis.keyInsights.length > 0) {
    for (const insight of analysis.keyInsights) {
      const lines = wrapText(insight, insightFontSize, insightMaxWidth, fontRegular);
      const boxHeight = lines.length * (insightFontSize + 4) + 14;

      if (y - boxHeight < margin) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        ({ width: pw, height: ph } = page.getSize());
        y = ph - margin;
      }

      // soft pink highlight
      page.drawRectangle({
        x: margin,
        y: y - boxHeight + 4,
        width: pw - margin * 2,
        height: boxHeight,
        color: rgb(1, 0.97, 0.99),
        borderColor: rgb(0.97, 0.85, 0.93),
        borderWidth: 0.7,
      });

      let lineY = y + boxHeight - (insightFontSize + 4);
      for (const line of lines) {
        page.drawText(line, {
          x: margin + 10,
          y: lineY,
          size: insightFontSize,
          font: fontRegular,
          color: rgb(0.15, 0.1, 0.2),
        });
        lineY -= insightFontSize + 4;
      }

      y -= boxHeight + 12;
    }
  } else {
    page.drawText("No key insights were generated.", {
      x: margin,
      y,
      size: insightFontSize,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.25),
    });
    y -= 20;
  }

  // === Subsequent pages: Detailed Tests ===
  page = pdfDoc.addPage([pageWidth, pageHeight]);
  ({ width: pw, height: ph } = page.getSize());
  y = ph - margin;

  page.drawText("Detailed Results", {
    x: margin,
    y,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.2),
  });
  y -= 24;

  const testFontSize = 11;
  const maxTextWidth = pw - margin * 2;

  for (const test of analysis.tests || []) {
    if (y - 80 < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      ({ width: pw, height: ph } = page.getSize());
      y = ph - margin;
      page.drawText("Detailed Results (cont.)", {
        x: margin,
        y,
        size: 14,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.2),
      });
      y -= 22;
    }

    const flag = test.flag || "NORMAL";
    const fc = flagColor(flag);
    const header = test.name || "Unnamed Test";

    // Test header
    page.drawText(header, {
      x: margin,
      y,
      size: 12,
      font: fontBold,
      color: rgb(0.08, 0.08, 0.15),
    });

    // Flag pill
    const pillText = flag.toUpperCase();
    const pillSize = 9;
    const pillWidth = fontBold.widthOfTextAtSize(pillText, pillSize) + 14;
    const pillHeight = pillSize + 6;

    page.drawRectangle({
      x: pw - margin - pillWidth,
      y: y - 2,
      width: pillWidth,
      height: pillHeight,
      color: fc,
      borderRadius: 8,
    });

    page.drawText(pillText, {
      x: pw - margin - pillWidth + 7,
      y: y + 2,
      size: pillSize,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    y -= 18;

    // Value / range line
    const val = `${test.value}${test.unit ? " " + test.unit : ""}`;
    const ref = test.referenceRange ? test.referenceRange : "Not provided";

    const infoLine = `Result: ${val}   |   Reference: ${ref}`;
    page.drawText(infoLine, {
      x: margin,
      y,
      size: testFontSize,
      font: fontRegular,
      color: rgb(0.15, 0.15, 0.2),
    });

    y -= 16;

    // Interpretation
    const interp = test.interpretation || "No interpretation available.";
    const interpLines = wrapText(interp, testFontSize, maxTextWidth, fontRegular);
    for (const line of interpLines) {
      if (y - (testFontSize + 4) < margin) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        ({ width: pw, height: ph } = page.getSize());
        y = ph - margin;
      }
      page.drawText(line, {
        x: margin,
        y,
        size: testFontSize,
        font: fontRegular,
        color: rgb(0.18, 0.18, 0.25),
      });
      y -= testFontSize + 4;
    }

    // Divider
    y -= 6;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pw - margin, y },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.94),
    });
    y -= 14;
  }

  // Ensure reports directory
  await Deno.mkdir(REPORTS_DIR, { recursive: true });

  const pdfBytes = await pdfDoc.save();
  const filePath = `${REPORTS_DIR}/${reportId}.pdf`;
  await Deno.writeFile(filePath, pdfBytes);

  const pdfUrl = `${BASE_URL}/reports/${reportId}.pdf`;
  return pdfUrl;
}

// Simple text wrapper for pdf-lib
function wrapText(
  text: string,
  fontSize: number,
  maxWidth: number,
  font: any,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const testLine = current ? current + " " + word : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = testLine;
    }
  }
  if (current) lines.push(current);
  return lines;
}

