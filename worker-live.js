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
      `Investigate "${name}" for a person in Nigeria.`,
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
      profile
    });

    return json({
      ok: true,
      answer: data.answer || "Current sources were found, but Tavily did not return a research summary.",
      sources,
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

function assessLiveEvidence({ name, claim, answer, sources, profile }) {
  const corpus = [name, claim, answer, ...sources.map(x => `${x.title} ${x.content}`)]
    .join(" ")
    .toLowerCase();

  const sourceCount = sources.length;
  const officialHits = sources.filter(x => {
    try {
      const host = new URL(x.url).hostname.toLowerCase().replace(/^www\./, "");
      return /(\.gov$|\.gov\.|official|support|help|docs|company|about)/i.test(host) ||
        /official|support|help center|terms|privacy|careers|pricing|withdraw/i.test(x.title || "");
    } catch {
      return false;
    }
  }).length;

  const strongNegativePatterns = [
    /scam|fraud|fake|impersonat|phishing|malware|ponzi|pyramid scheme/,
    /nigeria[^.]{0,100}(not supported|unsupported|excluded|unavailable|blocked|prohibited)/,
    /(requires|must).{0,80}(pay|deposit|invest).{0,80}(before|to start|to withdraw)/,
    /withdrawal[^.]{0,80}(impossible|not possible|blocked|problem|complaint)/,
    /many complaints|numerous complaints|regulatory warning|government warning/
  ];

  const strongPositivePatterns = [
    /legitimate|legit|established|reputable|well[- ]known/,
    /nigeria[^.]{0,120}(supported|available|eligible|accepts|accepted)/,
    /nigerian users|users in nigeria|available in nigeria/,
    /official (site|website|support|documentation)/,
    /payout|withdraw|payment[^.]{0,100}(supported|available|paid)/,
    /terms|privacy policy|help center|support center/
  ];

  const cautionPatterns = [
    /project[- ]dependent|availability[^.]{0,80}(varies|limited|depends)/,
    /waitlist|qualification|application|invite[- ]only/,
    /identity verification|kyc|id verification|proof of identity/,
    /competition|competitive|limited slots/,
    /earnings[^.]{0,100}(vary|varies|not guaranteed|depends)/,
    /fee|fees|commission|minimum payout|threshold/
  ];

  const negativeHits = strongNegativePatterns.filter(r => r.test(corpus)).length;
  const positiveHits = strongPositivePatterns.filter(r => r.test(corpus)).length;
  const cautionHits = cautionPatterns.filter(r => r.test(corpus)).length;

  const blockers = [];
  const cautions = [];

  if (negativeHits) {
    if (/nigeria[^.]{0,100}(not supported|unsupported|excluded|unavailable|blocked|prohibited)/.test(corpus)) {
      blockers.push("Current evidence indicates Nigeria access is restricted or unavailable.");
    }
    if (/(requires|must).{0,80}(pay|deposit|invest).{0,80}(before|to start|to withdraw)/.test(corpus)) {
      blockers.push("Current evidence indicates an upfront payment, deposit or investment requirement.");
    }
    if (/scam|fraud|fake|impersonat|phishing|ponzi|pyramid scheme/.test(corpus)) {
      blockers.push("Current sources contain serious scam, fraud or impersonation warnings.");
    }
  }

  if (cautionHits) {
    cautions.push("Some important conditions such as qualification, KYC, fees, competition or project availability may apply.");
  }

  const hasEnoughEvidence = sourceCount >= 3 && positiveHits >= 2;
  let verdict = "NOT ENOUGH RELIABLE EVIDENCE";
  let reason = "The available sources do not provide enough consistent evidence for a responsible recommendation.";

  if (negativeHits >= 2 || blockers.length >= 2) {
    verdict = "SKIP";
    reason = "The current evidence contains serious problems or restrictions that make this route unsuitable to pursue right now.";
  } else if (hasEnoughEvidence && negativeHits === 0 && officialHits >= 1) {
    verdict = "TRY";
    reason = "Current sources provide multiple positive signals, including evidence of a real operation and relevant access or support for Nigerian users.";
  } else if (sourceCount >= 2 && positiveHits >= 1 && negativeHits === 0) {
    verdict = "MAYBE";
    reason = "There is evidence that the opportunity may be real or accessible, but important conditions or uncertainties remain.";
  }

  if (verdict === "TRY" && cautionHits >= 3) {
    verdict = "MAYBE";
    reason = "The opportunity shows positive signals, but several conditions or uncertainties still need to be confirmed before committing serious time or money.";
  }

  const confidence = verdict === "NOT ENOUGH RELIABLE EVIDENCE"
    ? "Low"
    : verdict === "SKIP"
      ? (negativeHits >= 2 ? "High for the flagged risks" : "Medium")
      : verdict === "TRY"
        ? "Medium"
        : "Medium";

  const changes = verdict === "TRY"
    ? "Confirm the exact current requirements, payment terms and availability before starting."
    : verdict === "MAYBE"
      ? "Confirm the unresolved requirements, Nigeria access, payment terms and current availability."
      : verdict === "SKIP"
        ? "A credible current source would need to directly contradict the flagged restriction or risk."
        : "More reliable, current evidence from official or independent sources is needed.";

  return {
    verdict,
    confidence,
    reason,
    blockers,
    cautions,
    unknowns: verdict === "NOT ENOUGH RELIABLE EVIDENCE" ? ["The evidence base is too thin or inconsistent to classify this opportunity responsibly."] : [],
    changes
  };
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
