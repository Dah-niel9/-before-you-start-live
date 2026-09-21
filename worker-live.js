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
      profile.experience ? `Experience: ${profile.experience}.` : "",
      profile.time ? `Time: ${profile.time}.` : "",
      Array.isArray(profile.goals) ? `Goal: ${profile.goals.join(", ")}.` : ""
    ].filter(Boolean).join(" ");

    const queryParts = [
      `Investigate only the specific opportunity "${name}" for a person in Nigeria. Do not substitute generic freelancing, make-money-online, or unrelated platform information.`,
      claim ? `Claim: "${claim}".` : "",
      url ? `Link: ${url}` : "",
      profileLine,
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
      researchBreakdown: buildResearchBreakdown({ name, claim, sources: assessment.sources || [], profile }),
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

  const relevantSources = normalizedSources.filter(matchesOpportunity);
  const sourceCount = relevantSources.length;

  const isLikelyOfficial = source => {
    if (!source.host) return false;
    if (/(^|\\.)gov(\\.|$)/.test(source.host)) return true;
    if (!nameTokens.length) return false;
    const compactHost = source.host.replace(/[^a-z0-9]/g, "");
    return nameTokens.some(token => compactHost.includes(token));
  };

  const strongNegativePatterns = [
    /\\bscam(?:med|ming)?\\b|\\bfraud(?:ulent)?\\b|\\bfake platform\\b|\\bimpersonat(?:ion|ing|ed)\\b|\\bphishing\\b|\\bmalware\\b|\\bponzi\\b|\\bpyramid scheme\\b/,
    /nigeria[^.]{0,180}(?:not supported|unsupported|excluded|unavailable|blocked|prohibited)/,
    /(?:requires|must|need to)\\s+(?:pay|deposit|invest|send money)[^.]{0,120}(?:before|to start|to withdraw|for access)/,
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
    const opportunityAnchors = [
      normalizedName,
      ...nameTokens
    ].filter(Boolean);
    if (!opportunityAnchors.length) return false;

    const isPositiveEvidenceSentence = sentence => {
      if (!pattern.test(sentence)) return false;
      return !/(?:does not establish|doesn't establish|does not prove|doesn't prove|not evidence|not proof|not supported|unsupported|not available|unavailable|not eligible|not accepted|may pay|might pay|could pay|many platforms|other platforms)/i.test(sentence);
    };

    if (suppliedHost && source.host && (source.host === suppliedHost || source.host.endsWith("." + suppliedHost))) {
      return isPositiveEvidenceSentence(compact);
    }

    const sentences = compact.split(/(?<=[.!?])\s+/);
    return opportunityAnchors.some(anchor =>
      sentences.some(sentence => sentence.includes(anchor) && isPositiveEvidenceSentence(sentence))
    );
  };

  const sourceSignals = relevantSources.map(source => {
    const negativePatterns = strongNegativePatterns.filter(pattern => supportsPattern(source, pattern));
    const supportedDimensions = Object.entries(positivePatterns)
      .filter(([, pattern]) => supportsPattern(source, pattern))
      .map(([key]) => key);
    const cautions = cautionPatterns.filter(pattern => supportsPattern(source, pattern)).length;
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
  const upfrontPayment = /(?:requires|must|need to)\\s+(?:pay|deposit|invest|send money)[^.]{0,120}(?:before|to start|to withdraw|for access)/;
  const scamWarning = /\\bscam(?:med|ming)?\\b|\\bfraud(?:ulent)?\\b|\\bfake platform\\b|\\bimpersonat(?:ion|ing|ed)\\b|\\bphishing\\b|\\bmalware\\b|\\bponzi\\b|\\bpyramid scheme\\b/;

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

  const confidence = verdict === "NOT ENOUGH RELIABLE EVIDENCE"
    ? "Low"
    : verdict === "SKIP"
      ? (negativeSources.length >= 2 || officialNegativeSources.length ? "High for the flagged risks" : "Medium")
      : "Medium";

  const changes = verdict === "TRY"
    ? "Confirm the exact current requirements, payment terms and availability before starting."
    : verdict === "MAYBE"
      ? "Confirm the unresolved requirements, Nigeria access, payment terms and current availability."
      : verdict === "SKIP"
        ? "A credible current source would need to directly contradict the flagged restriction or risk."
        : "More reliable, current evidence from official or independent sources is needed.";

  return {
    sources: relevantSources.map(({ text, host, ...source }) => source),
    matchedSourceCount: sourceCount,
    verdict,
    confidence,
    reason,
    blockers,
    cautions,
    unknowns: verdict === "NOT ENOUGH RELIABLE EVIDENCE"
      ? ["The evidence base is too thin or inconsistent to classify this opportunity responsibly."]
      : [],
    changes
  };
}
function buildResearchBreakdown({ name, claim, sources, profile }) {
  const text = sources.map(s => String(s.content || "")).join(" ").toLowerCase();
  const has = pattern => pattern.test(text);
  const fit = label => profile && label ? label : "";

  return {
    legitimacy: {
      status: has(/legitimate|established|reputable|registered company|official site|terms of service|privacy policy/) ? "Evidence found" : "Not clearly established",
      evidence: "Current sources were checked for legitimacy signals, official documentation and serious warnings."
    },
    nigeriaAccess: {
      status: has(/nigeria[^.]{0,180}(supported|available|eligible|accepts|accepted|open to|can participate)|nigerian users|users in nigeria/) ? "Evidence found" : "Needs confirmation",
      evidence: "Sources were checked specifically for Nigeria eligibility and restrictions."
    },
    requirements: {
      status: has(/identity verification|kyc|id verification|proof of identity|qualification|application|invite-only|laptop|smartphone|phone/) ? "Conditions found" : "Not clearly stated",
      evidence: "Sources were checked for device, KYC, ID, skill and qualification requirements."
    },
    gettingPaid: {
      status: has(/payout|withdraw|payment|paid|bank|paypal|payoneer|paystack|flutterwave/) ? "Payment evidence found" : "Needs confirmation",
      evidence: "Sources were checked for payment methods, withdrawal conditions and payout information."
    },
    earnings: {
      status: has(/earnings|income|pay|payout|rate|hourly|per task|per project/) ? "Earnings information found" : "Not clearly stated",
      evidence: "Sources were checked for earning information without treating marketing claims as guaranteed income."
    },
    availability: {
      status: has(/project-dependent|availability|limited|waitlist|qualification|invite-only|current projects|current tasks/) ? "Variable / conditional" : "Needs confirmation",
      evidence: "Sources were checked for current project or task availability."
    },
    realCost: {
      status: has(/fee|fees|commission|minimum payout|threshold|deposit|invest|data|subscription/) ? "Cost conditions found" : "No clear upfront cost found",
      evidence: "Sources were checked for money, fees, payout thresholds and other practical costs."
    },
    yourFit: {
      status: "Profile considered",
      evidence: [fit(profile?.devices?.join(", ")), fit(profile?.budgetLabel), fit(profile?.experience), fit(profile?.time), fit(profile?.goals?.join(", "))].filter(Boolean).join(" • ") || "Your submitted profile is considered by the decision layer."
    },
    biggestCatch: {
      status: "See verdict conditions",
      evidence: "The decision layer highlights blockers, cautions and unresolved evidence rather than hiding uncertainty."
    }
  };
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
