// Explicitly opted-in, isolated live test. No deployment, no Cloudflare access.
// Exactly one Worker API request, with 15 core Tavily searches.
import {handleResearch,FIELD_CONTRACTS} from "../worker-live.js";
import {writeFile,mkdir} from "node:fs/promises";
const tavily=process.env.TAVILY_TEST_API_KEY;
const groq=process.env.GROQ_API_KEY;
const name=process.env.TEST_OPPORTUNITY?.trim();
if(process.env.CONFIRM_LIVE_RESEARCH!=="YES_15_ADVANCED_SEARCHES")throw Error("Explicit 15-search confirmation missing.");
if(!tavily||!groq)throw Error("TAVILY_TEST_API_KEY and GROQ_API_KEY must be configured as GitHub Actions secrets.");
if(!name||name.length>110)throw Error("TEST_OPPORTUNITY must be 1–110 characters.");
if(FIELD_CONTRACTS.filter(c=>c.group==="core").length!==15)throw Error("Research count changed; refusing to run.");
const request=new Request("https://example.invalid/api/research",{method:"POST",headers:{"content-type":"application/json"},
 body:JSON.stringify({name,claim:"",url:"",profile:{country:"Nigeria",devices:["Android phone"],ids:["None"],budgetLabel:"₦0"}})});
const response=await handleResearch(request,{TAVILY_API_KEY:tavily,GROQ_API_KEY:groq});
const result=await response.json();
if(!response.ok||!result.ok)throw Error("Research failed: "+String(result.error||result.detail||response.status).slice(0,180));
const expected=FIELD_CONTRACTS.map(c=>c.key);
if(expected.some(k=>!result.fieldResearch?.[k]))throw Error("Missing expected field(s)");
const report={
 opportunity:name,
 note:"One real research run. AI interpretations are not independent verification of cited pages.",
 coreSearches:15,derivedAssessments:7,
 verdict:result.verdict,confidence:result.confidence,reason:result.reason,
 failedFields:result.failedFields,
 fields:Object.fromEntries(expected.map(key=>[key,{
  answer:result.fieldResearch[key].answer,
  understanding:result.fieldResearch[key].understanding||null
 }])),
 sources:result.sources?.map(s=>({url:s.url,title:s.title,researchKeys:s.researchKeys}))||[],
 resultShape:{hereDeal:result.hereDeal,threeChecks:result.researchBreakdown?.threeChecks,realCost:result.researchBreakdown?.realCost}
};
await mkdir("tests/artifacts",{recursive:true});
await writeFile("tests/artifacts/live-research-report.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({event:"live_research_completed",coreSearches:15,derived:7,fields:expected.length,
 failedFields:result.failedFields?.map(f=>f.key),verdict:result.verdict,
 report:"tests/artifacts/live-research-report.json"}));
if(result.failedFields?.length)process.exitCode=1;
