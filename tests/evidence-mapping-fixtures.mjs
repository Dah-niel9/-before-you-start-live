// Offline adversarial evidence contracts. No Tavily or Groq calls.
// These fixtures test source/field isolation and reject unsupported confidence.
// They do NOT certify semantic accuracy of a live model.
import assert from "node:assert/strict";
import {FIELD_CONTRACTS} from "../worker-live.js";
import {buildUnderstandingInput,validateUnderstanding} from "../understanding.js";

const cases=[
 ["opportunity","Creators plan and publish their own videos.","A company advertised 177 YouTube jobs on Indeed."],
 ["workType","The creator owns a content business supported by advertising.","An unrelated employer hires editors on salary."],
 ["nigeriaAccess","The platform's official eligibility page lists Nigeria.","A Nigerian job board advertises remote vacancies."],
 ["availability","Creators can independently open channels and publish content.","177 video editing jobs are advertised on Indeed."],
 ["device","Creators can use a smartphone or a laptop.","A premium camera is recommended but not necessary."],
 ["kyc","Identity verification is required before monetization.","An unrelated service requests a passport."],
 ["payment","The program pays eligible creators through AdSense.","A course vendor accepts credit cards."],
 ["withdrawal","Payouts are released after the payment threshold is reached.","The platform supports AdSense bank payments."],
 ["startingCost","Channel creation is free; a third-party course costs $50 optionally.","A coaching advertisement says buy now."],
 ["earnings","Revenue varies with eligible views and ad rates; no beginner amount is guaranteed.","An influencer claims they made $10000."],
 ["firstMoney","First payment depends on monetization eligibility and payout processing.","A creator says they earned money in one day."],
 ["legitimacy","The platform operates an official creator program.","Some third-party training courses are scams."],
 ["dataCost","Uploading video uses mobile data depending on file size.","Watching a stream requires a fast download speed."],
 ["timeCost","Research, scripting, editing and publishing take working time.","A viewer spends two hours watching videos."],
 ["opportunityCost","Time spent building a channel cannot be spent on other work.","An unrelated company has an open vacancy."]
];
assert.equal(cases.length,15);
assert.deepEqual(new Set(cases.map(c=>c[0])),new Set(FIELD_CONTRACTS.filter(c=>c.group==="core").map(c=>c.key)));
for(const [key,relevant,distractor] of cases){
 const contract=FIELD_CONTRACTS.find(c=>c.key===key);
 const input=buildUnderstandingInput({name:"YouTube automation",contract,packet:{key,ok:true,answer:"UNTRUSTED SEARCH SUMMARY",sources:[
  {url:"https://example.org/relevant/"+key,title:"Relevant source",content:relevant},
  {url:"https://example.org/distractor/"+key,title:"Potentially misleading source",content:distractor}
 ]}});
 assert.equal(input.field,key);
 assert.equal(input.evidence.length,2);
 assert.equal(input.evidence[0].excerpt,relevant);
 assert.equal(input.evidence[1].excerpt,distractor);
 assert.match(input.rule,/./);
 const valid={answer:relevant,status:"partially_established",supporting_sources:["s1"],missing:["Other opportunity-specific details"],conflict:false};
 assert.deepEqual(validateUnderstanding(valid,input),[]);
 assert.ok(validateUnderstanding({...valid,supporting_sources:["s99"]},input).length,"Invented source must fail: "+key);
 assert.ok(validateUnderstanding({...valid,status:"established",conflict:true,missing:[]},input).length,"Contradictory certainty must fail: "+key);
 assert.ok(validateUnderstanding({...valid,status:"established"},input).length,"Missing facts with high certainty must fail: "+key);
 assert.ok(validateUnderstanding({...valid,status:"not_established",answer:"No clear evidence found."},input).length,"Unknown field with citations must fail: "+key);
}
console.log("PASS: 15 adversarial field fixtures, source isolation and uncertainty contracts; no API calls.");
