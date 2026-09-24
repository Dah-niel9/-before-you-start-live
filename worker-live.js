export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/research" && request.method === "POST") {
      return handleResearch(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleResearch(request, env) {
  try {
    if (!env.TAVILY_API_KEY) {
      console.error("Live Research: TAVILY_API_KEY secret is missing from this deployment.");
      return json({ ok: false, error: "Live Research is not configured yet." }, 500);
    }

    const body = await request.json();
    const name = String(body?.name || "").trim();
    const claim = String(body?.claim || "").trim();
    const url = String(body?.url || "").trim();
    const profile = body?.profile || {};

    if (!name) {
      return json({ ok: false, error: "Opportunity name is required." }, 400);
    }

    const profileLine = [
      "User context: Nigeria.",
      Array.isArray(profile.devices) ? `Devices: ${profile.devices.join(", ")}.` : "",
      profile.budgetLabel ? `Budget: ${profile.budgetLabel}.` : "",
      Array.isArray(profile.ids) ? `IDs: ${profile.ids.join(", ")}.` : "",
      Array.isArray(profile.skills) ? `Skills: ${profile.skills.join(", ")}.` : "",
      profile.experience ? `Experience: ${profile.experience}.` : "",
      profile.time ? `Time: ${profile.time}.` : "",
      Array.isArray(profile.goals) ? `Goal: ${profile.goals.join(", ")}.` : ""
    ].filter(Boolean).join(" ");

    const queryParts = [
      `Investigate only the specific opportunity "${name}" for a person in Nigeria. Do not substitute generic freelancing, make-money-online, or unrelated platform information.`,
      claim ? `Claim: "${claim}".` : "",
      url ? `Link: ${url}` : "",
      profileLine,
      `Use these opportunity terms when relevant: ${getOpportunityAliases(name, claim, url).join(", ")}.`,
      "Check legitimacy, Nigeria access, requirements, payments, costs, availability, earnings, and risks. Prefer official and current sources. Look for concrete evidence, not marketing claims."
    ].filter(Boolean);

    let query = queryParts.join(" ");
    if (query.length > 650) query = query.slice(0, 650);

    const tavily = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${env.TAVILY_API_KEY}`
      },
      body: JSON.stringify({
        query,
        search_depth: "advanced",
        topic: "general",
        max_results: 5,
        include_answer: true,
        include_raw_content: false,
        include_images: false
      })
    });

    if (!tavily.ok) {
      const detail = await tavily.text();
      console.error("Live Research: Tavily request failed.", {
        status: tavily.status,
        detail: detail.slice(0, 500)
      });
      return json({ ok: false, error: `Tavily request failed (${tavily.status}).`, detail: detail.slice(0, 500) }, 502);
    }

    const data = await tavily.json();
    console.log("Live Research: Tavily request succeeded.", {
      status: tavily.status,
      resultCount: Array.isArray(data.results) ? data.results.length : 0
    });

    const sources = Array.isArray(data.results)
      ? data.results.slice(0, 5).map(item => ({
          title: item.title || item.url || "Source",
          url: item.url || "",
          content: item.content || ""
        })).filter(item => item.url)
      : [];

    const assessment = assessLiveEvidence({
      name,
      claim,
      answer: data.answer || "",
      sources,
      profile,
      url
    });

    const normalizedOpportunityName = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const normalizedAnswer = String(data.answer || "").toLowerCase();
    const answerIsOpportunitySpecific = normalizedOpportunityName && normalizedAnswer.includes(normalizedOpportunityName);

    return json({
      ok: true,
      answer: answerIsOpportunitySpecific
        ? data.answer
        : "Current sources were found, but Tavily did not return a verified opportunity-specific research summary.",
      sources,
      researchBreakdown: buildResearchBreakdown({ name, claim, sources: assessment.sources || [], profile, assessment }),
      ...assessment
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Live Research: unexpected error.", { detail });
    return json({
      ok: false,
      error: "Live Research could not complete this check right now.",
      detail
    }, 500);
  }
}

export function assessLiveEvidence({ name, claim, answer, sources, profile, url = "" }) {
  const nameTokens = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(token => token.length >= 4 && !["online", "work", "platform", "project", "opportunity"].includes(token));

  const normalizedName = String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const suppliedHost = (() => {
    try {
      return url ? new URL(url).hostname.toLowerCase().replace(/^www\\./, "") : "";
    } catch {
      return "";
    }
  })();

  const normalizedSources = sources.map(source => {
    const title = String(source.title || "");
    const content = String(source.content || "");
    const text = `${title} ${source.url || ""} ${content}`.toLowerCase();
    let host = "";
    try {
      host = new URL(source.url).hostname.toLowerCase().replace(/^www\\./, "");
    } catch {}
    return { ...source, title, content, text, host };
  });

  // Only sources tied to the exact requested opportunity may influence
  // the verdict. Generic "make money online" pages are not evidence.
  const matchesOpportunity = source => {
    if (!source.text) return false;
    if (suppliedHost && source.host && (source.host === suppliedHost || source.host.endsWith("." + suppliedHost))) return true;
    if (normalizedName && source.text.includes(normalizedName)) return true;
    if (nameTokens.length >= 2 && nameTokens.every(token => source.text.includes(token))) return true;
    if (nameTokens.length === 1 && source.host.includes(nameTokens[0])) return true;
    return false;
  };

  const opportunityAliases = getOpportunityAliases(name, claim, url);

  const matchesOpportunityWithAliases = source => {
    if (!source.text) return false;
    if (suppliedHost && source.host && (source.host === suppliedHost || source.host.endsWith("." + suppliedHost))) return true;
    return opportunityAliases.some(alias => {
      const normalizedAlias = alias.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!normalizedAlias) return false;
      if (source.text.includes(normalizedAlias)) return true;
      const compactAlias = normalizedAlias.replace(/\s+/g, "");
      const compactHost = source.host.replace(/[^a-z0-9]/g, "");
      return compactAlias.length >= 4 && compactHost.includes(compactAlias);
    });
  };

  const relevantSources = normalizedSources.filter(matchesOpportunityWithAliases);
  const sourceCount = relevantSources.length;

  // Source presentation is separate from verdict evidence: all relevant sources
  // may inform the decision, but only the most useful, opportunity-specific
  // sources should be shown to the user.
  const sourceQualityScore = source => {
    const title = source.title.toLowerCase();
    const text = source.text;
    let score = 0;
    if (normalizedName && title.includes(normalizedName)) score += 5;
    if (isLikelyOfficialHost(source.host, nameTokens)) score += 4;
    if (/(support|help|docs|documentation|terms|privacy|payment|payout|withdraw|eligib|requirement|pricing|how it works)/i.test(title)) score += 3;
    if (normalizedName && text.includes(normalizedName)) score += 2;
    if (String(source.content || "").trim().length >= 120) score += 1;
    if (/(make money online|ways to earn money|best freelancing|top platforms|earn online in nigeria)/i.test(title) &&
        normalizedName && !title.includes(normalizedName)) score -= 6;
    return score;
  };

  const isLikelyOfficialHost = (host, tokens) => {
    if (!host) return false;
    if (/(^|\\.)gov(\\.|$)/.test(host)) return true;
    const compact = host.replace(/[^a-z0-9]/g, "");
    return tokens.some(token => compact.includes(token));
  };

  const curatedSources = [...relevantSources]
    .map(source => ({ ...source, qualityScore: sourceQualityScore(source) }))
    .sort((a,b) => b.qualityScore - a.qualityScore)
    .filter(source => source.qualityScore >= 3)
    .slice(0, 5);

  const isLikelyOfficial = source => {
    if (!source.host) return false;
    if (/(^|\\.)gov(\\.|$)/.test(source.host)) return true;
    if (!nameTokens.length) return false;
    const compactHost = source.host.replace(/[^a-z0-9]/g, "");
    return nameTokens.some(token => compactHost.includes(token));
  };

  const strongNegativePatterns = [
    /\bscam(?:med|ming)?\b|\bfraud(?:ulent)?\b|\bfake platform\b|\bimpersonat(?:ion|ing|ed)\b|\bphishing\b|\bmalware\b|\bponzi\b|\bpyramid scheme\b/,
    /nigeria[^.]{0,180}(?:not supported|unsupported|excluded|unavailable|blocked|prohibited)/,
    /(?:requires|must|need to)\s+(?:pay|deposit|invest|send money)[^.]{0,120}(?:before|to start|to withdraw|for access)/,
    /withdraw(?:al|als)[^.]{0,120}(?:impossible|not possible|blocked|unable|cannot|can't|complaint)/,
    /(?:regulatory|government) warning|official warning/
  ];

  const positivePatterns = {
    legitimacy: /(?:legitimate|legit|established|reputable|operating since|founded in|registered company|real company)/,
    nigeriaAccess: /(?:nigeria[^.]{0,180}(?:supported|available|eligible|accepts|accepted|open to|can participate)|nigerian users|users in nigeria|available in nigeria)/,
    payments: /(?:payout|withdraw|payment)[^.]{0,160}(?:supported|available|paid|method|option|bank|paypal|payoneer|paystack|flutterwave)|paid[^.]{0,120}(?:users|workers|contributors|participants)/,
    realOperation: /(?:official (?:site|website|support|documentation)|terms of service|privacy policy|help center|support center|careers|pricing|application process|how it works)/
  };

  const cautionPatterns = [
    /project[- ]dependent|availability[^.]{0,120}(?:varies|limited|depends)/,
    /waitlist|qualification|application|invite[- ]only/,
    /identity verification|kyc|id verification|proof of identity/,
    /competition|competitive|limited slots/,
    /earnings[^.]{0,140}(?:vary|varies|not guaranteed|depends)/,
    /fee|fees|commission|minimum payout|threshold/
  ];

  const supportsPattern = (source, pattern) => {
    const compact = source.text.replace(/\s+/g, " ").trim();
    const opportunityAnchors = [normalizedName, ...nameTokens].filter(Boolean);
    if (!opportunityAnchors.length) return false;
    if (suppliedHost && source.host && (source.host === suppliedHost || source.host.endsWith("." + suppliedHost))) {
      return pattern.test(compact);
    }
    const sentences = compact.split(/(?<=[.!?])\s+/);
    const sourceIsOpportunitySpecific = opportunityAliases.some(alias => {
      const normalizedAlias = alias.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      return normalizedAlias && (
        compact.includes(normalizedAlias) ||
        source.host.replace(/[^a-z0-9]/g, "").includes(normalizedAlias.replace(/\s+/g, ""))
      );
    });
    return sourceIsOpportunitySpecific
      ? sentences.some(sentence => pattern.test(sentence))
      : opportunityAnchors.some(anchor =>
          sentences.some(sentence => sentence.includes(anchor) && pattern.test(sentence))
        );
  };

  const supportsPositivePattern = (source, pattern) => {
    const compact = source.text.replace(/\s+/g, " ").trim();
    const opportunityAnchors = [normalizedName, ...nameTokens].filter(Boolean);
    if (!opportunityAnchors.length) return false;
    const isUsableSentence = sentence =>
      pattern.test(sentence) &&
      !/(?:does not establish|doesn't establish|does not prove|doesn't prove|not evidence|not proof|not supported|unsupported|not available|unavailable|not eligible|not accepted|may pay|might pay|could pay|many platforms|other platforms)/i.test(sentence);
    if (suppliedHost && source.host && (source.host === suppliedHost || source.host.endsWith("." + suppliedHost))) {
      return isUsableSentence(compact);
    }
    const sentences = compact.split(/(?<=[.!?])\s+/);
    const sourceIsOpportunitySpecific = opportunityAliases.some(alias => {
      const normalizedAlias = alias.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      return normalizedAlias && (
        compact.includes(normalizedAlias) ||
        source.host.replace(/[^a-z0-9]/g, "").includes(normalizedAlias.replace(/\s+/g, ""))
      );
    });
    return sourceIsOpportunitySpecific
      ? sentences.some(isUsableSentence)
      : opportunityAnchors.some(anchor =>
          sentences.some(sentence => sentence.includes(anchor) && isUsableSentence(sentence))
        );
  };

  const sourceSignals = relevantSources.map(source => {
    const negativePatterns = strongNegativePatterns.filter(pattern => supportsPattern(source, pattern));
    const supportedDimensions = Object.entries(positivePatterns)
      .filter(([, pattern]) => supportsPositivePattern(source, pattern))
      .map(([key]) => key);
    const cautions = cautionPatterns.filter(pattern => supportsPositivePattern(source, pattern)).length;
    return {
      source,
      negatives: negativePatterns.length,
      dimensions: supportedDimensions,
      cautions,
      official: isLikelyOfficial(source)
    };
  });

  const negativeSources = sourceSignals.filter(x => x.negatives > 0);
  const officialNegativeSources = negativeSources.filter(x => x.official);
  const positiveDimensions = [...new Set(sourceSignals.flatMap(x => x.dimensions))];
  const positiveHits = positiveDimensions.length;
  const cautionHits = sourceSignals.reduce((sum, x) => sum + x.cautions, 0);
  const officialSources = sourceSignals.filter(x => x.official).length;

  const blockers = [];
  const cautions = [];

  const nigeriaRestriction = /nigeria[^.]{0,180}(?:not supported|unsupported|excluded|unavailable|blocked|prohibited)/;
  const upfrontPayment = /(?:requires|must|need to)\s+(?:pay|deposit|invest|send money)[^.]{0,120}(?:before|to start|to withdraw|for access)/;
  const scamWarning = /\bscam(?:med|ming)?\b|\bfraud(?:ulent)?\b|\bfake platform\b|\bimpersonat(?:ion|ing|ed)\b|\bphishing\b|\bmalware\b|\bponzi\b|\bpyramid scheme\b/;

  if (officialNegativeSources.length || negativeSources.length >= 2) {
    if (officialNegativeSources.some(x => supportsPattern(x.source, nigeriaRestriction)) ||
        negativeSources.filter(x => supportsPattern(x.source, nigeriaRestriction)).length >= 2) {
      blockers.push("Current evidence indicates Nigeria access is restricted or unavailable.");
    }
    if (officialNegativeSources.some(x => supportsPattern(x.source, upfrontPayment)) ||
        negativeSources.filter(x => supportsPattern(x.source, upfrontPayment)).length >= 2) {
      blockers.push("Current evidence indicates an upfront payment, deposit or investment requirement.");
    }
    if (officialNegativeSources.some(x => supportsPattern(x.source, scamWarning)) ||
        negativeSources.filter(x => supportsPattern(x.source, scamWarning)).length >= 2) {
      blockers.push("Current sources contain serious scam, fraud or impersonation warnings.");
    }
  }

  if (cautionHits) {
    cautions.push("Some important conditions such as qualification, KYC, fees, competition or project availability may apply.");
  }

  // TRY needs several independent positive dimensions, enough source coverage,
  // and either a likely official source or direct Nigeria-access evidence.
  const strongPositiveCase =
    sourceCount >= 3 &&
    positiveHits >= 3 &&
    negativeSources.length === 0 &&
    (officialSources >= 1 || positiveDimensions.includes("nigeriaAccess"));

  let verdict = "NOT ENOUGH RELIABLE EVIDENCE";
  let reason = "The available sources do not provide enough consistent evidence for a responsible recommendation.";

  if (blockers.length || negativeSources.length >= 2) {
    verdict = "SKIP";
    reason = "The current evidence contains serious problems or restrictions that make this route unsuitable to pursue right now.";
  } else if (strongPositiveCase) {
    verdict = "TRY";
    reason = "Current evidence shows a real operation with multiple positive signals, including relevant access or support for Nigerian users.";
  } else if (sourceCount >= 2 && positiveHits >= 1 && negativeSources.length === 0) {
    verdict = "MAYBE";
    reason = "There is evidence that the opportunity may be real or accessible, but important conditions or uncertainties remain.";
  }

  if (verdict === "TRY" && cautionHits >= 3) {
    verdict = "MAYBE";
    reason = "The opportunity shows strong positive signals, but several conditions or uncertainties still need to be confirmed before committing serious time or money.";
  }

  // Personalization: only apply profile fit when the opportunity evidence
  // states a clear requirement that can be compared with the user's profile.
  const profileFit = assessProfileFit({ sources: relevantSources, profile });
  if (profileFit.hardBlockers.length) {
    verdict = "SKIP";
    reason = "The opportunity may be real, but current evidence shows a requirement that does not fit your current profile."; 
    blockers.push(...profileFit.hardBlockers);
  } else if (profileFit.cautions.length && verdict === "TRY") {
    verdict = "MAYBE";
    reason = "The opportunity has positive evidence, but one or more current requirements do not fully match your profile."; 
    cautions.push(...profileFit.cautions);
  }

  const evidenceSpecificity = sourceCount
    + officialSources
    + positiveHits
    - (negativeSources.length && positiveHits ? 1 : 0);
  const confidence = verdict === "NOT ENOUGH RELIABLE EVIDENCE"
    ? "Low"
    : verdict === "SKIP"
      ? (officialNegativeSources.length >= 1 || negativeSources.length >= 2 ? "High for the flagged risks" : "Medium")
      : (sourceCount >= 3 && positiveHits >= 3 && officialSources >= 1 && evidenceSpecificity >= 7
        ? "High"
        : sourceCount >= 2 && (positiveHits >= 1 || cautionHits >= 1)
          ? "Medium"
          : "Low");

  const changes = verdict === "TRY"
    ? "Confirm the exact current requirements, payment terms and availability before starting."
    : verdict === "MAYBE"
      ? "Confirm the unresolved requirements, Nigeria access, payment terms and current availability."
      : verdict === "SKIP"
        ? "A credible current source would need to directly contradict the flagged restriction or risk."
        : "More reliable, current evidence from official or independent sources is needed.";

  return {
    sources: curatedSources.map(({ text, host, qualityScore, ...source }) => source),
    matchedSourceCount: sourceCount,
    displayedSourceCount: curatedSources.length,
    verdict,
    confidence,
    reason,
    blockers,
    cautions,
    profileFit,
    unknowns: verdict === "NOT ENOUGH RELIABLE EVIDENCE"
      ? ["The evidence base is too thin or inconsistent to classify this opportunity responsibly."]
      : [],
    changes,
    researchBreakdown: buildResearchBreakdown({ name, claim, sources: curatedSources, profile, assessment: { blockers, cautions, unknowns: verdict === "NOT ENOUGH RELIABLE EVIDENCE" ? ["The evidence base is too thin or inconsistent to classify this opportunity responsibly."] : [] } })
  };
}
function assessProfileFit({ sources, profile }) {
  const text = sources.map(s => String(s.content || "")).join(" ").toLowerCase();
  const devices = Array.isArray(profile?.devices) ? profile.devices.map(String).map(x => x.toLowerCase()) : [];
  const ids = Array.isArray(profile?.ids) ? profile.ids.map(String).map(x => x.toLowerCase()) : [];
  const skills = Array.isArray(profile?.skills) ? profile.skills.map(String).map(x => x.toLowerCase()) : [];
  const experience = String(profile?.experience || "").toLowerCase();
  const budget = String(profile?.budgetLabel || "").toLowerCase();
  const hardBlockers = [];
  const cautions = [];
  const matches = [];

  const hasLaptop = devices.some(x => x.includes("laptop"));
  const hasPhone = devices.some(x => x.includes("android") || x.includes("iphone") || x.includes("phone"));
  const hasNoId = ids.some(x => x === "none");
  const hasNoSkills = skills.some(x => x === "none yet");

  if (/(?:requires|must have|need(?:s)?|only works on|available only on)[^.]{0,100}\b(?:laptop|computer|desktop)\b/i.test(text) && !hasLaptop) {
    hardBlockers.push("Current evidence says a laptop/computer is required, but your profile does not include one.");
  } else if (/(?:requires|must have|need(?:s)?|only works on|available only on)[^.]{0,100}\b(?:smartphone|android|iphone|mobile phone)\b/i.test(text) && !hasPhone) {
    hardBlockers.push("Current evidence says a smartphone is required, but your profile does not include one.");
  }

  const idMatch = text.match(/(?:requires|must provide|need(?:s)?|accepts only)[^.]{0,100}\b(nin|national id|passport|driver'?s licence|driver'?s license|voter'?s card)\b/i);
  if (idMatch && hasNoId) {
    hardBlockers.push(`Current evidence says ${idMatch[1]} is required, but your profile has no listed ID.`);
  }

  const skillMap = [
    ["design", "design"],
    ["video", "video"],
    ["programming", "programming"],
    ["coding", "programming"],
    ["writing", "writing"],
    ["social media", "social media"],
    ["teaching", "teaching"]
  ];
  for (const [term, skill] of skillMap) {
    if (new RegExp(`(?:requires|need(?:s)?|must have|experience in)[^.]{0,100}\\b${term}\\b`, "i").test(text) &&
        (hasNoSkills || !skills.some(x => x.includes(skill)))) {
      hardBlockers.push(`Current evidence says ${term} skills are required, but your profile does not list that skill.`);
      break;
    }
  }

  if (/(?:requires|need(?:s)?|must have)[^.]{0,80}\b(?:experience|experienced)\b/i.test(text) &&
      experience.includes("complete beginner")) {
    hardBlockers.push("Current evidence indicates prior experience is required, but your profile says you are a complete beginner.");
  }

  const costMatch = text.match(/(?:requires|costs|fee(?:s)?|minimum(?: fee)?|deposit)[^.]{0,100}(?:₦|ngn|naira)\s?([0-9,]+)/i);
  if (costMatch) {
    const required = Number(costMatch[1].replace(/,/g, ""));
    const budgetMatch = budget.match(/₦?([0-9,]+)[^0-9]+₦?([0-9,]+)/);
    const zeroBudget = budget.includes("₦0");
    const maxBudget = budget.includes("50,000+") ? Infinity : budgetMatch ? Number(budgetMatch[2].replace(/,/g, "")) : 0;
    if (required > maxBudget) {
      hardBlockers.push(`Current evidence indicates a starting cost of about ₦${required.toLocaleString()}, above your selected budget.`);
    } else if (zeroBudget && required > 0) {
      hardBlockers.push(`Current evidence indicates a starting cost of about ₦${required.toLocaleString()}, but your selected budget is ₦0.`);
    }
  }

  if (/(?:requires|need(?:s)?|must have)[^.]{0,100}\b(?:3\+|at least 3|three)\s*(?:hours?|hrs?)\b/i.test(text) &&
      String(profile?.time || "").toLowerCase().includes("under 1 hour")) {
    cautions.push("Current evidence suggests at least 3 hours/day may be needed, while your selected time is under 1 hour/day.");
  }

  if (!hardBlockers.length && !cautions.length) {
    matches.push("No clear profile blocker was found in the current evidence.");
  }

  return { hardBlockers, cautions, matches };
}

function getOpportunityAliases(name, claim = "", url = "") {
  const normalized = String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const aliases = new Set();
  if (normalized) aliases.add(normalized);

  const aliasGroups = [
    {
      matches: ["youtube", "youtube content creation", "youtube content creator", "youtube content creation in nigeria"],
      aliases: ["youtube", "youtube creators", "youtube creator", "youtube partner program", "youtube monetization", "youtube studio", "youtube channel", "adsense for youtube"]
    },
    {
      matches: ["google adsense", "adsense"],
      aliases: ["google adsense", "adsense", "adsense for youtube"]
    }
  ];

  for (const group of aliasGroups) {
    if (group.matches.some(term => normalized === term || normalized.includes(term))) {
      group.aliases.forEach(alias => aliases.add(alias));
    }
  }

  try {
    const host = url ? new URL(url).hostname.toLowerCase().replace(/^www\./, "") : "";
    if (host) aliases.add(host);
  } catch {}

  return [...aliases].filter(alias => alias.length >= 4);
}

export function buildResearchBreakdown({ name, claim, sources = [], profile = {}, assessment = {} }) {
  const normalizedName = String(name || "").trim();
  const relevantSources = Array.isArray(sources) ? sources : [];
  const allText = relevantSources.map(s => String(s.content || "")).join(" ");
  const normalizedAllText = allText.toLowerCase();

  const sentences = relevantSources.flatMap(source => {
    const raw = String(source.content || "").replace(/\s+/g, " ").trim();
    const sourceIdentityText = `${source.title || ""} ${source.url || ""} ${raw}`.toLowerCase();
    const sourceSpecific = opportunityAnchors.some(anchor =>
      sourceIdentityText.includes(anchor) ||
      sourceIdentityText.replace(/[^a-z0-9]/g, "").includes(anchor.replace(/[^a-z0-9]/g, ""))
    );
    return raw
      .split(/(?<=[.!?])\s+/)
      .map(text => ({ text: text.trim(), title: source.title || "", url: source.url || "", sourceSpecific }))
      .filter(item => item.text.length >= 20);
  });

  const opportunityAnchors = getOpportunityAliases(normalizedName, claim)
    .map(alias => alias.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim())
    .filter(Boolean);

  const isOpportunitySpecific = item => {
    if (item.sourceSpecific) return true;
    const lower = item.text.toLowerCase();
    if (opportunityAnchors.some(anchor => lower.includes(anchor))) return true;
    try {
      const host = new URL(item.url).hostname.toLowerCase();
      const compactHost = host.replace(/[^a-z0-9]/g, "");
      return opportunityAnchors.some(anchor => compactHost.includes(anchor.replace(/[^a-z0-9]/g, "")));
    } catch {
      return false;
    }
  };

  const cleanSentence = text => String(text || "")
    .replace(/^[-•*]\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 260);

  const findEvidence = patterns => {
    const candidates = sentences.filter(isOpportunitySpecific);
    for (const pattern of patterns) {
      const match = candidates.find(item => pattern.test(item.text));
      if (match) return cleanSentence(match.text);
    }
    return "";
  };

  const claimText = String(claim || "").trim();
  const workTypeEvidence = findEvidence([
    /(?:work|job|role|project|task|creator|create|content|service|freelance|research|testing|data)/i
  ]);

  const breakdown = {
    opportunity: {
      status: claimText ? "Claim checked against current evidence" : (workTypeEvidence ? "Evidence found" : "Not clearly stated"),
      evidence: claimText || workTypeEvidence || "The current evidence does not clearly describe the work.",
      workType: workTypeEvidence || claimText || "Not clearly stated"
    },
    legitimacy: {
      status: findEvidence([/legitimate|established|reputable|registered company|official (?:site|website)|terms of service|privacy policy|founded in/i]) ? "Evidence found" : "Not clearly established",
      evidence: findEvidence([/legitimate|established|reputable|registered company|official (?:site|website)|terms of service|privacy policy|founded in/i]) || "No clear opportunity-specific legitimacy evidence was found."
    },
    nigeriaAccess: {
      status: findEvidence([/nigeria[^.]{0,180}(?:supported|available|eligible|accepts|accepted|open to|can participate)|nigerian users|users in nigeria/i]) ? "Evidence found" : "Needs confirmation",
      evidence: findEvidence([/nigeria[^.]{0,180}(?:supported|available|eligible|accepts|accepted|open to|can participate)|nigerian users|users in nigeria/i]) || "No clear current Nigeria-access evidence was found."
    },
    requirements: {
      status: findEvidence([/identity verification|kyc|id verification|proof of identity|qualification|application|invite-only|laptop|smartphone|phone|computer|experience|skill/i]) ? "Conditions found" : "Not clearly stated",
      evidence: findEvidence([/identity verification|kyc|id verification|proof of identity|qualification|application|invite-only|laptop|smartphone|phone|computer|experience|skill/i]) || "No clear device, ID, skill or qualification requirement was found."
    },
    gettingPaid: {
      status: findEvidence([/payment|payout|paid|bank|paypal|payoneer|paystack|flutterwave|adsense/i]) ? "Payment evidence found" : "Needs confirmation",
      evidence: findEvidence([/payment|payout|paid|bank|paypal|payoneer|paystack|flutterwave|adsense/i]) || "No clear current payment method was found."
    },
    withdrawal: {
      status: findEvidence([/withdraw|withdrawal|minimum payout|payout threshold|threshold|payment schedule|paid (?:weekly|monthly)/i]) ? "Withdrawal evidence found" : "Needs confirmation",
      evidence: findEvidence([/withdraw|withdrawal|minimum payout|payout threshold|threshold|payment schedule|paid (?:weekly|monthly)/i]) || "No clear current withdrawal condition was found."
    },
    earnings: {
      status: findEvidence([/earnings|income|revenue|rpm|cpm|rate|hourly|per task|per project|not guaranteed|var(?:y|ies)/i]) ? "Earnings evidence found" : "Not clearly stated",
      evidence: findEvidence([/earnings|income|revenue|rpm|cpm|rate|hourly|per task|per project|not guaranteed|var(?:y|ies)/i]) || "No clear current earnings information was found."
    },
    availability: {
      status: findEvidence([/current project|current task|availability|available|project-dependent|waitlist|invite-only|qualification|limited|eligible/i]) ? "Current/conditional evidence found" : "Needs confirmation",
      evidence: findEvidence([/current project|current task|availability|available|project-dependent|waitlist|invite-only|qualification|limited|eligible/i]) || "No clear current availability information was found."
    },
    realCost: {
      status: findEvidence([/fee|fees|commission|minimum payout|threshold|deposit|invest|subscription|equipment|camera|phone|data|internet|free to join|free to start/i]) ? "Cost evidence found" : "No clear upfront cost found",
      evidence: findEvidence([/fee|fees|commission|minimum payout|threshold|deposit|invest|subscription|equipment|camera|phone|data|internet|free to join|free to start/i]) || "No clear upfront cash cost was found in the available evidence."
    },
    yourFit: {
      status: "Profile considered",
      evidence: [
        profile?.devices?.join(", "),
        profile?.budgetLabel,
        profile?.experience,
        profile?.time,
        Array.isArray(profile?.goals) ? profile.goals.join(", ") : ""
      ].filter(Boolean).join(" • ") || "Your submitted profile is considered when the evidence contains a clear requirement."
    },
    biggestCatch: {
      status: "Evidence-based",
      evidence: ""
    }
  };

  const assessmentBlockers = Array.isArray(assessment.blockers) ? assessment.blockers : [];
  const assessmentCautions = Array.isArray(assessment.cautions) ? assessment.cautions : [];
  const assessmentUnknowns = Array.isArray(assessment.unknowns) ? assessment.unknowns : [];

  breakdown.biggestCatch.evidence =
    assessmentBlockers[0] ||
    assessmentCautions[0] ||
    assessmentUnknowns[0] ||
    findEvidence([/not guaranteed|depends|var(?:y|ies)|project-dependent|limited|competition|qualification|kyc|identity verification|fee|commission|withdraw/i]) ||
    "No specific major catch was identified in the available opportunity-specific evidence.";

  breakdown.legitimacy.evidence = breakdown.legitimacy.evidence.replace(/^Current sources were checked.*$/i, "");
  return breakdown;
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
