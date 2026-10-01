import assert from "node:assert/strict";
import { handleResearch } from "./worker-live.js";

const opportunity = {
  name: "YouTube Automation",
  claim: "Running a YouTube channel using outsourced or automated content production, with the goal of earning money from the channel.",
  profile: {
    devices: ["Phone", "Laptop"],
    budgetLabel: "₦0",
    experience: "Beginner",
    time: "Part-time",
    goals: ["Fast Money"]
  }
};

const request = new Request("https://test.local/api/research", {
  method: "POST",
  headers: {"content-type":"application/json"},
  body: JSON.stringify(opportunity)
});

const response = await handleResearch(request, {TAVILY_API_KEY: process.env.TAVILY_API_KEY});
const data = await response.json();

assert.equal(response.status, 200, JSON.stringify(data));
assert.equal(data.ok, true, JSON.stringify(data));
assert.equal(Object.keys(data.fieldResearch || {}).filter(k => k !== "biggestCatch").length, 22);
assert.ok(data.verdict, "Expected a verdict");
assert.ok(data.hereDeal, "Expected Here’s the deal / research answer");
assert.ok(data.reason, "Expected Why this verdict");
assert.ok(data.researchBreakdown, "Expected research breakdown");

console.log("FULL_RESEARCH_PIPELINE_YOUTUBE_AUTOMATION");
console.log(JSON.stringify({
  verdict: data.verdict,
  confidence: data.confidence,
  hereDeal: data.hereDeal,
  reason: data.reason,
  biggestCatch: data.researchBreakdown?.biggestCatch?.evidence,
  blockers: data.blockers,
  changes: data.changes,
  fieldResearch: Object.fromEntries(Object.entries(data.fieldResearch).map(([key, value]) => [key, {
    answer: value.answer,
    sourceCount: value.sourceCount
  }]))
}, null, 2));
console.log("FULL RESEARCH PIPELINE PASSED: 22 fields -> verdict/result generated.");
