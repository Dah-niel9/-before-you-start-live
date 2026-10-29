import test from "node:test";
import assert from "node:assert/strict";
import {scenarios} from "./understanding-experiment-fixtures.mjs";
import {focusedPrompt,unifiedPrompt,SIMPLE_RULES} from "./understanding-experiment.js";
import {UNDERSTANDING_SYSTEM} from "./understanding.js";

test("four scenarios: two opportunities and two rounds each",()=>{
 assert.equal(scenarios.length,4);
 for(const name of ["YouTube automation","Forex trading"])assert.deepEqual(scenarios.filter(s=>s.name===name).map(s=>s.round),[1,2]);
});
test("both candidate approaches receive identical evidence and field-specific questions",()=>{
 for(const scenario of scenarios){
  const fields=scenario.evidence.map(e=>e.field);
  const unified=unifiedPrompt(fields);
  assert.ok(unified.includes(SIMPLE_RULES));
  for(const field of fields){
   assert.ok(unified.includes(field+":"));
   assert.ok(focusedPrompt(field).includes(SIMPLE_RULES));
   assert.ok(scenario.expectations[field]);
  }
  console.log(scenario.name,"round",scenario.round,":",fields.length,"synthetic fields; focused prompt chars",fields.map(f=>focusedPrompt(f).length).reduce((a,b)=>a+b,0),"unified prompt chars",unified.length);
 }
});
test("simplified candidate prompts are shorter than repeated legacy instructions",()=>{
 for(const scenario of scenarios){
  const fields=scenario.evidence.map(e=>e.field);
  const oldInstructions=UNDERSTANDING_SYSTEM.length*fields.length;
  const newInstructions=fields.map(f=>focusedPrompt(f).length).reduce((a,b)=>a+b,0);
  assert.ok(newInstructions<oldInstructions);
 }
});
test("experiment is offline only; model answer quality remains unmeasured",()=>{
 assert.equal(scenarios.reduce((n,s)=>n+s.evidence.length,0),12);
 // Prompt size is measurable offline. Actual accuracy, rate limits and token usage are not.
 console.log("NOT AN AI WINNER: no Groq calls, no Tavily calls, no measured model answers.");
});
