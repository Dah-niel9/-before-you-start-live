// Experimental prompts only. Never imported by the production Worker.
// One shared evidence standard; field definitions remain specific.
export const SIMPLE_RULES = [
  "Answer only the requested question about the named opportunity.",
  "Use only relevant source excerpts; do not turn hints or examples into established facts.",
  "State confirmed facts, partial facts and unknowns separately.",
  "Use short plain English and cite source IDs for factual claims."
].join("\n");
export const FIELD_NOTES = {
  startingCost:"Separate mandatory costs from optional tools, courses or purchases.",
  device:"Separate devices required to start from optional or advanced equipment.",
  kyc:"Separate requirements to start from requirements to monetize or withdraw.",
  nigeriaAccess:"Do not confuse Nigeria with Niger; verify country-specific rules.",
  payment:"Distinguish how earnings are paid from withdrawal thresholds.",
  withdrawal:"Distinguish payout method, threshold and timing.",
  firstMoney:"Separate earning eligibility, earning and actual receipt of money.",
  earnings:"Do not present examples as typical or guaranteed income.",
  legitimacy:"Distinguish genuine activity from scams involving promoters.",
  availability:"Distinguish an independently startable activity from an open job.",
  dataCost:"Separate creator costs from viewer bandwidth.",
  opportunityCost:"Describe tradeoffs without inventing quantified losses."
};
export const OUTPUT_RULE = "Return JSON for each requested field: answer, status (established, partially_established, not_established), supporting_sources, missing, conflict. Use 'No clear evidence found.' when unsupported.";
export function focusedPrompt(field){return [SIMPLE_RULES,FIELD_NOTES[field]||"",OUTPUT_RULE].filter(Boolean).join("\n");}
export function unifiedPrompt(fields){return [SIMPLE_RULES,"Answer each of these questions separately using its own evidence. Do not transfer facts between fields.",...fields.map(f=>f+": "+(FIELD_NOTES[f]||"Answer this field's question.")),OUTPUT_RULE].join("\n");}
