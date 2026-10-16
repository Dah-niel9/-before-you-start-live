// Seven assessments derived only from verified core answers; no searches or model calls.
const NO_EVIDENCE="No clear evidence found.";
const DEPENDENCIES={
  checkLegitimacy:["legitimacy"],
  checkAccessibility:["nigeriaAccess","availability","device","kyc"],
  checkWorthwhile:["earnings","startingCost","timeCost","opportunityCost","availability"],
  realCash:["startingCost"],
  realData:["dataCost"],
  realTime:["timeCost"],
  realOpportunity:["opportunityCost"]
};
const labels={
  nigeriaAccess:"Nigeria access",availability:"Current availability",device:"Device requirements",
  kyc:"ID requirements",earnings:"Earning potential",startingCost:"Starting cost",
  timeCost:"Time commitment",opportunityCost:"Opportunity cost",legitimacy:"Legitimacy"
};
const concise=(s)=>String(s||"").trim().slice(0,650);
function verified(packet){
  return packet?.understanding &&
    ["established","partially_established"].includes(packet.understanding.status) &&
    Array.isArray(packet.understanding.sourceUrls) && packet.understanding.sourceUrls.length>0 &&
    packet.answer && packet.answer!==NO_EVIDENCE && !packet.understanding.error;
}
export function deriveAssessments(coreFields,contracts,profile={}){
  const derived={};
  for(const contract of contracts.filter(c=>c.group!=="core")){
    const deps=DEPENDENCIES[contract.key];
    if(!deps)throw Error("Missing derivation rule: "+contract.key);
    const present=deps.filter(key=>verified(coreFields[key]));
    const missing=deps.filter(key=>!verified(coreFields[key]));
    const missingLabels=missing.map(k=>labels[k]||k);
    let answer=NO_EVIDENCE;
    if(present.length){
      // Keep each claim in its own labeled context, so a payout or cost
      // assertion cannot silently become an accessibility or legitimacy fact.
      answer=present.map(k=>deps.length===1?concise(coreFields[k].answer):
        (labels[k]||k)+": "+concise(coreFields[k].answer)).join(" ");
      // These are evidence summaries, not new claims about the user's fit.
      // In particular, unknown access must not become a positive accessibility judgment.
    }
    const sourceUrls=[...new Set(present.flatMap(k=>coreFields[k].understanding.sourceUrls))];
    const status=!present.length?"not_established":missing.length ||
      present.some(k=>coreFields[k].understanding.status==="partially_established")
      ?"partially_established":"established";
    derived[contract.key]={
      key:contract.key,question:contract.question,extract:contract.extract,
      answer,sources:[],ok:true,derivedFrom:deps,
      understanding:{status,missing:missingLabels,conflict:present.some(k=>coreFields[k].understanding.conflict===true),
        sourceUrls,derived:true}
    };
  }
  return derived;
}
