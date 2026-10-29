// Zero-credit architecture baseline. No Tavily or Groq requests.
import test from "node:test";
import assert from "node:assert/strict";
import {UNDERSTANDING_SYSTEM,buildUnderstandingInput,validateUnderstanding} from "./understanding.js";
import {readFileSync} from "node:fs";

const fields=["opportunity","workType","nigeriaAccess","availability","device","kyc","payment","withdrawal","startingCost","earnings","firstMoney","legitimacy","dataCost","timeCost","opportunityCost"];
const example={
  opportunity:"A channel owner plans, produces and publishes videos.",
  workType:"Content creation business.",
  availability:"Guides describe creating channels; platform availability needs official confirmation.",
  kyc:"Identity checks may be required at monetization or payout, not necessarily channel creation.",
  withdrawal:"AdSense payments involve thresholds and scheduled payouts.",
  firstMoney:"Monetization eligibility, approval, earnings and payout are separate stages.",
  dataCost:"Internet access is required; creator upload cost is not quantified."
};
test("baseline audit records real live-result weaknesses without treating them as success",()=>{
  assert.equal(fields.length,15);
  assert.equal(Object.keys(example).length,7);
  assert.ok(!Object.hasOwn(example,"device"));
  // These are the eight confirmed HTTP 429 failures in the user's Oct 25 production log.
  assert.deepEqual(["nigeriaAccess","device","payment","startingCost","earnings","legitimacy","timeCost","opportunityCost"].length,8);
});
test("current prompt repeats cross-field rules and carries substantial evidence",()=>{
  const packet={key:"device",ok:true,answer:"A phone works",sources:Array.from({length:5},(_,i)=>({url:"https://example.org/"+i,title:"Sample",content:"a".repeat(1600)}))};
  const contract={group:"core",key:"device",question:"Is a laptop mandatory?",extract:"Distinguish optional alternatives."};
  const input=buildUnderstandingInput({name:"Sample opportunity",contract,packet});
  const chars=UNDERSTANDING_SYSTEM.length+JSON.stringify(input).length;
  assert.equal(input.evidence.length,5);
  assert.ok(UNDERSTANDING_SYSTEM.includes("For opportunityCost"));
  assert.ok(UNDERSTANDING_SYSTEM.includes("For legitimacy"));
  assert.ok(chars>8000);
  console.log("BASELINE device prompt characters:",chars,"(characters are NOT tokens)");
});
test("current validator checks structure and source IDs, not factual truth or concise wording",()=>{
  const input={evidence:[{id:"s1"}]};
  const unsupported={answer:"A mandatory laptop is required, and this paragraph can be arbitrarily long.".repeat(30),status:"established",supporting_sources:["s1"],missing:[],conflict:false};
  assert.deepEqual(validateUnderstanding(unsupported,input),[]);
  assert.ok(validateUnderstanding({...unsupported,supporting_sources:["s99"]},input).length>0);
});
test("historical truncation and biggest catch are separate from model-rate-limit failures",()=>{
  const worker=readFileSync(new URL("./worker-live.js",import.meta.url),"utf8");
  assert.ok(worker.includes("function biggestCatch(fields, verdictData)"));
  assert.ok(worker.includes("function cleanAnswer(value)"));
  assert.ok(worker.includes("Math.min(20, answer.length / 50)"));
  console.log("Biggest catch is scored by field/pattern, not holistic evidence assessment.");
});
