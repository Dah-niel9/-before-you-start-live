
import { readFile, writeFile, mkdir } from "node:fs/promises";

const archive = JSON.parse(
  await readFile("saved-evidence/unified-15-real-evidence.json", "utf8")
);

const opportunity = archive.opportunities.find(
  item => item.name === "Forex trading"
);

if (!opportunity) throw Error("Saved opportunity not found");
if (!process.env.GROQ_API_KEY) throw Error("Missing GROQ_API_KEY");

const names = [
  "opportunity",
  "nigeriaAccess",
  "kyc",
  "startingCost",
  "earnings"
];

const system = `You evaluate evidence about online opportunities for people in Nigeria.
Return a JSON object with a "fields" object containing the supplied field key.
Each answer must contain: answer, status, supporting_sources, missing, conflict.
Status must be established, partially_established, or not_established.
Cite only supplied source IDs. Do not invent facts.
Do not infer Nigerian requirements from another country.
Distinguish optional costs from mandatory costs.
Treat uncertain earnings claims as uncertain.
When evidence is insufficient, answer "No clear evidence found."
and set status to not_established.
Keep answers concise.`;

const report = {
  opportunity: opportunity.name,
  method: "individual",
  answers: {},
  attempts: [],
  totalTokens: 0
};

await mkdir("tests/artifacts", { recursive: true });

for (let i = 0; i < names.length; i++) {
  const key = names[i];
  const packet = opportunity.packets.find(p => p.key === key);

  if (!packet) throw Error("Missing evidence for " + key);

  const field = {
    key,
    question: packet.question,
    rule: packet.rule,
    evidence: packet.evidence.slice(0, 3).map(source => ({
      id: source.id,
      title: source.title,
      url: source.url,
      excerpt: source.excerpt.slice(0, 900)
    }))
  };

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.GROQ_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        temperature: 0,
        max_completion_tokens: 1250,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: JSON.stringify({
              opportunity: opportunity.name,
              fields: [field]
            })
          }
        ]
      })
    }
  );

  const raw = await response.text();

  const attempt = {
    key,
    status: response.status,
    field,
    raw: raw.slice(0, 15000)
  };

  if (response.ok) {
    const result = JSON.parse(raw);
    attempt.usage = result.usage;
    report.totalTokens += result.usage?.total_tokens || 0;

    try {
      const parsed = JSON.parse(result.choices[0].message.content);
      report.answers[key] = (parsed.fields || parsed)[key] || (Array.isArray(parsed.fields) ? parsed.fields.find(x => x.key === key) : null) || null;
    } catch (error) {
      attempt.parseError = String(error);
    }
  }

  report.attempts.push(attempt);

  await writeFile(
    "tests/artifacts/forex-individual-first-five.json",
    JSON.stringify(report, null, 2)
  );

  console.log(JSON.stringify({
    field: key,
    status: response.status,
    answered: !!report.answers[key],
    tokens: attempt.usage?.total_tokens || null
  }));

  if (!response.ok) {
    console.log("Groq error:", raw.slice(0, 500));
    process.exitCode = 1;
    break;
  }

  if (i < names.length - 1) {
    await new Promise(resolve => setTimeout(resolve, 65000));
  }
}

console.log("Total tokens:", report.totalTokens);

if (names.some(key => !report.answers[key])) {
  process.exitCode = 1;
}
  
