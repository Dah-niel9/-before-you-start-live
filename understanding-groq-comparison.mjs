// Controlled Groq-only comparison. No Tavily requests, no Worker deployment.
// Four synthetic scenarios, each tested in focused and unified modes.
// A 429 is reported as a failure, not misrepresented as a poor answer.
import {scenarios} from "./understanding-experiment-fixtures.mjs";
import {focusedPrompt,unifiedPrompt} from "./understanding-experiment.js";
import {writeFileSync,mkdirSync} from "node:fs";

const key=process.env.GROQ_API_KEY;
if(!key)throw Error("GROQ_API_KEY secret missing; no calls made");
const model="openai/gpt-oss-120b";
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const result={model,fixtureType:"synthetic (NOT verified Tavily evidence)",scenarios:[],usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0},calls:0,failures:[]};
const request=async(system,payload,tag)=>{
 const body={model,temperature:0,max_completion_tokens:900,response_format:{type:"json_object"},messages:[{role:"system",content:system},{role:"user",content:JSON.stringify(payload)}]};
 for(let attempt=0;attempt<2;attempt++){
  const response=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(response.status===429){
   const retry=Number(response.headers.get("retry-after"));
   if(attempt===0){await pause(Math.max(65000,Number.isFinite(retry)?retry*1000:0));continue;}
  }
  if(!response.ok){result.failures.push({tag,status:response.status});return {error:"HTTP "+response.status};}
  const data=await response.json();
  result.calls++;
  for(const field of ["prompt_tokens","completion_tokens","total_tokens"])result.usage[field]+=data.usage?.[field]||0;
  try{return {output:JSON.parse(data.choices[0].message.content),usage:data.usage};}
  catch{return {error:"invalid JSON"};}
 }
};
for(const scenario of scenarios){
 const fields=scenario.evidence.map(e=>e.field);
 const row={name:scenario.name,round:scenario.round,expectations:scenario.expectations,evidence:scenario.evidence,focused:{},unified:null};
 // Exactly three focused calls and one unified call per scenario, same source evidence.
 // 16 calls total; fixed upper bound, never Tavily.
 for(const e of scenario.evidence){
  row.focused[e.field]=await request(focusedPrompt(e.field),{opportunity:scenario.name,field:e.field,evidence:[e],instruction:"Return a JSON object with answer,status,supporting_sources,missing,conflict."},scenario.name+"-"+scenario.round+"-"+e.field);
  await pause(65000);
 }
 row.unified=await request(unifiedPrompt(fields),{opportunity:scenario.name,fields:fields.map(field=>({field,evidence:scenario.evidence.filter(e=>e.field===field)})),instruction:"Return a JSON object with keys equal to the field names. Each field value has answer,status,supporting_sources,missing,conflict."},scenario.name+"-"+scenario.round+"-unified");
 result.scenarios.push(row);
 console.log("Completed",scenario.name,"round",scenario.round,"; cumulative model calls",result.calls);
 await pause(65000);
}
mkdirSync("tests/artifacts",{recursive:true});
writeFileSync("tests/artifacts/understanding-comparison.json",JSON.stringify(result,null,2));
console.log("Comparison complete; responses in artifact. Calls:",result.calls,"Failures:",result.failures.length,"Tokens:",result.usage.total_tokens);
