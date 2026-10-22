import assert from "node:assert/strict";
import {FIELD_CONTRACTS} from "../worker-live.js";
import {buildUnderstandingInput,validateUnderstanding,understandCoreField,UNDERSTANDING_SYSTEM} from "../understanding.js";
const core=FIELD_CONTRACTS.filter(f=>f.group==="core");
assert.equal(core.length,15);
const contract=core.find(f=>f.key==="startingCost");
const packet={key:"startingCost",ok:true,answer:"You must pay $50",sources:[
  {title:"Optional training",url:"https://example.org/training",content:"An optional course costs $50."},
  {title:"Irrelevant",url:"https://example.org/earnings",content:"A freelancer could earn $200 monthly."}
]};
const input=buildUnderstandingInput({name:"Example platform",contract,packet});
assert.equal(input.evidence.length,2);
assert.match(input.rule,/mandatory or optional/i);
assert.deepEqual(validateUnderstanding({answer:"The $50 course is optional; other required costs are unknown.",status:"partially_established",supporting_sources:["s1"],missing:["Other mandatory costs"],conflict:false},input),[]);
assert.ok(validateUnderstanding({answer:"Costs $50",status:"established",supporting_sources:["s9"],missing:[],conflict:false},input).length);
let calls=0;
const fetcher=async (url,options)=>{
  calls++;assert.match(url,/api.groq.com/);
  const request=JSON.parse(options.body);
  assert.equal(request.model,"openai/gpt-oss-120b");
  assert.match(request.messages[1].content,/optional course/);
  return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({
    answer:"The $50 course is optional; mandatory costs are unknown.",status:"partially_established",
    supporting_sources:["s1"],missing:["Required costs"],conflict:false})}}]})};
};
const result=await understandCoreField({name:"Example platform",contract,packet,apiKey:"offline-test-key",fetcher});
assert.equal(calls,1);assert.equal(result.status,"partially_established");
assert.deepEqual(result.sourceUrls,["https://example.org/training"]);
// Regression for controlled live test #4: preserve a sourced answer instead of erasing it.
const inconsistentFetcher=async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({
 answer:"Creators coordinate outsourced scripting, editing, and publishing.",status:"established",
 supporting_sources:["s1"],missing:["Exact workflow varies"],conflict:false
})}}]})});
const repaired=await understandCoreField({name:"Example platform",contract,packet,apiKey:"offline-test-key",fetcher:inconsistentFetcher});
assert.equal(repaired.status,"partially_established");
assert.match(repaired.answer,/Creators coordinate/);
assert.equal(repaired.sourceUrls.length,1);
assert.deepEqual(repaired.missing,["Exact workflow varies"]);
const empty=await understandCoreField({name:"Example platform",contract,packet:{...packet,sources:[]},apiKey:"offline-test-key",fetcher});
assert.equal(empty.status,"not_established");assert.equal(calls,1);
// Guard the interpretation contract: warnings about optional third parties are not opportunity facts.
assert.match(UNDERSTANDING_SYSTEM,/identify the subject of each claim/i);
assert.match(UNDERSTANDING_SYSTEM,/MUST NOT lower the opportunity's legitimacy status/i);
assert.match(UNDERSTANDING_SYSTEM,/Do not treat unrelated negative claims as a conflict/i);
const legitimacy=core.find(f=>f.key==="legitimacy");
const thirdPartyOnly=buildUnderstandingInput({name:"Video channel creation",contract:legitimacy,packet:{
 key:"legitimacy",answer:"A course seller is a scam",sources:[
 {title:"Course review",url:"https://example.org/course",content:"An optional coaching seller deceived buyers; no claim about creating video channels."}
 ]}});
assert.equal(thirdPartyOnly.field,"legitimacy");
assert.deepEqual(validateUnderstanding({answer:"No clear evidence found.",status:"not_established",supporting_sources:[],missing:["Direct evidence about video channel creation"],conflict:false},thirdPartyOnly),[]);
assert.ok(validateUnderstanding({answer:"The opportunity is fraudulent",status:"established",supporting_sources:["s1"],missing:[],conflict:true},thirdPartyOnly).length);
// Cross-opportunity regression: rules are generic, never tied to one named test case.
const opportunityCost=core.find(f=>f.key==="opportunityCost");
assert.ok(opportunityCost);
for(const name of ["Fiverr freelancing","Affiliate marketing","Remote customer support","Video channel creation"]){
 const legitInput=buildUnderstandingInput({name,contract:legitimacy,packet:{key:"legitimacy",sources:[
  {title:"Operator documentation",url:"https://example.org/operator",content:"The operator provides an established service."},
  {title:"Individual outcome",url:"https://example.org/story",content:"One participant earned nothing despite trying."}
 ]}});
 assert.equal(legitInput.evidence.length,2);
 const costInput=buildUnderstandingInput({name,contract:opportunityCost,packet:{key:"opportunityCost",sources:[
  {title:"Tool convenience",url:"https://example.org/tool",content:"A tool makes tasks quicker."},
  {title:"Workload",url:"https://example.org/work",content:"Participants spend several hours a week."}
 ]}});
 assert.equal(costInput.evidence.length,2);
}
assert.match(UNDERSTANDING_SYSTEM,/does not contradict evidence that an operator or activity exists/i);
assert.match(UNDERSTANDING_SYSTEM,/Only set conflict when credible evidence directly disagrees/i);
assert.match(UNDERSTANDING_SYSTEM,/NOT by itself evidence of opportunity cost/i);
assert.match(UNDERSTANDING_SYSTEM,/do not claim a quantified opportunity cost/i);
console.log("PASS: 15 core contracts, field-specific input, source-ID validation, mocked Groq call, fail-closed empty evidence. No API requests.");
