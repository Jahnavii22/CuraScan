export function parseExtractedValues(text) {
  if (!text) return [];

  const s = text.replace(/\r\n/g, "\n").replace(/\u00A0/g, " ");
  const tests = [
    { key: "Hemoglobin", names: ["Hemoglobin", "Hemoglobin \\(g/dL\\)"] },
    { key: "RBC", names: ["RBC", "RBC \\(10\\^6/µL\\)"] },
    { key: "WBC", names: ["WBC"] },
    { key: "Platelets", names: ["Platelets"] },
    { key: "Hematocrit", names: ["Hematocrit"] },
    { key: "MCV", names: ["MCV"] },
    { key: "MCH", names: ["MCH"] },
    { key: "MCHC", names: ["MCHC"] },
    { key: "Neutrophils", names: ["Neutrophils"] },
    { key: "Lymphocytes", names: ["Lymphocytes"] },
    { key: "Fasting Glucose", names: ["Fasting Glucose"] },
    { key: "Urea", names: ["Urea"] },
    { key: "Creatinine", names: ["Creatinine"] },
    { key: "Sodium", names: ["Sodium"] },
    { key: "Potassium", names: ["Potassium"] },
    { key: "ALT", names: ["ALT"] },
    { key: "AST", names: ["AST"] },
  ];

  const lines = s.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const found = [];

  for (const l of lines) {
    for (const t of tests) {
      for (const nm of t.names) {
        const re = new RegExp(`${nm}`, "i");
        if (re.test(l)) {
          const nums = Array.from(l.matchAll(/([0-9]+(?:\.[0-9]+)?)/g), m => parseFloat(m[1]));
          const rangeMatch = l.match(/([0-9]+(?:\.[0-9]+)?)\s*[-–]\s*([0-9]+(?:\.[0-9]+)?)/);
          let refLower = null, refUpper = null;
          if (rangeMatch) {
            refLower = parseFloat(rangeMatch[1]);
            refUpper = parseFloat(rangeMatch[2]);
          }
          let value = null;
          if (nums.length > 0) value = nums[0];
          found.push({
            test: t.key,
            line: l,
            value,
            ref_lower: refLower,
            ref_upper: refUpper
          });
          break;
        }
      }
    }
  }

  // dedup
  const dedup = [];
  const seen = new Set();
  for (const f of found) {
    if (!seen.has(f.test)) {
      dedup.push(f);
      seen.add(f.test);
    }
  }
  return dedup;
}
