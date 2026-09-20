import test from "node:test";
import assert from "node:assert/strict";
import { assessLiveEvidence } from "./worker-live.js";

const source = (title, url, content) => ({ title, url, content });

const cases = [
  {
    name: "strong positive evidence",
    expected: "TRY",
    input: {
      name: "Acme Work",
      claim: "Remote work opportunities",
      answer: "Current evidence supports the opportunity.",
      profile: { devices: ["Android phone"], budgetLabel: "₦0", experience: "Complete beginner", time: "1–3 hours/day", goals: ["Extra Cash"] },
      sources: [
        source("Acme Work official website", "https://acmework.com", "Acme Work is an established legitimate company. Official website and terms of service are available."),
        source("Nigeria eligibility", "https://www.gov.ng/acmework", "Nigeria supported. Nigerian users are eligible to participate."),
        source("Independent payment review", "https://example.com/acme-work-review", "Payouts are available and workers report a payment option."),
      ]
    }
  },
  {
    name: "serious negative evidence",
    expected: "SKIP",
    input: {
      name: "Bad Work",
      claim: "Make money online",
      answer: "Warnings were found.",
      profile: {},
      sources: [
        source("Bad Work warning", "https://example.com/warning", "Users report fraud and call this a scam. Nigeria is not supported."),
        source("Bad Work warning 2", "https://example.org/report", "Independent reports describe a fake platform and phishing concerns. Nigeria is excluded."),
      ]
    }
  },
  {
    name: "useful but incomplete evidence",
    expected: "MAYBE",
    input: {
      name: "Maybe Work",
      claim: "Remote projects",
      answer: "The platform appears to operate, but requirements vary.",
      profile: {},
      sources: [
        source("Maybe Work overview", "https://maybe-work.com", "Maybe Work is an established legitimate company with an official website."),
        source("Project overview", "https://example.com/maybe-work", "Projects are available and payments are made to workers."),
      ]
    }
  },
  {
    name: "thin evidence",
    expected: "NOT ENOUGH RELIABLE EVIDENCE",
    input: {
      name: "Unknown Work",
      claim: "Online opportunity",
      answer: "",
      profile: {},
      sources: [
        source("Forum mention", "https://example.com/post", "Someone mentioned this opportunity online."),
      ]
    }
  }
];

for (const c of cases) {
  test(c.name, () => {
    const result = assessLiveEvidence(c.input);
    assert.equal(result.verdict, c.expected, JSON.stringify(result, null, 2));
  });
}
