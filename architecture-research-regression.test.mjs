import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";

const sourceText = readFileSync("./worker-live.js","utf8");
const transformed = sourceText
  .replace(/export\s+(?=(?:async\s+)?function\s+)/g, "")
  .replace("export { FIELD_CONTRACTS, answerFromPacket };","")
  .replace("export default {","const defaultExport = {")
  + "\nglobalThis.__test={answerFromPacket,NO_EVIDENCE};";

const context = { console, fetch: async () => { throw new Error("fetch should not run"); } };
vm.createContext(context);
vm.runInContext(transformed, context);

const { answerFromPacket, NO_EVIDENCE } = context.__test;

const mixed = [
  {
    url:"https://example.com/source-a",
    content:"Nigeria is available. KYC is required with government ID. Payout is by bank transfer. Minimum threshold is $20. Payments are monthly. Earnings are $5-$15 per task. A laptop is required. A camera is optional. There is no registration fee."
  },
  {
    url:"https://example.com/source-b",
    content:"The operator is established and currently operating. Nigeria is supported."
  }
];

const own = [
  ["nigeriaAccess","Nigeria is available to eligible participants."],
  ["kyc","Government ID is required for verification."],
  ["payment","Workers receive payouts by bank transfer."],
  ["withdrawal","Workers can withdraw after reaching the minimum threshold."],
  ["earnings","Workers can earn $5-$15 per task."],
  ["firstMoney","The first payment follows approval and the required payout process."],
  ["startingCost","There is no registration fee to start."],
  ["realCash","There is no registration fee or mandatory cash cost."],
  ["realTime","The work requires about 2 hours per day."],
  ["realData","The work uses about 2GB of data per week for uploads and downloads."],
  ["realOpportunity","The main tradeoff is spending time here instead of another opportunity."]
];

const mixedAnswers = [
  ["nigeriaAccess","Nigeria is available and KYC is required."],
  ["kyc","KYC is required and two-step login is also used."],
  ["payment","Workers are paid by bank transfer and the minimum withdrawal threshold is $20."],
  ["withdrawal","Workers can withdraw by bank transfer after reaching the threshold."],
  ["earnings","Workers earn $5-$15 per task and the platform makes annual revenue."],
  ["firstMoney","Payments are monthly, so first money arrives monthly."],
  ["startingCost","There is no registration fee and a camera is optional."],
  ["realCash","There is no registration fee and a camera is optional."],
  ["realTime","The work takes 2 hours per day and payments are monthly."],
];

let passed=0;
for (const [key,answer] of own) {
  const got=answerFromPacket({key,answer,sources:mixed});
  assert.equal(got,answer, key+" own-field answer was rejected: "+got);
  passed++;
}
for (const [key,answer] of mixedAnswers) {
  const got=answerFromPacket({key,answer,sources:mixed});
  assert.equal(got,NO_EVIDENCE, key+" mixed answer was accepted: "+got);
  passed++;
}
assert.equal(answerFromPacket({key:"nigeriaAccess",answer:"Nigeria is available.",sources:[
  {url:"a",content:"Nigeria is supported."},
  {url:"b",content:"Nigeria is not available."}
]}),NO_EVIDENCE);
passed++;
assert.equal(answerFromPacket({key:"nigeriaAccess",answer:"",sources:mixed}),NO_EVIDENCE);
passed++;

const single = [
  ["nigeriaAccess","Nigeria is available to eligible participants."],
  ["kyc","Government ID is required for verification."],
  ["payment","Workers receive payouts by bank transfer."],
  ["withdrawal","Workers can withdraw after reaching the minimum threshold."],
  ["earnings","Workers can earn $5-$15 per task."],
  ["firstMoney","The first payment follows approval and the required payout process."],
  ["startingCost","There is no registration fee to start."],
  ["realCash","There is no registration fee or mandatory cash cost."],
  ["realTime","The work requires about 2 hours per day."],
  ["realData","The work uses about 2GB of data per week for uploads and downloads."],
  ["realOpportunity","The main tradeoff is spending time here instead of another opportunity."]
];
for (const [key,answer] of single) {
  assert.equal(answerFromPacket({key,answer,sources:[mixed[0]]}),answer,key+" single-source answer failed");
}
console.log("PASS: syntax/runtime load + mixed-evidence regression + conflict/no-evidence + single-source isolation");
console.log("Mixed regression: 21/21 checks passed.");
console.log("Single-source isolation: 11/11 checks passed.");
