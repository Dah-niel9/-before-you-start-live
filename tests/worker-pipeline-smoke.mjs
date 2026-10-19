// End-to-end Worker API smoke test: 15 mocked Tavily calls, 15 mocked Groq calls, 0 real credits.
import assert from "node:assert/strict";
import {handleResearch,FIELD_CONTRACTS} from "../worker-live.js";
const originalFetch=globalThis.fetch;
let tavilyCalls=0,groqCalls=0;
const inputs=[];
const evidenceByField={
 opportunity:"Workers complete online tasks for clients.",
 workType:"This is freelance task work.",
 nigeriaAccess:"Participants in Nigeria are eligible to register.",
 availability:"The platform is currently accepting new participants.",
 device:"You need a smartphone (Android or iOS) or a laptop/computer to do this work.",
 kyc:"A government ID is required for withdrawal.",
 payment:"Payouts are made by bank transfer.",
 withdrawal:"Withdrawals are processed weekly.",
 startingCost:"Registration has no mandatory fee.",
 earnings:"Workers earn per completed task.",
 firstMoney:"First payment follows approved work and the weekly payout cycle.",
 legitimacy:"The opportunity is legitimate, but some third-party courses and providers may be scams.",
 dataCost:"An internet connection is needed to perform the work.",
 timeCost:"Tasks require several hours each week.",
 opportunityCost:"Time spent on tasks cannot be used for other paid work."
};
try{
 globalThis.fetch=async(url,options)=>{
  const body=JSON.parse(options.body);
  if(String(url).includes("api.tavily.com")){
   tavilyCalls++;
   const query=body.query;
   assert.equal(body.search_depth,"advanced");
   return new Response(JSON.stringify({answer:"UNTRUSTED HINT",results:[{
    title:"Opportunity evidence",url:"https://example.org/"+tavilyCalls,
    content:"Example evidence for the named opportunity and question."}]}),{status:200});
  }
  if(String(url).includes("api.groq.com")){
   groqCalls++;
   const input=JSON.parse(body.messages[1].content);
   inputs.push(input);
   assert.equal(input.evidence.length,1);
   assert.equal(body.model,"openai/gpt-oss-120b");
   return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({
    answer:evidenceByField[input.field],status:"established",supporting_sources:["s1"],
    missing:[],conflict:false
   })}}]}),{status:200});
  }
  throw Error("Unexpected external call: "+url);
 };
 const request=new Request("https://example.org/api/research",{method:"POST",headers:{"content-type":"application/json"},
 body:JSON.stringify({name:"Example Tasks",profile:{devices:["Android phone"],ids:["NIN/National ID"],budgetLabel:"₦0"}})});
 const response=await handleResearch(request.clone(),{TAVILY_API_KEY:"mock",GROQ_API_KEY:"mock"});
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.ok,true);
 assert.equal(tavilyCalls,15,"Must make exactly 15 Tavily requests");
 assert.equal(groqCalls,15,"Must interpret all 15 core fields");
 assert.equal(new Set(inputs.map(x=>x.field)).size,15);
 assert.equal(Object.keys(data.fieldResearch).filter(k=>FIELD_CONTRACTS.some(c=>c.key===k)).length,22);
 assert.equal(data.fieldResearch.opportunity.answer,evidenceByField.opportunity);
 assert.equal(data.fieldResearch.realCash.answer,evidenceByField.startingCost);
 assert.equal(data.fieldResearch.realData.answer,evidenceByField.dataCost);
 assert.match(data.fieldResearch.checkAccessibility.answer,/Nigeria access:/);
 assert.ok(data.researchBreakdown.threeChecks.accessibility);
 assert.ok(data.researchBreakdown.realCost.evidence);
 assert.ok(Array.isArray(data.sources)&&data.sources.length===15);
 assert.deepEqual(data.failedFields,[]);
 assert.equal(data.hereDeal,evidenceByField.opportunity);
 assert.ok(data.verdict);
 assert.notEqual(data.verdict,"SKIP","Unexpected blockers: "+JSON.stringify({blockers:data.blockers,doesntFit:data.doesntFit,reason:data.whyVerdict,verdictData:data.verdictData}));
 assert.ok(!JSON.stringify(data).includes("laptop or computer is required"),"Must not falsely assert laptop requirement");
 // A direct fraud finding about the opportunity itself must still block it.
 evidenceByField.legitimacy="This opportunity is a scam.";
 const second=await handleResearch(request.clone(),{TAVILY_API_KEY:"mock",GROQ_API_KEY:"mock"});
 const secondData=await second.json();
 assert.equal(secondData.verdict,"SKIP","Direct evidence that the opportunity is a scam must trigger SKIP");
 assert.ok(secondData.blockers.some(x=>/legitimacy|fraud/i.test(x)));
 // Optional third-party courses are not a mandatory starting cost or a scam verdict.
 evidenceByField.legitimacy="Some third-party courses may be scams; the opportunity itself is legitimate.";
 evidenceByField.startingCost="Registration is free. Optional courses cost $50, but are not required.";
 const third=await handleResearch(request.clone(),{TAVILY_API_KEY:"mock",GROQ_API_KEY:"mock"});
 const thirdData=await third.json();
 assert.notEqual(thirdData.verdict,"SKIP","Optional courses must not create a zero-budget blocker");
 assert.ok(!thirdData.blockers.some(x=>/starting cost|legitimacy|fraud/i.test(x)));
 assert.ok(!/scam|fraud|course|\\$50/i.test(thirdData.biggestCatch||""),"Biggest catch must not elevate optional course scams or costs");
 // Explicit compulsory fee must still block a zero-budget profile.
 evidenceByField.startingCost="A mandatory upfront registration fee of $50 is required.";
 const fourth=await handleResearch(request.clone(),{TAVILY_API_KEY:"mock",GROQ_API_KEY:"mock"});
 const fourthData=await fourth.json();
 assert.equal(fourthData.verdict,"SKIP","Mandatory paid registration must block zero-budget users");
 assert.ok(fourthData.blockers.some(x=>/starting cost/i.test(x)));
 // Nigeria is not blocked: negated restriction must not become SKIP.
 evidenceByField.startingCost="Registration has no mandatory fee.";
 evidenceByField.nigeriaAccess="Nigerian participants are not blocked or prohibited from joining.";
 const fifth=await handleResearch(request.clone(),{TAVILY_API_KEY:"mock",GROQ_API_KEY:"mock"});
 const fifthData=await fifth.json();
 assert.notEqual(fifthData.verdict,"SKIP","Negated Nigeria restriction must not trigger SKIP");
 assert.ok(!fifthData.blockers.some(x=>/Nigeria/i.test(x)));
 // An explicit Nigerian exclusion must still block access.
 evidenceByField.nigeriaAccess="Nigeria is excluded from registration.";
 const sixth=await handleResearch(request.clone(),{TAVILY_API_KEY:"mock",GROQ_API_KEY:"mock"});
 const sixthData=await sixth.json();
 assert.equal(sixthData.verdict,"SKIP","Explicit Nigerian exclusion must trigger SKIP");
 assert.ok(sixthData.blockers.some(x=>/Nigeria/i.test(x)));
 // An optional course cannot cancel a separate mandatory registration fee.
 evidenceByField.nigeriaAccess="Participants in Nigeria are eligible to register.";
 evidenceByField.startingCost="Optional courses cost $50; however, a mandatory registration fee of $20 is required.";
 const seventh=await handleResearch(request.clone(),{TAVILY_API_KEY:"mock",GROQ_API_KEY:"mock"});
 const seventhData=await seventh.json();
 assert.equal(seventhData.verdict,"SKIP","Separate mandatory fee must block zero-budget users despite optional course");
 assert.ok(seventhData.blockers.some(x=>/starting cost/i.test(x)));
 console.log("PASS: complete Worker API, 15 Tavily + 15 Groq mocks, 22 fields, derived assessments, existing result shape; zero credits.");
}finally{globalThis.fetch=originalFetch;}
