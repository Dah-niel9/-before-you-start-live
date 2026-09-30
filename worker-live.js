const NO_EVIDENCE = "No clear evidence found.";

const FIELD_CONTRACTS = [
  { key:"opportunity", label:"What the work is", group:"core", question:"What does a person actually do in this opportunity?", extract:"Actual tasks, activities, outputs, who the person serves, and how the work works. Do not give a generic industry definition or a description of a related platform." },
  { key:"workType", label:"Work type", group:"core", question:"What kind of work, business model, or earning activity is this?", extract:"A useful category for the opportunity, such as freelancing, microtasks, content creation, tutoring, data work, e-commerce, or AI product/business. Do not copy hashtags or unrelated categories." },
  { key:"nigeriaAccess", label:"Nigeria access", group:"core", question:"Can a person in Nigeria participate in this opportunity?", extract:"Nigeria-specific availability, geographic restrictions, eligibility, and country limitations. Do not use a random mention of Nigeria, generic KYC, or unrelated Nigerian jobs." },
  { key:"availability", label:"Current availability", group:"core", question:"Is this opportunity currently usable or available?", extract:"Whether the actual opportunity is operating, accepting participants, and/or has current work, tasks, projects, or access. Do not use unrelated job listings as proof." },
  { key:"device", label:"Phone / laptop", group:"core", question:"What device or software does someone actually need to perform this work?", extract:"Required phone, laptop/computer, operating system, browser, or required software. Do not treat optional equipment as mandatory." },
  { key:"kyc", label:"KYC / ID", group:"core", question:"Does the person need identity verification or ID?", extract:"KYC, identity verification, government ID, passport, NIN, address verification, or similar requirements, including when they apply." },
  { key:"payment", label:"Payment methods", group:"core", question:"How does a person doing this opportunity actually receive money?", extract:"Actual payout methods such as bank transfer, PayPal, AdSense, wallet, wire transfer, etc. Include country-specific limits when documented." },
  { key:"withdrawal", label:"Withdrawal", group:"core", question:"Once money is earned, how and when can the person withdraw or receive it?", extract:"Minimum threshold, withdrawal rules, schedule, processing time, and conditions before payout. Do not confuse a payment cycle with first-money timing." },
  { key:"startingCost", label:"Starting cost", group:"core", question:"What money must a person actually spend to start this opportunity?", extract:"Mandatory registration fees, subscriptions, deposits, required purchases, required paid tools, exact amounts and currencies, and whether a cost is mandatory or optional. Ignore optional equipment and unrelated prices." },
  { key:"earnings", label:"Earning potential", group:"core", question:"How does the person earn money from this opportunity and what determines the amount?", extract:"Pay rates, commissions, revenue model, earnings ranges, per-task/project rates, and factors that affect earnings. Do not mistake other people's spending or platform revenue for user earnings." },
  { key:"firstMoney", label:"Time to first money", group:"core", question:"What needs to happen before the person receives their first actual payment, and how long can that take?", extract:"First-payout timing, approval, first sale/client/task, thresholds, payment schedule, and processing time. Do not turn a monthly payment cycle into a guaranteed first-payment time." },
  { key:"legitimacy", label:"Legitimacy", group:"core", question:"What evidence exists about whether this opportunity or its operator is real and established?", extract:"Verifiable operator/platform information, official documentation, established presence, and credible warnings or concerns. Do not call something legitimate merely because it has an official-looking website." },
  { key:"dataCost", label:"Data cost", group:"core", question:"What internet or mobile-data use and cost is involved in doing this work?", extract:"Internet requirement, data-heavy activities, uploads/downloads/video use, connectivity needs, and documented data costs. Do not use unrelated telecom prices." },
  { key:"timeCost", label:"Time cost", group:"core", question:"How much ongoing time does doing this work require?", extract:"Hours, frequency, workload, time per task/project, and ongoing commitment. Do not confuse time spent working with time to first payment." },
  { key:"opportunityCost", label:"Opportunity cost", group:"core", question:"What meaningful tradeoff comes from spending time or resources on this opportunity?", extract:"A realistic tradeoff created by committing the user's time/resources. Do not invent a precise monetary value when evidence does not support one." },

  { key:"checkLegitimacy", label:"Three Checks — Legitimacy", group:"threeChecks", question:"What evidence supports or challenges the legitimacy of this opportunity?", extract:"Independent and primary evidence about the operator, operation, warnings, complaints, or verification. Give a short evidence-based conclusion." },
  { key:"checkAccessibility", label:"Three Checks — Accessibility", group:"threeChecks", question:"How accessible is this opportunity to the user, especially from Nigeria with the stated profile?", extract:"Country access, device, ID, qualification, and other practical access conditions. Focus on actual ability to participate." },
  { key:"checkWorthwhile", label:"Three Checks — Worthwhile", group:"threeChecks", question:"What evidence helps determine whether this opportunity is worth considering for the user's goal?", extract:"Earnings/economics, costs, time, availability, and important tradeoffs. Do not declare it worthwhile just because earnings are possible." },

  { key:"realCash", label:"Real Cost — Cash", group:"realCost", question:"What cash must the user actually spend to start or keep doing this opportunity?", extract:"Mandatory cash costs, exact amounts/currencies where documented, and unavoidable recurring costs. Separate optional purchases." },
  { key:"realData", label:"Real Cost — Data", group:"realCost", question:"What internet/data cost does doing this opportunity create for the user?", extract:"Actual data/internet requirements and documented cost implications." },
  { key:"realTime", label:"Real Cost — Time", group:"realCost", question:"What ongoing time does this opportunity consume?", extract:"Hours, frequency, workload, and time commitment." },
  { key:"realOpportunity", label:"Real Cost — Opportunity", group:"realCost", question:"What does the user give up by spending their time/resources on this opportunity?", extract:"Important tradeoffs supported by the research. Avoid fake precision." }
];

