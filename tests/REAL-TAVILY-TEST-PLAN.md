# Real Tavily evidence test — Step 3

## Plain-English purpose
We have tested whether Groq understands four short, invented examples. Next we must see whether it can correctly read the actual information Tavily finds online. This is an isolated experiment, not a change to the live Before You Start result page.

## What we will test
Use three *different kinds* of online opportunity: a freelance marketplace, a microtask platform, and a digital-product selling opportunity. Select exact opportunity names before running; do not build rules around YouTube automation.

For each opportunity:
1. Run the same existing Tavily research questions as the current Worker, without changing the Worker.
2. Save the exact Tavily result excerpts, source URLs, country context, and any Tavily-generated answer in a test-only fixture. Never store API keys or private user information.
3. Give those saved results to GPT-OSS 120B, one existing Before You Start field at a time, using the same field-specific rules. Tavily's generated answer is a hint, not proof.
4. For every field, record: the AI's answer, which source excerpts support it, what remains unknown, and whether the claim applies to Nigeria.
5. Manually inspect the original cited pages for a sample of critical claims. A link or Tavily excerpt alone does not confirm truth.
6. Test for known errors: wrong platform, wrong country, optional cost treated as compulsory, payout stage confused with sign-up stage, unrelated jobs used as proof of availability, and unsupported confident answers.

## What counts as success
- Supported facts appear in the correct existing result fields.
- Unsupported or country-unclear claims are not presented as confirmed.
- Known facts are preserved even if some details remain unknown.
- Source IDs actually support the sentences attributed to them.
- The system works across unrelated opportunities, not just YouTube.

## Costs and safety
- First stage: prepare test design and inspect existing code: **0 Tavily credits and 0 Groq tokens**.
- Second stage: reuse any genuinely saved raw Tavily responses, if available and complete: **0 new Tavily credits**; Groq usage depends on number of calls and text size.
- If no suitable saved raw results exist, run **one** limited Tavily research batch first, measure actual credits, and only then decide whether to expand to the other opportunities. Do not assume a fixed credit count; Tavily charges depend on search settings and call count.
- Never run paid or quota-consuming live research automatically on GitHub pushes.
- No changes to `main`, deployment, verdict logic, or existing result page.

## Next implementation task
Build a test-only way to capture and replay Tavily's real research output using the Worker's existing research format, while keeping the Groq key and Tavily key in secrets. Before the first Tavily call, show the exact query count, Tavily settings, and expected maximum credits for that run. Review the test plan and the capture code before spending credits.

## Current status
Design written; real Tavily research has **not** been run. Four synthetic cases are not sufficient evidence that the full product works.
