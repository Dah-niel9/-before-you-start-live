// Serial Groq interpretation. Retry 429 before marking an individual field unavailable.
export const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function interpretWithRateLimit(tasks,{sleep=wait,spacingMs=4500,maxRetries=2,maxWaitMs=65000,onError=null}={}){
 const results=[];
 for(let index=0;index<tasks.length;index++){
  if(index>0&&spacingMs>0)await sleep(spacingMs);
  let attempts=0;
  while(true){
   try{results.push(await tasks[index]());break;}
   catch(error){
    if(error?.status===429&&attempts<maxRetries){
     attempts++;
     const retryAfter=error.retryAfterSeconds;
     const ms=Math.min(maxWaitMs,Math.max(spacingMs,Number.isFinite(retryAfter)?retryAfter*1000:15000*attempts));
     await sleep(ms);
     continue;
    }
    if(!onError)throw error;
    results.push(await onError(error,index));
    break;
   }
  }
 }
 return results;
}
