// agents/analysisAgent.ts
// ============================================================
//  ClinSynapseCloud – Lab Report Analyzer
//  OCR: EdenAI  +  Interpretation: OpenAI (GPT-4o-mini)
//  + Built-in lab normalization dictionary with typical ranges
// ============================================================

import "jsr:@std/dotenv/load";
import OpenAI from "https://deno.land/x/openai@v4.24.1/mod.ts";

const EDENAI_API_KEY = Deno.env.get("EDENAI_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

// ------------------------------------------------------------
// Lab Dictionary Types
// ------------------------------------------------------------
type LabEntry = {
  key: string;            // canonical lowercase key
  canonicalName: string;  // display name
  aliases: string[];      // all the messy ways labs write it
  category: string;       // panel / system
  typicalUnits?: string;
  refLow?: number;        // typical adult range (approximate)
  refHigh?: number;
  refText?: string;       // when numeric range is not enough / sex-specific
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
// OCR using EdenAI (supports any PDF format)
// -------------------------------------------------------------
async function extractTextWithEdenAI(filePath: string): Promise<string> {
  const pdfBytes = await Deno.readFile(filePath);

  const form = new FormData();

  // Single primary provider
  form.append("providers", "google");
  // Optional fallbacks
  form.append("fallback_providers", "microsoft");
  form.append("fallback_providers", "amazon");

  form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "lab.pdf");

  const res = await fetch("https://api.edenai.run/v2/ocr/ocr", {
    method: "POST",
    headers: { Authorization: `Bearer ${EDENAI_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("❌ EdenAI OCR error:", err);
    throw new Error("EdenAI OCR failed");
  }

  const data = await res.json();

  let merged = "";
  for (const provider in data) {
    if (data[provider]?.text) merged += data[provider].text + "\n";
  }

  return merged.trim();
}

// ============================================================
// GPT-4o-mini Interpretation using Dictionary + Ranges
// ============================================================

async function runLLMAnalysis(text: string): Promise<any> {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const dictJson = JSON.stringify(LAB_DICTIONARY_FOR_PROMPT);

  const prompt = `
You are a clinical laboratory interpretation system.

You are given:
1) A lab report as free text (possibly messy OCR).
2) A JSON lab dictionary describing canonical names, aliases, categories,
   and typical adult reference ranges.

Your job:
- Normalize lab test names using the dictionary.
- Infer the most likely units if missing, using the dictionary.
- Determine if each value is LOW, NORMAL, or HIGH against typical ranges.
- Be explicit when reference ranges are sex/age dependent or lab-dependent.
- Then generate a clear, friendly explanation for a layperson.

IMPORTANT:
- When in doubt, clearly say "range varies by lab / population".
- DO NOT give diagnosis. Focus on patterns, risk, and follow-up suggestions.
- ALWAYS return STRICT JSON ONLY.

Lab dictionary (JSON):
${dictJson}

Lab report text:
${text}

Return STRICT JSON only in this shape:

{
  "normalized_labs": [
    {
      "name": "Hemoglobin A1c",
      "category": "Diabetes / Glycemic Control",
      "value": 5.9,
      "units": "%",
      "status": "borderline_high", // one of: low, normal, high, borderline_high, unclear
      "ref_range": "< 5.7% typical non-diabetic",
      "comment": "Short comment about what this means"
    }
  ],
  "summary": "High-level narrative summary for the patient.",
  "overall_pattern": "e.g., Prediabetes pattern, possible metabolic syndrome, etc.",
  "recommendations": [
    "1–2 sentence actionable suggestions (lifestyle, questions to ask clinician, and when to seek urgent care)."
  ],
  "cautions": [
    "Important disclaimers and 'this is not a diagnosis' language."
  ]
}
`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  const content = completion.choices[0].message?.content ?? "{}";

  try {
    return JSON.parse(content);
  } catch (err) {
    console.error("❌ JSON parse failed, returning raw content:", err);
    return {
      summary: content,
      normalized_labs: [],
      recommendations: [],
      cautions: [
        "Model returned non-JSON content; parsing failed. Upstream logic should handle this gracefully.",
      ],
    };
  }
}

// ============================================================
// MAIN ANALYZER – exported function used by server/http.ts
//  • NO PDF GENERATION HERE
//  • Returns JSON only (id, summary, key_insights, tests)
// ============================================================

export async function analysisAgent(fileBytes: Uint8Array, filename: string) {
  console.log("🧠 Starting analysisAgent with uploaded file...");

  // 1. Save uploaded file to /tmp
  const tempPath = `/tmp/${crypto.randomUUID()}-${filename}`;
  await Deno.writeFile(tempPath, fileBytes);

  console.log(`📄 Saved uploaded file to: ${tempPath}`);

  // 2. OCR → extract text
  const extractedText = await extractTextWithEdenAI(tempPath);

  // 3. Run the LLM interpretation
  const result = await runLLMAnalysis(extractedText);

  const id = crypto.randomUUID();

  return {
    id,
    extractedText,
    summary: result.summary ?? "",
    key_insights: result.keyInsights ?? result.key_insights ?? [],
    tests: result.normalized_labs ?? [],
    patient_name: result.patient_name ?? "Patient",
  };
}





