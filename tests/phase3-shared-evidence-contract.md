# Phase 3 — Shared evidence contract (experimental only)

Both Individual (15 calls × 1 field) and Grouped (3 calls × 5 fields) must receive identical field definitions, source excerpts, model, temperature, evidence rules, and output schema. Only grouping differs.

## Evidence rules
1. Answer solely from supplied evidence; unsupported claims become `not_established`.
2. Separate mandatory requirements from optional or recommended items.
3. Preserve stages: signup, starting work, monetization eligibility, payment verification, withdrawal, receipt.
4. Do not generalize one provider, country, or payment method to all providers.
5. Distinguish creator promotions from typical earnings, salaries from personal trading profit/loss.
6. Time to first money includes eligibility, approval, thresholds and processing where relevant.
7. Cite only supporting supplied source IDs. Never invent citations or amounts.
8. Flag conflicting evidence and missing details; prioritize official sources for provider-specific policies.
9. Answer the assigned field, not a nearby concept.

## Output contract
Return JSON only: `{"fields":{"fieldId":{"answer":"...","status":"established|partially_established|not_established|conflicting","supporting_sources":[],"missing":[],"conflict":[]}}}`.

## Gate before paid tests
Freeze one evidence packet per field and verify both architectures receive identical packets. Normalize array/object response variants. Enforce serial requests and token-aware backoff, retry only missing requests, never interpret HTTP 429/413 as an incorrect answer. Score each answer against source support and traceability; ambiguous answers require human review. No production changes and no Tavily calls.
