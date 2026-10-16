import assert from "node:assert/strict";
import {FIELD_CONTRACTS} from "../worker-live.js";
import {deriveAssessments} from "../derived-assessments.js";
const core=FIELD_CONTRACTS.filter(c=>c.group==="core");
const derived=FIELD_CONTRACTS.filter(c=>c.group!=="core");
assert.equal(core.length,15);assert.equal(derived.length,7);
const verified=(answer,url,status="established")=>({answer,understanding:{status,sourceUrls:[url],missing:[],conflict:false}});
const fields={
  legitimacy:verified("Operator records confirm an active company.","https://example.org/operator"),
  nigeriaAccess:verified("Nigeria access is restricted.","https://example.org/regions"),
  startingCost:verified("An optional course costs $50; required fees are unknown.","https://example.org/costs","partially_established"),
  timeCost:verified("Work takes approximately 4 hours per week.","https://example.org/hours")
};
const output=deriveAssessments(fields,FIELD_CONTRACTS,{devices:["Android phone"]});
assert.equal(Object.keys(output).length,7);
assert.equal(output.checkLegitimacy.answer,fields.legitimacy.answer);
assert.match(output.checkAccessibility.answer,/Nigeria access: Nigeria access is restricted/);
assert.equal(output.checkAccessibility.understanding.status,"partially_established");
assert.ok(output.checkAccessibility.understanding.missing.includes("Device requirements"));
assert.equal(output.realCash.answer,fields.startingCost.answer);
assert.equal(output.realCash.understanding.status,"partially_established");
assert.equal(output.realData.answer,"No clear evidence found.");
assert.equal(output.realData.understanding.status,"not_established");
assert.deepEqual(output.realCash.understanding.sourceUrls,["https://example.org/costs"]);
assert.equal(output.checkWorthwhile.understanding.status,"partially_established");
assert.doesNotMatch(output.checkWorthwhile.answer,/Operator records/);
const noTrust=deriveAssessments({startingCost:{answer:"Free",understanding:{status:"established",sourceUrls:[]}}},FIELD_CONTRACTS);
assert.equal(noTrust.realCash.answer,"No clear evidence found.");
console.log("PASS: 15 core, 7 derived, source traceability, partial/unknown, no unsupported judgments. No API calls.");
