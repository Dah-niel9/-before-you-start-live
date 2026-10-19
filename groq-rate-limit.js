// Serial Groq interpretation; bounded retry for 429, never re-run Tavily.
export const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function interpretWithRateLimit(task,{sleep=wait,spacingMs=4500,maxRetries=2,maxWaitMs=65000}={}){
 const results=[];
 for(let index=0;index<task.length;index++){
  if(index>0&&spacingMs>0)await sleep(spacingMs);
  let attempts=0;
  while(true){
   try{results.push(await task[index]());break;}
   catch(error){
    if(error?.status!==429||attempts>=maxRetries)throw error;
    attempts++;
    const retryAfter=error.retryAfterSeconds;
    const ms=Math.min(maxWaitMs,Math.max(spacingMs,Number.isFinite(retryAfter)?retryAfter*1000:15000*attempts));
    await sleep(ms);
   }
  }
 }
 return results;
}
