// agents/analysisAgent.ts
// ============================================================
//  ClinSynapseCloud – Lab Report Analyzer
//  OCR: EdenAI + Interpretation: OpenAI (GPT-4o-mini)
//  + Built-in lab normalization dictionary with typical ranges
//  + Persists analysis so /chat can retrieve it later
// ============================================================

import "jsr:@std/dotenv/load";
import OpenAI from "https://deno.land/x/openai@v4.24.1/mod.ts";
import { saveAnalysis } from "../data/analysisStore.ts";   // ✅ REQUIRED

const EDENAI_API_KEY = Deno.env.get("EDENAI_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

// ------------------------------------------------------------
// Lab Dictionary Types
// ------------------------------------------------------------
type LabEntry = {
  key: string;
  canonicalName: string;
  aliases: string[];
  category: string;
  typicalUnits?: string;
  refLow?: number;
  refHigh?: number;
  refText?: string;
};

// ------------------------------------------------------------
// Core Lab Dictionary (~"250-style" foundation)
// ------------------------------------------------------------

const LAB_ENTRIES: LabEntry[] = [
  // ===== Diabetes / Glycemic Control =====
  {
    key: "hemoglobin a1c",
    canonicalName: "Hemoglobin A1c",
    aliases: ["a1c", "hba1c", "hb a1c", "hemoglobin a1c"],
    category: "Diabetes / Glycemic Control",
    typicalUnits: "%",
    refLow: 4.0,
    refHigh: 5.6,
    refText: "< 5.7% (non-diabetic typical range)",
  },
  {
    key: "fasting glucose",
    canonicalName: "Fasting Glucose",
    aliases: [
      "glucose fasting",
      "fasting plasma glucose",
      "fpg",
      "fasting glucose",
    ],
    category: "Diabetes / Glycemic Control",
    typicalUnits: "mg/dL",
    refLow: 70,
    refHigh: 99,
    refText: "70–99 mg/dL (fasting, typical adult range)",
  },
  {
    key: "random glucose",
    canonicalName: "Random Glucose",
    aliases: ["random glucose", "glucose random", "serum glucose"],
    category: "Diabetes / Glycemic Control",
    typicalUnits: "mg/dL",
    refText:
      "< 200 mg/dL random is typically below diabetes diagnostic threshold",
  },
  {
    key: "insulin",
    canonicalName: "Fasting Insulin",
    aliases: ["insulin", "insulin fasting"],
    category: "Diabetes / Glycemic Control",
    typicalUnits: "µIU/mL",
    refLow: 2,
    refHigh: 25,
    refText: "Lab-dependent; often 2–25 µIU/mL fasting",
  },

  // ===== Lipid Panel =====
  {
    key: "total cholesterol",
    canonicalName: "Total Cholesterol",
    aliases: ["cholesterol", "total chol", "chol"],
    category: "Lipid Panel",
    typicalUnits: "mg/dL",
    refText: "< 200 mg/dL desirable (adult)",
  },
  {
    key: "ldl cholesterol",
    canonicalName: "LDL Cholesterol",
    aliases: ["ldl", "ldl-c", "ldl cholesterol"],
    category: "Lipid Panel",
    typicalUnits: "mg/dL",
    refText: "< 100 mg/dL optimal; < 70 mg/dL for high-risk patients",
  },
  {
    key: "hdl cholesterol",
    canonicalName: "HDL Cholesterol",
    aliases: ["hdl", "hdl-c", "hdl cholesterol"],
    category: "Lipid Panel",
    typicalUnits: "mg/dL",
    refText: "≥ 40 mg/dL (men), ≥ 50 mg/dL (women) generally desirable",
  },
  {
    key: "triglycerides",
    canonicalName: "Triglycerides",
    aliases: ["tg", "trigs", "triglycerides"],
    category: "Lipid Panel",
    typicalUnits: "mg/dL",
    refLow: 0,
    refHigh: 149,
    refText: "< 150 mg/dL normal",
  },
  {
    key: "non hdl cholesterol",
    canonicalName: "Non-HDL Cholesterol",
    aliases: ["non-hdl", "non hdl chol", "non-hdl cholesterol"],
    category: "Lipid Panel",
    typicalUnits: "mg/dL",
    refText: "< 130 mg/dL often used as goal",
  },
  {
    key: "apob",
    canonicalName: "Apolipoprotein B",
    aliases: ["apob", "apo b"],
    category: "Lipid Panel / Atherogenic Particles",
    typicalUnits: "mg/dL",
    refText: "< 90 mg/dL often used as target; < 80 mg/dL for high risk",
  },

  // ===== Electrolytes / Basic Metabolic Panel =====
  {
    key: "sodium",
    canonicalName: "Sodium",
    aliases: ["na", "sodium"],
    category: "Electrolytes / BMP",
    typicalUnits: "mmol/L",
    refLow: 135,
    refHigh: 145,
  },
  {
    key: "potassium",
    canonicalName: "Potassium",
    aliases: ["k", "potassium"],
    category: "Electrolytes / BMP",
    typicalUnits: "mmol/L",
    refLow: 3.5,
    refHigh: 5.1,
  },
  {
    key: "chloride",
    canonicalName: "Chloride",
    aliases: ["cl", "chloride"],
    category: "Electrolytes / BMP",
    typicalUnits: "mmol/L",
    refLow: 98,
    refHigh: 107,
  },
  {
    key: "bicarbonate",
    canonicalName: "CO₂ / Bicarbonate",
    aliases: ["co2", "bicarb", "bicarbonate"],
    category: "Electrolytes / BMP",
    typicalUnits: "mmol/L",
    refLow: 22,
    refHigh: 29,
  },
  {
    key: "calcium",
    canonicalName: "Calcium",
    aliases: ["ca", "calcium"],
    category: "Electrolytes / BMP",
    typicalUnits: "mg/dL",
    refLow: 8.5,
    refHigh: 10.5,
  },
  {
    key: "magnesium",
    canonicalName: "Magnesium",
    aliases: ["mg", "magnesium"],
    category: "Electrolytes",
    typicalUnits: "mg/dL",
    refLow: 1.7,
    refHigh: 2.4,
  },
  {
    key: "phosphorus",
    canonicalName: "Phosphorus",
    aliases: ["phos", "phosphate", "phosphorus"],
    category: "Electrolytes / Renal",
    typicalUnits: "mg/dL",
    refLow: 2.5,
    refHigh: 4.5,
  },

  // ===== Renal / Kidney Function =====
  {
    key: "bun",
    canonicalName: "Blood Urea Nitrogen",
    aliases: ["bun", "blood urea nitrogen"],
    category: "Renal / Kidney",
    typicalUnits: "mg/dL",
    refLow: 7,
    refHigh: 20,
  },
  {
    key: "creatinine",
    canonicalName: "Creatinine",
    aliases: ["creat", "creatinine"],
    category: "Renal / Kidney",
    typicalUnits: "mg/dL",
    refLow: 0.6,
    refHigh: 1.3,
    refText: "Varies by sex and muscle mass",
  },
  {
    key: "egfr",
    canonicalName: "Estimated GFR",
    aliases: ["egfr", "estimated gfr", "gfr"],
    category: "Renal / Kidney",
    typicalUnits: "mL/min/1.73 m²",
    refText: "≥ 60 mL/min/1.73 m² considered within normal range",
  },
  {
    key: "microalbumin",
    canonicalName: "Urine Microalbumin",
    aliases: ["microalbumin", "ur microalbumin"],
    category: "Renal / Diabetic Kidney",
    typicalUnits: "mg/L",
    refText: "< 30 mg/g creatinine (albumin/creatinine ratio) typical",
  },

  // ===== Liver Function Panel =====
  {
    key: "ast",
    canonicalName: "AST (Aspartate Aminotransferase)",
    aliases: ["ast", "sgot"],
    category: "Liver / Hepatic",
    typicalUnits: "U/L",
    refLow: 0,
    refHigh: 40,
  },
  {
    key: "alt",
    canonicalName: "ALT (Alanine Aminotransferase)",
    aliases: ["alt", "sgpt"],
    category: "Liver / Hepatic",
    typicalUnits: "U/L",
    refLow: 0,
    refHigh: 40,
  },
  {
    key: "alkaline phosphatase",
    canonicalName: "Alkaline Phosphatase",
    aliases: ["alk phos", "alp", "alkaline phosphatase"],
    category: "Liver / Bone",
    typicalUnits: "U/L",
    refLow: 40,
    refHigh: 129,
  },
  {
    key: "total bilirubin",
    canonicalName: "Total Bilirubin",
    aliases: ["bilirubin total", "tbili", "total bilirubin"],
    category: "Liver / Hepatic",
    typicalUnits: "mg/dL",
    refLow: 0.1,
    refHigh: 1.2,
  },
  {
    key: "albumin",
    canonicalName: "Albumin",
    aliases: ["albumin"],
    category: "Liver / Protein",
    typicalUnits: "g/dL",
    refLow: 3.5,
    refHigh: 5.0,
  },
  {
    key: "total protein",
    canonicalName: "Total Protein",
    aliases: ["tp", "total protein"],
    category: "Liver / Protein",
    typicalUnits: "g/dL",
    refLow: 6.0,
    refHigh: 8.3,
  },

  // ===== CBC – Red Cells / White Cells / Platelets =====
  {
    key: "wbc",
    canonicalName: "White Blood Cell Count",
    aliases: ["wbc", "white blood cells"],
    category: "CBC / Hematology",
    typicalUnits: "×10^3/µL",
    refLow: 4.0,
    refHigh: 11.0,
  },
  {
    key: "rbc",
    canonicalName: "Red Blood Cell Count",
    aliases: ["rbc", "red blood cells"],
    category: "CBC / Hematology",
    typicalUnits: "×10^6/µL",
    refText: "Adult male ~4.5–5.9; adult female ~4.1–5.1 ×10^6/µL",
  },
  {
    key: "hemoglobin",
    canonicalName: "Hemoglobin",
    aliases: ["hgb", "hemoglobin"],
    category: "CBC / Hematology",
    typicalUnits: "g/dL",
    refText: "Adult male ~13.5–17.5; adult female ~12.0–15.5 g/dL",
  },
  {
    key: "hematocrit",
    canonicalName: "Hematocrit",
    aliases: ["hct", "hematocrit"],
    category: "CBC / Hematology",
    typicalUnits: "%",
    refText: "Adult male ~41–53%; adult female ~36–46%",
  },
  {
    key: "platelets",
    canonicalName: "Platelet Count",
    aliases: ["plt", "platelets"],
    category: "CBC / Hematology",
    typicalUnits: "×10^3/µL",
    refLow: 150,
    refHigh: 450,
  },
  {
    key: "mcv",
    canonicalName: "MCV (Mean Corpuscular Volume)",
    aliases: ["mcv"],
    category: "CBC / Hematology",
    typicalUnits: "fL",
    refLow: 80,
    refHigh: 100,
  },
  {
    key: "rdw",
    canonicalName: "RDW (Red Cell Distribution Width)",
    aliases: ["rdw"],
    category: "CBC / Hematology",
    typicalUnits: "%",
    refLow: 11.5,
    refHigh: 14.5,
  },

  // ===== Thyroid =====
  {
    key: "tsh",
    canonicalName: "TSH (Thyroid Stimulating Hormone)",
    aliases: ["tsh", "thyroid stimulating hormone"],
    category: "Thyroid",
    typicalUnits: "µIU/mL",
    refLow: 0.4,
    refHigh: 4.5,
  },
  {
    key: "free t4",
    canonicalName: "Free T4",
    aliases: ["free t4", "ft4"],
    category: "Thyroid",
    typicalUnits: "ng/dL",
    refLow: 0.8,
    refHigh: 1.8,
  },
  {
    key: "free t3",
    canonicalName: "Free T3",
    aliases: ["free t3", "ft3"],
    category: "Thyroid",
    typicalUnits: "pg/mL",
    refLow: 2.3,
    refHigh: 4.2,
  },
  {
    key: "tpo antibody",
    canonicalName: "Thyroid Peroxidase Antibody",
    aliases: [
      "tpo",
      "tpo ab",
      "thyroid peroxidase antibody",
      "anti-tpo",
      "anti tpo",
    ],
    category: "Thyroid / Autoimmune",
    refText: "Often reported as < 35 IU/mL; lab-specific cutoffs",
  },

  // ===== Vitamins / Nutrients =====
  {
    key: "vitamin d 25 oh",
    canonicalName: "Vitamin D, 25-Hydroxy",
    aliases: [
      "vitamin d",
      "25-oh vitamin d",
      "25 hydroxy vitamin d",
      "vit d 25 oh",
    ],
    category: "Vitamins / Nutrients",
    typicalUnits: "ng/mL",
    refLow: 30,
    refHigh: 100,
    refText: "20–29=insufficient, ≥30 often considered adequate",
  },
  {
    key: "vitamin b12",
    canonicalName: "Vitamin B12",
    aliases: ["b12", "vit b12", "vitamin b12"],
    category: "Vitamins / Nutrients",
    typicalUnits: "pg/mL",
    refLow: 200,
    refHigh: 900,
  },
  {
    key: "folate",
    canonicalName: "Folate",
    aliases: ["folate", "folic acid"],
    category: "Vitamins / Nutrients",
    typicalUnits: "ng/mL",
    refLow: 3,
    refHigh: 17,
  },
  {
    key: "ferritin",
    canonicalName: "Ferritin",
    aliases: ["ferritin"],
    category: "Iron / Hematology",
    typicalUnits: "ng/mL",
    refText:
      "Men ~30–400 ng/mL; women ~15–150 ng/mL (ranges vary by lab and age)",
  },
  {
    key: "iron",
    canonicalName: "Serum Iron",
    aliases: ["iron", "serum iron"],
    category: "Iron / Hematology",
    typicalUnits: "µg/dL",
    refLow: 60,
    refHigh: 170,
  },
  {
    key: "tibc",
    canonicalName: "Total Iron Binding Capacity",
    aliases: ["tibc", "total iron binding capacity"],
    category: "Iron / Hematology",
    typicalUnits: "µg/dL",
    refLow: 240,
    refHigh: 450,
  },

  // ===== Inflammation / Autoimmune =====
  {
    key: "crp",
    canonicalName: "C-Reactive Protein",
    aliases: ["crp", "c reactive protein"],
    category: "Inflammation",
    typicalUnits: "mg/L",
    refLow: 0,
    refHigh: 5,
    refText:
      "< 1 mg/L = low CV risk; 1–3 = avg; > 3 = high (hs-CRP context)",
  },
  {
    key: "esr",
    canonicalName: "ESR (Erythrocyte Sedimentation Rate)",
    aliases: ["esr", "sed rate", "erythrocyte sedimentation rate"],
    category: "Inflammation",
    typicalUnits: "mm/hr",
    refText: "Age and sex dependent; often < 20–30 mm/hr considered normal",
  },

  // ===== Cardiac Markers =====
  {
    key: "troponin",
    canonicalName: "Cardiac Troponin (hs-TnI/T)",
    aliases: ["troponin", "hs-troponin", "hs-tn", "hs-tni", "hs-tnt"],
    category: "Cardiac Markers",
    typicalUnits: "ng/L",
    refText: "Lab-specific; values above 99th percentile indicate injury",
  },
  {
    key: "bnp",
    canonicalName: "BNP",
    aliases: ["bnp", "brain natriuretic peptide"],
    category: "Cardiac Markers",
    typicalUnits: "pg/mL",
    refText: "< 100 pg/mL often used as rule-out for heart failure (adult)",
  },
  {
    key: "nt probnp",
    canonicalName: "NT-proBNP",
    aliases: ["nt-probnp", "nt pro bnp", "nt probnp"],
    category: "Cardiac Markers",
    typicalUnits: "pg/mL",
    refText: "Strongly age-dependent; lower in younger adults",
  },

  // ===== Hormones (Male / Female) =====
  {
    key: "testosterone total",
    canonicalName: "Testosterone, Total",
    aliases: ["testosterone", "total testosterone"],
    category: "Hormones / Androgens",
    typicalUnits: "ng/dL",
    refText:
      "Adult male ~300–1000 ng/dL; adult female much lower (~15–70 ng/dL)",
  },
  {
    key: "testosterone free",
    canonicalName: "Testosterone, Free",
    aliases: ["free testosterone", "testosterone free"],
    category: "Hormones / Androgens",
    typicalUnits: "pg/mL",
  },
  {
    key: "estradiol",
    canonicalName: "Estradiol (E2)",
    aliases: ["estradiol", "e2"],
    category: "Hormones / Estrogens",
    typicalUnits: "pg/mL",
    refText: "Highly cycle/sex dependent; interpret in context",
  },
  {
    key: "progesterone",
    canonicalName: "Progesterone",
    aliases: ["progesterone"],
    category: "Hormones",
    typicalUnits: "ng/mL",
    refText: "Cycle-dependent in premenopausal women",
  },
  {
    key: "lh",
    canonicalName: "Luteinizing Hormone (LH)",
    aliases: ["lh", "luteinizing hormone"],
    category: "Hormones / Pituitary-Gonadal",
  },
  {
    key: "fsh",
    canonicalName: "Follicle Stimulating Hormone (FSH)",
    aliases: ["fsh", "follicle stimulating hormone"],
    category: "Hormones / Pituitary-Gonadal",
  },
  {
    key: "prolactin",
    canonicalName: "Prolactin",
    aliases: ["prolactin"],
    category: "Hormones / Pituitary",
    typicalUnits: "ng/mL",
  },
  {
    key: "cortisol am",
    canonicalName: "Cortisol (AM)",
    aliases: ["cortisol", "cortisol am", "serum cortisol"],
    category: "Adrenal / Hormones",
    typicalUnits: "µg/dL",
    refText: "Morning ~6–18 µg/dL typical; strongly time-of-day dependent",
  },

  // ===== Misc / Metabolic =====
  {
    key: "uric acid",
    canonicalName: "Uric Acid",
    aliases: ["uric acid"],
    category: "Metabolic / Gout",
    typicalUnits: "mg/dL",
    refLow: 3.5,
    refHigh: 7.2,
  },
  {
    key: "psa",
    canonicalName: "PSA (Prostate Specific Antigen)",
    aliases: ["psa", "prostate specific antigen"],
    category: "Tumor Markers / Prostate",
    typicalUnits: "ng/mL",
    refText: "< 4 ng/mL often considered within reference for many labs",
  },
];

// Quick helper: compress dictionary for GPT prompt
const LAB_DICTIONARY_FOR_PROMPT = LAB_ENTRIES.map((e) => ({
  canonicalName: e.canonicalName,
  aliases: e.aliases,
  category: e.category,
  units: e.typicalUnits,
  refLow: e.refLow,
  refHigh: e.refHigh,
  refText: e.refText,
}));

// -------------------------------------------------------------
// OCR via EdenAI
// -------------------------------------------------------------
async function extractTextWithEdenAIFromBytes(bytes: Uint8Array): Promise<string> {
  const form = new FormData();
  form.append("providers", "google");
  form.append("fallback_providers", "microsoft");
  form.append("fallback_providers", "amazon");

  const blob = new Blob([bytes], { type: "application/pdf" });
  form.append("file", blob, "upload.pdf");

  const res = await fetch("https://api.edenai.run/v2/ocr/ocr", {
    method: "POST",
    headers: { Authorization: `Bearer ${EDENAI_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    console.error(await res.text());
    throw new Error("EdenAI OCR request failed");
  }

  const data = await res.json();

  let merged = "";
  for (const provider in data) {
    if (data[provider]?.text) merged += data[provider].text + "\n";
  }

  return merged.trim();
}

// -------------------------------------------------------------
// Run GPT-4o-mini with your dictionary
// -------------------------------------------------------------
async function runLLMAnalysis(text: string): Promise<any> {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const prompt = `
You are a clinical lab interpreter. Normalize test names, assign status
(low/normal/high), estimate units, and return STRICT JSON ONLY using the dictionary:

Dictionary:
${JSON.stringify(LAB_DICTIONARY_FOR_PROMPT)}

Lab report:
${text}

Return JSON with:
- normalized_labs[]
- summary
- overall_pattern
- recommendations[]
- cautions[]
`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  const content = completion.choices[0].message?.content ?? "{}";

  try {
    return JSON.parse(content);
  } catch (err) {
    console.error("❌ JSON parse failed:", err);
    return {
      summary: content,
      normalized_labs: [],
      recommendations: [],
      cautions: ["Model returned non-JSON output."],
    };
  }
}

// -------------------------------------------------------------
// MAIN ANALYZER — used by /analyze
// -------------------------------------------------------------
export async function analysisAgent(bytes: Uint8Array) {
  console.log("🧠 analysisAgent starting…");

  // 1) OCR
  const extractedText = await extractTextWithEdenAIFromBytes(bytes);

  // 2) GPT interpretation
  const result = await runLLMAnalysis(extractedText);

  // 3) Build final object
  const id = crypto.randomUUID();

  const key_insights =
    result.key_insights ??
    result.keyInsights ??
    result.recommendations ??
    [];

  const analysis = {
    id,
    extractedText,
    summary: result.summary ?? "",
    key_insights,
    tests: result.normalized_labs ?? [],
    patient_name: result.patient_name ?? "Patient",
    overall_pattern: result.overall_pattern ?? "",
    cautions: result.cautions ?? [],
    report_date: new Date().toISOString().split("T")[0],
  };

  // 4) SAVE ANALYSIS (⭐ critical for /chat)
  await saveAnalysis(id, analysis);

  // 5) Return to Bubble + PDF generator
  return analysis;
}








