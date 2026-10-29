// Phase 3 controlled comparison. Saved evidence only. One Groq request at a time.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fieldKeys,groups,packet,normalize,contract} from './phase3-offline-harness.mjs';
const apiKey=process.env.GROQ_API_KEY;
if(!apiKey)throw Error('Missing GROQ_API_KEY');
const archive=JSON.parse(await readFile('saved-evidence/unified-15-real-evidence.json','utf8'));
const model='openai/gpt-oss-120b';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const file='tests/artifacts/phase3-controlled-results.json';
await mkdir('tests/artifacts',{recursive:true});
let report={model,archive:'40426461024',sharedContract:contract,requests:[],completed:false};
try{report=JSON.parse(await readFile(file,'utf8'));}catch{}
const save=()=>writeFile(file,JSON.stringify(report,null,2)+'\n');
const methods=['grouped','individual'];
for(const opportunity of archive.opportunities){
 for(const method of methods){
  const batches=method==='grouped'?groups:fieldKeys.map(k=>[k]);
  for(let index=0;index<batches.length;index++){
   const keys=batches[index];
   const id=opportunity.name+'|'+method+'|'+index;
   if(report.requests.some(x=>x.id===id&&x.valid))continue;
   const fields=keys.map(k=>packet(opportunity,k));
   const input={opportunity:opportunity.name,fields};
   let succeeded=false;
   for(let attemptNo=1;attemptNo<=3&&!succeeded;attemptNo++){
    // One process, no concurrent requests. 95s between every attempt, including retries.
    if(report.requests.length)await pause(95000);
    const started=new Date().toISOString();
    let item={id,opportunity:opportunity.name,method,index,keys,started,attemptNo,valid:false};
    try{
     const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
      body:JSON.stringify({model,temperature:0,max_completion_tokens:method==='grouped'?2200:1250,
       response_format:{type:'json_object'},
       messages:[{role:'system',content:contract+(attemptNo>1?' IMPORTANT: Output exactly one valid JSON object with a fields object, no markdown, no extra commentary.':'')},{role:'user',content:JSON.stringify(input)}]})
     });
     item.httpStatus=res.status;
     const raw=await res.text();
     if(!res.ok){item.error=raw.slice(0,2500);item.retryAfter=res.headers.get('retry-after');}
     else{
      const body=JSON.parse(raw);item.usage=body.usage;
      item.rawResponse=body.choices?.[0]?.message?.content||'';
      const answers=normalize(item.rawResponse,keys);
      const allowed=new Set(fields.flatMap(f=>f.evidence.map(e=>e.id)));
      for(const [key,answer] of Object.entries(answers)){
       if(answer.supporting_sources.some(s=>!allowed.has(s)))throw Error('Invented source ID for '+key);
      }
      item.answers=answers;item.valid=true;succeeded=true;
     }
    }catch(error){item.error=String(error);}
    report.requests.push(item);await save();
    console.log(JSON.stringify({id,attemptNo,httpStatus:item.httpStatus,valid:item.valid,tokens:item.usage?.total_tokens,error:item.error?.slice(0,180)}));
    if(!succeeded&&![400,429,503].includes(item.httpStatus))break;
   }
   if(!succeeded){report.completed=false;await save();throw Error('Failed request '+id+'; saved all responses');}
  }
 }
}
report.completed=true;await save();
console.log('PASS: '+report.requests.filter(x=>x.valid).length+' valid requests, 30 fields per architecture, no Tavily requests.');
