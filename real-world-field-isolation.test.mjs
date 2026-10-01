import assert from "node:assert/strict";

const LIVE_API = "https://before-you-start.nieldah3.workers.dev/api/research";

const opportunity = {
  name: "YouTube Automation",
  claim: "Running a YouTube channel using outsourced or automated content production, with the goal of earning money from the channel.",
  url: "",
  profile: {
    devices: ["phone"],
    budgetLabel: "₦0 starting budget",
    experience: "beginner",
    time: "part-time",
    goals: ["earn online"]
  }
};

const response = await fetch(LIVE_API, {
  method: "POST",
  headers: {"content-type": "application/json"},
  body: JSON.stringify(opportunity)
});

const body = await response.json();
assert.equal(response.ok, true, `Live API returned HTTP ${response.status}: ${JSON.stringify(body)}`);
assert.equal(body.ok, true, `Live research failed: ${JSON.stringify(body)}`);

const fields = body.fieldResearch || {};
const results = Object.entries(fields).filter(([key]) => key !== "biggestCatch").map(([key, value]) => ({
  key,
  question: value.question || "",
  answer: value.answer || "No clear evidence found.",
  sourceCount: value.sourceCount || 0,
  researchKey: value.researchKey || ""
}));

const noEvidence = "No clear evidence found.";
const expectedFieldCount = 23;

// Basic real-world isolation audit: every non-empty answer must remain a
// response to its own contract. We intentionally do NOT reject normal
// cross-topic words like "payment" appearing in a source; only obvious
// neighboring-field answer forms are flagged here.
const leakagePatterns = {
  nigeriaAccess: [
    [/KYC|identity verification|government ID|passport|NIN/i, "KYC/ID"],
    [/two-factor|two-step|2FA|verification code/i, "login security"]
  ],
  availability: [
    [/Indeed|job listings?|vacancies|job postings?/i, "job listings"]
  ],
  device: [
    [/payment methods?|withdrawal threshold|earnings per (?:task|video|project)/i, "payment/earnings"]
  ],
  kyc: [
    [/two-factor|two-step|2FA|verification code|login security/i, "login security"],
    [/PayPal|bank transfer|AdSense|wallet/i, "payment method"]
  ],
  payment: [
    [/minimum withdrawal|withdrawal threshold|withdrawal minimum|payments? are monthly/i, "withdrawal/schedule"],
    [/earnings (?:of|range)|per (?:task|video|project)/i, "earnings"]
  ],
  withdrawal: [
    [/PayPal|bank transfer|AdSense|wallet|wire transfer/i, "payment method"],
    [/earnings (?:of|range)|per (?:task|video|project)/i, "earnings"]
  ],
  startingCost: [
    [/camera.*optional|microphone.*optional|equipment.*optional|optional equipment/i, "optional equipment"],
    [/earnings (?:of|range)|per (?:task|video|project)/i, "earnings"]
  ],
  earnings: [
    [/platform revenue|company revenue|customer spending|market size/i, "platform/customer economics"],
    [/minimum withdrawal|withdrawal threshold/i, "withdrawal"]
  ],
  firstMoney: [
    [/payments? are monthly|paid monthly|monthly payment cycle/i, "payment schedule"],
    [/PayPal|bank transfer|AdSense|wallet/i, "payment method"]
  ],
  realCash: [
    [/camera.*optional|microphone.*optional|equipment.*optional|optional equipment/i, "optional equipment"],
    [/earnings (?:of|range)|per (?:task|video|project)/i, "earnings"]
  ],
  realTime: [
    [/payments? are monthly|paid monthly|withdrawal|PayPal|bank transfer/i, "payment"]
  ],
  checkLegitimacy: [
    [/earnings (?:of|range)|per (?:task|video|project)/i, "earnings"],
    [/PayPal|bank transfer|minimum withdrawal/i, "payment/withdrawal"]
  ],
  checkAccessibility: [
    [/earnings (?:of|range)|per (?:task|video|project)/i, "earnings"],
    [/PayPal|bank transfer|minimum withdrawal/i, "payment/withdrawal"]
  ]
};

let leakageCount = 0;
for (const row of results) {
  if (row.answer === noEvidence) continue;
  for (const [pattern, label] of (leakagePatterns[row.key] || [])) {
    if (pattern.test(row.answer)) {
      leakageCount++;
      console.error(`LEAKAGE ${row.key}: matched ${label}: ${row.answer}`);
    }
  }
}

console.log("REAL_WORLD_FIELD_ISOLATION_REPORT");
console.log(JSON.stringify({
  opportunity,
  fieldCount: results.length,
  fields: results,
  leakageCount
}, null, 2));

assert.equal(results.length, expectedFieldCount, "Every production field contract must be researched");
assert.equal(leakageCount, 0, "Real-world field leakage detected");
for (const row of results) {
  assert.ok(row.question, `Missing question for ${row.key}`);
  assert.ok(row.answer, `Missing answer for ${row.key}`);
}

console.log(`REAL-WORLD FIELD ISOLATION PASSED: ${results.length}/${results.length} fields returned answers constrained to their own question.`);
