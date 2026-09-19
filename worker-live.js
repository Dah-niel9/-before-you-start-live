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

    const devices = Array.isArray(profile.devices) ? profile.devices.join(", ") : "";
    const ids = Array.isArray(profile.ids) ? profile.ids.join(", ") : "";
    const skills = Array.isArray(profile.skills) ? profile.skills.join(", ") : "";
    const goals = Array.isArray(profile.goals) ? profile.goals.join(", ") : "";

    const queryParts = [
      `Investigate "${name}" for a person in Nigeria.`,
      claim ? `Claim: "${claim}".` : "",
      url ? `Link: ${url}` : "",
      "Check legitimacy, Nigeria access, requirements, payments, costs, availability, earnings, and risks. Prefer official and current sources."
    ].filter(Boolean);

    let query = queryParts.join(" ");
    if (query.length > 390) query = query.slice(0, 390);

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
      return json({ ok: false, error: `Tavily request failed (${tavily.status}).`, detail: detail.slice(0, 500) }, 502);
    }

    const data = await tavily.json();
    const sources = Array.isArray(data.results)
      ? data.results.slice(0, 5).map(item => ({
          title: item.title || item.url || "Source",
          url: item.url || "",
          content: item.content || ""
        })).filter(item => item.url)
      : [];

    return json({
      ok: true,
      answer: data.answer || "Current sources were found, but Tavily did not return a research summary.",
      sources
    });
  } catch (error) {
    return json({
      ok: false,
      error: "Live Research could not complete this check right now.",
      detail: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
