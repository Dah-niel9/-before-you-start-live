import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("./worker-live.js","utf8");
const transformed = source
  .replace(/export\s+(?=(?:async\s+)?function\s+)/g, "")
  .replace("export { FIELD_CONTRACTS, answerFromPacket };","")
  .replace("export default {","const defaultExport = {")
  + "\nglobalThis.__test={answerFromPacket,NO_EVIDENCE};";

const context = { console, fetch: async () => { throw new Error("unexpected fetch"); } };
vm.createContext(context);
vm.runInContext(transformed, context);

const { answerFromPacket, NO_EVIDENCE } = context.__test;

const mixedSources = [
  {
    url:"https://example.com/source-a",
    content:"The opportunity is available in Nigeria. The work involves completing online tasks. A laptop is required. KYC with government ID is required. Payouts are made by bank transfer. The minimum withdrawal threshold is $20. Earnings are $5-$15 per task. Payments are monthly. There is no registration fee. A camera is optional. The work uses internet data and takes about 2 hours per day."
  },
  {
    url:"https://example.com/source-b",
    content:"The operator is established and currently operating. Nigeria is supported. Users can participate after meeting the stated requirements."
  }
];

const correct = [
  ["opportunity","The person performs work for this opportunity."],
  ["workType","This is an online task-based earning activity."],
  ["nigeriaAccess","The opportunity is available to participants in Nigeria."],
  ["availability","The opportunity is currently operating and available."],
  ["device","A laptop is required to perform the work."],
  ["kyc","Government ID is required for KYC."],
  ["payment","Payouts are made by bank transfer."],
  ["withdrawal","A minimum withdrawal threshold of $20 applies."],
  ["startingCost","There is no registration fee to start."],
  ["earnings","Earnings are $5-$15 per task."],
  ["firstMoney","The first payment follows completion of the required first task and payout process."],
  ["legitimacy","The operator is established and currently operating."],
  ["dataCost","The work uses internet data."],
  ["timeCost","The work takes about 2 hours per day."],
  ["opportunityCost","The main tradeoff is spending those working hours on this opportunity instead of another activity."],
  ["checkLegitimacy","The operator is established and currently operating."],
  ["checkAccessibility","Nigeria access, device and ID requirements determine practical accessibility."],
  ["checkWorthwhile","Earnings, costs, time and availability are the main factors to consider."],
  ["realCash","There is no registration fee or mandatory starting cash cost."],
  ["realData","The work uses about 2GB of data per week for uploads and downloads."],
  ["realTime","The work takes about 2 hours per day."],
  ["realOpportunity","The main tradeoff is spending those hours on this opportunity instead of another activity."]
];

let correctCount=0;
for (const [key,answer] of correct) {
  const got=answerFromPacket({key,answer,sources:mixedSources});
  assert.equal(got,answer, "Correct answer rejected for "+key+": "+got);
  correctCount++;
}

// Neighboring-field contamination should be rejected.
const contaminated = [
  ["opportunity","The work involves online tasks and the monthly payment schedule."],
  ["nigeriaAccess","The opportunity is available in Nigeria and KYC is required."],
  ["device","A laptop is required and the camera is optional."],
  ["kyc","Government ID is required and two-step login is used."],
  ["payment","Payouts are by bank transfer and the minimum withdrawal threshold is $20."],
  ["withdrawal","The withdrawal threshold is $20 and payout is by bank transfer."],
  ["earnings","Earnings are $5-$15 per task and the platform makes annual revenue."],
  ["firstMoney","Payments are monthly, so first money arrives monthly."],
  ["startingCost","There is no registration fee and a camera is optional."],
  ["realCash","There is no registration fee and a camera is optional."],
  ["realTime","The work takes 2 hours per day and payments are monthly."],
  ["checkLegitimacy","The operator is established and earnings are $5-$15 per task."],
  ["checkAccessibility","Nigeria is supported and earnings are $5-$15 per task."]
];

let contaminationCount=0;
for (const [key,answer] of contaminated) {
  assert.equal(answerFromPacket({key,answer,sources:mixedSources}),NO_EVIDENCE,"Contamination accepted for "+key);
  contaminationCount++;
}

// True field conflict must remain unresolved.
const conflictSources = [
  {url:"https://example.com/a",content:"Nigeria is supported and available."},
  {url:"https://example.com/b",content:"Nigeria is not available and is unsupported."}
];
assert.equal(
  answerFromPacket({key:"nigeriaAccess",answer:"Nigeria is available.",sources:conflictSources}),
  NO_EVIDENCE
);

// Unrelated positive/negative statements must NOT create a false conflict.
const unrelatedConflictSources = [
  {url:"https://example.com/a",content:"Nigeria is available. KYC is required."},
  {url:"https://example.com/b",content:"The camera is optional. Nigeria is supported."}
];
assert.equal(
  answerFromPacket({key:"nigeriaAccess",answer:"Nigeria is available.",sources:unrelatedConflictSources}),
  "Nigeria is available."
);
assert.equal(
  answerFromPacket({key:"kyc",answer:"KYC is required.",sources:unrelatedConflictSources}),
  "KYC is required."
);

// Unknown opportunity / no-evidence behavior.
assert.equal(
  answerFromPacket({key:"opportunity",answer:"",sources:[]}),
  NO_EVIDENCE
);
assert.equal(
  answerFromPacket({key:"earnings",answer:"No clear evidence found.",sources:[{url:"x",content:"Nothing establishes user earnings."}]}),
  NO_EVIDENCE
);

// Every field contract must exist in the worker.
const workerText = source;
const expectedKeys = ["opportunity","workType","nigeriaAccess","availability","device","kyc","payment","withdrawal","startingCost","earnings","firstMoney","legitimacy","dataCost","timeCost","opportunityCost","checkLegitimacy","checkAccessibility","checkWorthwhile","realCash","realData","realTime","realOpportunity"];
for (const key of expectedKeys) {
  assert.ok(workerText.includes(`key:"${key}"`), "Missing field contract: "+key);
}

// The old unsafe raw-source fallback must not exist.
assert.doesNotMatch(workerText,/packet\.answer\s*=\s*cleanAnswer\(ranked\[0\]\?\.content\)/);

// Final architecture guard: all 22 contracts are present.
assert.equal(expectedKeys.length,22);

console.log("FINAL REGRESSION: PASS");
console.log("22/22 field contracts present.");
console.log(correctCount+"/22 correct field-isolation cases passed.");
console.log(contaminationCount+"/13 neighboring-field contamination cases rejected.");
console.log("Conflict handling: PASS.");
console.log("False-conflict protection: PASS.");
console.log("No-evidence handling: PASS.");
console.log("Raw-source fallback guard: PASS.");