function contractFor(key) {
  return FIELD_CONTRACTS.find(x => x.key === key);
}

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanAnswer(value) {
  let text = normalize(value)
    .replace(/^Answer:\s*/i, "")
    .replace(/^Research summary:\s*/i, "")
    .replace(/^According to (?:the )?sources?:?\s*/i, "");
  if (!text) return NO_EVIDENCE;
  if (/^(no reliable evidence|no clear evidence|not enough evidence|unknown|not found)\.?$/i.test(text)) return NO_EVIDENCE;
  return text.length > 650 ? text.slice(0, 647).trimEnd() + "..." : text;
}

function fieldPrompt(name, claim, url, contract, profile) {
  const context = [
    `Opportunity: "${name}".`,
    claim ? `User's description: "${claim}".` : "",
    url ? `Reference URL supplied by user: ${url}` : "",
    "The user is in Nigeria.",
    profile?.devices?.length ? `Devices: ${profile.devices.join(", ")}.` : "",
    profile?.budgetLabel ? `Budget: ${profile.budgetLabel}.` : "",
    profile?.experience ? `Experience: ${profile.experience}.` : "",
    profile?.time ? `Available time: ${profile.time}.` : "",
    profile?.goals?.length ? `Goal: ${profile.goals.join(", ")}.` : ""
  ].filter(Boolean).join(" ");

  return [
    context,
    "",
    `Research question: ${contract.question}`,
    `What to extract: ${contract.extract}`,
    "",
    "Return a concise factual research answer for this question only.",
    "Use exact numbers and currencies when the sources provide them.",
    "Clearly distinguish mandatory from optional costs and documented facts from uncertainty.",
    "Do not answer neighboring questions. Do not use unrelated platforms, companies, job listings, or industry statistics.",
    "If the available sources do not establish the answer, say exactly: No clear evidence found."
  ].join("\n");
}

async function tavilySearch(env, query) {
  const response = await fetch("https://api.tavily.com/search", {
    method:"POST",
    headers:{
      "content-type":"application/json",
      "authorization":`Bearer ${env.TAVILY_API_KEY}`
    },
    body:JSON.stringify({
      query: query.slice(0, 1100),
      search_depth:"advanced",
      topic:"general",
      max_results:5,
      include_answer:true,
      include_raw_content:false,
      include_images:false
    })
  });
  if (!response.ok) {
    return { ok:false, status:response.status, detail:(await response.text()).slice(0,500), data:null };
  }
  return { ok:true, status:response.status, detail:"", data:await response.json() };
}

function normalizeSource(item, key) {
  const url = String(item?.url || "").trim();
  if (!url) return null;
  return {
    title: String(item?.title || url),
    url,
    content: String(item?.content || ""),
    researchKey:key
  };
}

function sourceQuality(source, name) {
  const text = `${source.title} ${source.content}`.toLowerCase();
  const n = String(name || "").toLowerCase();
  let score = 0;
  if (n && text.includes(n)) score += 3;
  if (/(official|help|support|docs|documentation|terms|pricing|payment|payout|eligib|requirement)/i.test(source.title)) score += 2;
  if (/gov\.|youtube\.com|google\.com|microsoft\.com|linkedin\.com|indeed\.com/i.test(source.url)) score += 2;
  if (source.content.length > 180) score += 1;
  if (/(make money online|best ways to earn|top platforms|related articles)/i.test(source.title)) score -= 2;
  return score;
}

