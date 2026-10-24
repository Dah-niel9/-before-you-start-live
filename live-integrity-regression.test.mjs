import test from "node:test";
import assert from "node:assert/strict";
import { mandatoryComputerOnly } from "./worker-live.js";

test("phone-supported research must not trigger a laptop blocker",()=>{
  assert.equal(mandatoryComputerOnly("You only need a smartphone. No laptop or desktop is required."),false);
  assert.equal(mandatoryComputerOnly("A smartphone or laptop is sufficient."),false);
  assert.equal(mandatoryComputerOnly("No computer is required."),false);
});
test("explicit mandatory laptop remains a blocker",()=>{
  assert.equal(mandatoryComputerOnly("A laptop is required to participate."),true);
  assert.equal(mandatoryComputerOnly("A desktop computer is mandatory."),true);
});

import { interpretWithRateLimit } from "./groq-rate-limit.js";

test("429 is retried without rerunning research or losing the field",async()=>{
 let calls=0;
 const result=await interpretWithRateLimit([async()=>{calls++;if(calls===1)throw Object.assign(new Error("rate limit"),{status:429,retryAfterSeconds:1});return "verified";}],{sleep:async()=>{},spacingMs:0,maxRetries:1,maxWaitMs:10000});
 assert.equal(calls,2);
 assert.deepEqual(result,["verified"]);
});
test("one exhausted field does not discard later fields",async()=>{
 let next=0,failed=[];
 const result=await interpretWithRateLimit([
  async()=>{throw Object.assign(new Error("rate limit"),{status:429});},
  async()=>{next++;return "next verified field";}
 ],{sleep:async()=>{},spacingMs:0,maxRetries:1,maxWaitMs:10000,onError:(error,index)=>{failed.push(index);return "No clear evidence found.";}});
 assert.equal(next,1);
 assert.deepEqual(failed,[0]);
 assert.deepEqual(result,["No clear evidence found.","next verified field"]);
});
