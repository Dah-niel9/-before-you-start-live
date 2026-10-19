import assert from "node:assert/strict";
import {interpretWithRateLimit} from "../groq-rate-limit.js";
let sleeps=[],calls=0;
const tasks=[
 async()=>{calls++;if(calls<3)throw Object.assign(new Error("429"),{status:429,retryAfterSeconds:2});return "first";},
 async()=>{calls++;return "second";}
];
const result=await interpretWithRateLimit(tasks,{sleep:async ms=>sleeps.push(ms),spacingMs:1000,maxRetries:2});
assert.deepEqual(result,["first","second"]);
assert.equal(calls,4);
assert.deepEqual(sleeps,[2000,2000,1000]);
let failure;
try{await interpretWithRateLimit([async()=>{throw Object.assign(new Error("429"),{status:429})}],{sleep:async()=>{},spacingMs:0,maxRetries:1});}
catch(e){failure=e;}
assert.equal(failure?.status,429);
console.log("PASS: serial Groq pacing, Retry-After 429 recovery, bounded failure; zero API calls.");