function answerFromPacket(packet) {
  const answer = cleanAnswer(packet.answer);
  if (answer !== NO_EVIDENCE) return answer;
  const ranked = [...(packet.sources || [])]
    .map(s => ({ s, score:sourceQuality(s, packet.name) }))
    .sort((a,b)=>b.score-a.score);
  for (const item of ranked) {
    const text = cleanAnswer(item.s.content);
    if (text !== NO_EVIDENCE) return text.slice(0,650);
  }
  return NO_EVIDENCE;
}

function hasEvidence(answer) {
  return answer && answer !== NO_EVIDENCE;
}

function containsAny(text, patterns) {
  return patterns.some(p => p.test(String(text || "")));
}

function makeVerdict(fields, profile) {
  const blockers = [];
  const cautions = [];
  const unknowns = [];

  const nigeria = fields.nigeriaAccess.answer;
  const legitimacy = fields.legitimacy.answer;
  const work = fields.opportunity.answer;

  if (!hasEvidence(work)) {
    return {
      verdict:"NOT ENOUGH RELIABLE EVIDENCE",
      confidence:"Low",
      blockers:[],
      cautions:[],
      unknowns:["The research did not clearly establish what the person would actually do."],
      reason:"The research could not clearly establish what this opportunity actually involves.",
      changes:"Find reliable evidence explaining the actual work before committing time, money or documents."
    };
  }

  if (containsAny(nigeria,[/not (?:available|supported|eligible|allowed)/i, /unavailable/i, /excluded/i, /blocked/i, /prohibited/i])) {
    blockers.push("Current research indicates that the opportunity is not accessible from Nigeria.");
  }

  if (containsAny(legitimacy,[/scam/i,/fraud/i,/fake platform/i,/phishing/i,/official warning/i,/regulatory action/i])) {
    blockers.push("Current research contains a serious legitimacy or fraud warning.");
  }

  const cost = fields.startingCost.answer;
  if (profile?.budgetLabel && containsAny(cost,[/required|mandatory|must pay|upfront|deposit|subscription/i])) {
    const zeroBudget = /₦0|0\s*(?:naira|budget)/i.test(String(profile.budgetLabel));
    if (zeroBudget && /(?:₦|ngn|naira|\$|usd|€|eur|£|gbp)\s*[1-9]/i.test(cost)) {
      blockers.push("The research indicates a required starting cost while the selected budget is ₦0.");
    }
  }

  const device = fields.device.answer;
  if (profile?.devices?.length && /(?:requires?|must have|need(?:s)?|only works on)[^.]{0,100}\b(?:laptop|computer|desktop)\b/i.test(device) &&
      !profile.devices.some(x => /laptop|computer|desktop/i.test(x))) {
    blockers.push("The research indicates that a laptop or computer is required, but the selected profile does not include one.");
  }

  const kyc = fields.kyc.answer;
  if (profile?.ids?.some(x => /^none$/i.test(String(x))) &&
      /(?:requires?|must provide|need(?:s)?|only accepts)[^.]{0,100}\b(?:id|passport|nin|national id|driver)/i.test(kyc)) {
    blockers.push("The research indicates an ID requirement while the selected profile has no ID.");
  }

  const criticalKeys = ["nigeriaAccess","availability","device","kyc","payment","withdrawal","startingCost","earnings","firstMoney","legitimacy","dataCost","timeCost"];
  const covered = criticalKeys.filter(k => hasEvidence(fields[k].answer)).length;
  const missing = criticalKeys.filter(k => !hasEvidence(fields[k].answer));

  if (missing.length) unknowns.push(`Research did not clearly establish: ${missing.map(k=>contractFor(k).label).join(", ")}.`);

  const strongNegative = blockers.length > 0;
  const enough = covered >= 8;
  let verdict = "NOT ENOUGH RELIABLE EVIDENCE";
  let confidence = "Low";

  if (strongNegative) {
    verdict = "SKIP";
    confidence = "High for the flagged blocker(s)";
  } else if (enough) {
    const uncertainty = missing.length >= 4;
    const cautionSignal = containsAny(
      [fields.availability.answer,fields.earnings.answer,fields.withdrawal.answer,fields.startingCost.answer].join(" "),
      [/var(?:y|ies)/i,/not guaranteed/i,/depends/i,/waitlist/i,/invite[- ]only/i,/minimum/i,/threshold/i,/competition/i]
    );
    if (uncertainty || cautionSignal) {
      verdict = "MAYBE";
      confidence = covered >= 11 ? "Medium" : "Low";
    } else {
      verdict = "TRY";
      confidence = covered >= 11 ? "High" : "Medium";
    }
  }

  const positive = [];
  if (hasEvidence(fields.nigeriaAccess.answer)) positive.push(fields.nigeriaAccess.answer);
  if (hasEvidence(fields.payment.answer)) positive.push(fields.payment.answer);
  if (hasEvidence(fields.earnings.answer)) positive.push(fields.earnings.answer);

  const why = verdict === "SKIP"
    ? blockers.join(" ")
    : verdict === "TRY"
      ? "The research establishes the work, access, money path and other important conditions with relatively few unresolved gaps."
      : verdict === "MAYBE"
        ? "The research establishes a real path into the opportunity, but important conditions or uncertainties still need to be understood."
        : "The available research does not yet establish enough of the important conditions to make a responsible assessment.";

  const changes = blockers.length
    ? "Resolve the highlighted blocker(s) or confirm evidence that directly changes them, then reassess."
    : missing.length
      ? `Resolve the missing evidence for: ${missing.slice(0,4).map(k=>contractFor(k).label).join(", ")}.`
      : "Confirm the current requirements, payment terms and availability before committing significant time or money.";

  return { verdict, confidence, blockers, cautions, unknowns, reason:why, changes };
}

function biggestCatch(fields, verdictData) {
  const candidates = [
    ["Nigeria access", fields.nigeriaAccess.answer, /not (?:available|supported)|unavailable|excluded|blocked|prohibited/i, 100],
    ["Legitimacy", fields.legitimacy.answer, /scam|fraud|fake|phishing|warning|regulatory/i, 100],
    ["Starting cost", fields.startingCost.answer, /required|mandatory|upfront|deposit|subscription|fee/i, 80],
    ["Withdrawal", fields.withdrawal.answer, /threshold|minimum|processing|wait|condition|limit/i, 60],
    ["Availability", fields.availability.answer, /limited|waitlist|invite|project[- ]dependent|not guaranteed/i, 70],
    ["Earnings", fields.earnings.answer, /vary|varies|depends|not guaranteed|competitive/i, 55],
    ["KYC / ID", fields.kyc.answer, /required|must provide|government|passport|nin|verification/i, 50]
  ];
  let best = null;
  for (const [label,answer,pattern,weight] of candidates) {
    if (hasEvidence(answer) && pattern.test(answer)) {
      const score = weight + Math.min(20, answer.length / 50);
      if (!best || score > best.score) best = { label, answer, score };
    }
  }
  if (verdictData.blockers.length) return verdictData.blockers[0];
  if (best) return best.answer;
  if (hasEvidence(fields.opportunity.answer)) return "The research did not identify one single major blocker; check the current conditions before committing.";
  return NO_EVIDENCE;
}

function buildBreakdown(fields, profile) {
  const f = k => fields[k]?.answer || NO_EVIDENCE;
  return {
    opportunity:{status:hasEvidence(f("opportunity"))?"Evidence found":"No clear evidence found",evidence:f("opportunity"),workType:f("workType")},
    legitimacy:{status:hasEvidence(f("legitimacy"))?"Evidence found":"No clear evidence found",evidence:f("legitimacy")},
    nigeriaAccess:{status:hasEvidence(f("nigeriaAccess"))?"Evidence found":"No clear evidence found",evidence:f("nigeriaAccess")},
    requirements:{
      status:(hasEvidence(f("device"))||hasEvidence(f("kyc")))?"Conditions found":"No clear evidence found",
      evidence:[f("device"),f("kyc")].filter(x=>x!==NO_EVIDENCE).join(" ")||NO_EVIDENCE,
      device:f("device"),kyc:f("kyc"),qualification:NO_EVIDENCE
    },
    gettingPaid:{status:hasEvidence(f("payment"))?"Payment evidence found":"Needs confirmation",evidence:f("payment")},
    withdrawal:{status:hasEvidence(f("withdrawal"))?"Withdrawal evidence found":"Needs confirmation",evidence:f("withdrawal")},
    earnings:{status:hasEvidence(f("earnings"))?"Earnings evidence found":"No clear evidence found",evidence:f("earnings")},
    availability:{status:hasEvidence(f("availability"))?"Current/conditional evidence found":"Needs confirmation",evidence:f("availability"),timeToFirstMoney:f("firstMoney")},
    realCost:{
      status:hasEvidence(f("realCash"))?"Cost evidence found":"No clear upfront cash cost found",
      evidence:f("realCash"),data:f("realData"),time:f("realTime"),opportunity:f("realOpportunity")
    },
    biggestCatch:{status:hasEvidence(f("biggestCatch"))?"Evidence-based":"No clear evidence found",evidence:f("biggestCatch")},
    threeChecks:{
      legitimacy:f("checkLegitimacy"),
      accessibility:f("checkAccessibility"),
      worthwhile:f("checkWorthwhile")
    },
    yourFit:{
      status:"Profile considered",
      evidence:[
        profile?.devices?.join(", "),profile?.budgetLabel,profile?.experience,profile?.time,
        profile?.goals?.join?.(", ")
      ].filter(Boolean).join(" • ")||"Profile considered where evidence supports a comparison."
    }
  };
}

export async function runFieldResearch({ env, name, claim, url, profile, contract }) {
  const query = fieldPrompt(name,claim,url,contract,profile);
  const result = await tavilySearch(env,query);
  const data = result.data || {};
  const sources = (Array.isArray(data.results)?data.results:[])
    .map(x=>normalizeSource(x,contract.key)).filter(Boolean);

  // Field answers must never be copied from raw source content.
  // Tavily's synthesized answer is used only when it exists; otherwise this
  // field remains explicitly unknown rather than borrowing neighboring facts.
  const packet = {
    key:contract.key,
    name,
    question:contract.question,
    extract:contract.extract,
    ok:result.ok,
    answer:cleanAnswer(data.answer),
    sources
  };

  return { packet, error:result.ok?null:result.detail };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/research" && request.method === "POST") return handleResearch(request,env);
    return env.ASSETS.fetch(request);
  }
};

async function handleResearch(request,env) {
  try {
    if (!env.TAVILY_API_KEY) return json({ok:false,error:"Live Research is not configured yet."},500);

    const body=await request.json();
    const name=String(body?.name||"").trim();
    const claim=String(body?.claim||"").trim();
    const url=String(body?.url||"").trim();
    const profile=body?.profile||{};
    if (!name) return json({ok:false,error:"Opportunity name is required."},400);

    const results=await Promise.all(FIELD_CONTRACTS.map(contract =>
      runFieldResearch({env,name,claim,url,profile,contract})
    ));

    const fields={};
    const allSources=[];
    const failed=[];
    for (const result of results) {
      fields[result.packet.key]=result.packet;
      allSources.push(...result.packet.sources.map(s=>({...s,researchKey:result.packet.key})));
      if (!result.packet.ok) failed.push({key:result.packet.key,detail:result.error});
    }

    const sourceMap=new Map();
    for (const source of allSources) {
      const existing=sourceMap.get(source.url);
      if (!existing) sourceMap.set(source.url,{...source,researchKeys:[source.researchKey]});
      else existing.researchKeys=[...new Set([...(existing.researchKeys||[]),source.researchKey])];
    }
    const sources=[...sourceMap.values()].slice(0,50);

    const verdictData=makeVerdict(fields,profile);
    const catchText=biggestCatch(fields,verdictData);
    fields.biggestCatch={key:"biggestCatch",answer:catchText};

    const breakdown=buildBreakdown(fields,profile);
    const hereDeal=hasEvidence(fields.opportunity.answer)
      ? fields.opportunity.answer
      : NO_EVIDENCE;

    return json({
      ok:true,
      answer:hereDeal,
      hereDeal,
      sources,
      researchBreakdown:breakdown,
      verdict:verdictData.verdict,
      confidence:verdictData.confidence,
      reason:verdictData.reason,
      blockers:verdictData.blockers,
      cautions:verdictData.cautions,
      unknowns:verdictData.unknowns,
      changes:verdictData.changes,
      fieldResearch:Object.fromEntries(Object.entries(fields).map(([key,p])=>[key,{
        question:p.question||contractFor(key)?.question||"",
        extract:p.extract||contractFor(key)?.extract||"",
        answer:p.answer||NO_EVIDENCE,
        sourceCount:Array.isArray(p.sources)?p.sources.length:0,
        researchKey:key
      }])),
      failedFields:failed
    });
  } catch(error) {
    const detail=error instanceof Error?error.message:String(error);
    console.error("Live Research error",{detail});
    return json({ok:false,error:"Live Research could not complete this check right now.",detail},500);
  }
}

function json(value,status=200) {
  return new Response(JSON.stringify(value),{
    status,
    headers:{"content-type":"application/json; charset=utf-8"}
  });
}
