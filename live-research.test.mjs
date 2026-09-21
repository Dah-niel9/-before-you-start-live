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
        source("Acme Work Nigeria eligibility", "https://www.gov.ng/acmework", "Acme Work is supported in Nigeria. Nigerian users are eligible to participate."),
        source("Acme Work payment review", "https://example.com/acme-work-review", "Acme Work payouts are available and workers report a payment option."),
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
        source("Bad Work warning", "https://example.com/warning", "Users report Bad Work is fraud and call it a scam. Nigeria is not supported."),
        source("Bad Work warning 2", "https://example.org/report", "Independent reports about Bad Work describe a fake platform and phishing concerns. Nigeria is excluded."),
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
        source("Maybe Work project overview", "https://example.com/maybe-work", "Maybe Work projects are available and payments are made to workers."),
      ]
    }
  },
  {
    name: "unknown opportunity ignores generic unrelated sources",
    expected: "NOT ENOUGH RELIABLE EVIDENCE",
    expectedMatched: 0,
    input: {
      name: "OneForma",
      claim: "AI and data-work projects",
      answer: "Generic freelancing and make-money-online pages were found.",
      profile: { devices: ["Android phone"], budgetLabel: "₦0", experience: "Complete beginner", time: "1–3 hours/day", goals: ["Steady Income"] },
      sources: [
        source("Best freelancing platforms in Nigeria", "https://example.com/freelancing-nigeria", "Freelancing platforms can offer work to Nigerian users and may pay workers."),
        source("Make money online in Nigeria", "https://example.com/make-money", "Many online opportunities exist in Nigeria, but availability varies."),
        source("How to earn online", "https://example.com/earn-online", "Users can earn money online from various websites.")
      ]
    }
  },
  {
    name: "OneForma identity keeps relevant evidence and rejects generic evidence",
    expected: "MAYBE",
    expectedMatched: 2,
    input: {
      name: "OneForma",
      claim: "AI and data-work projects",
      answer: "OneForma project information was found.",
      profile: { devices: ["Android phone"], budgetLabel: "₦0", experience: "Complete beginner", time: "1–3 hours/day", goals: ["Steady Income"] },
      sources: [
        source("OneForma official website", "https://www.oneforma.com/", "OneForma is an established legitimate platform. Official OneForma website and support information are available."),
        source("OneForma projects", "https://example.com/oneforma-projects", "OneForma projects are available and requirements vary by project."),
        source("Best freelancing platforms in Nigeria", "https://example.com/freelancing-nigeria", "Freelancing platforms can offer work to Nigerian users and may pay workers.")
      ]
    }
  },
  {
    name: "unsupported generic claims do not become opportunity evidence",
    expected: "MAYBE",
    input: {
      name: "OneForma",
      claim: "AI and data-work projects",
      answer: "OneForma information was found.",
      profile: {},
      sources: [
        source("OneForma official website", "https://www.oneforma.com/", "OneForma is an established legitimate platform with an official website."),
        source("OneForma payment discussion", "https://example.com/oneforma-payment", "OneForma is mentioned here. Freelancing platforms may pay workers, but this page does not establish OneForma payment methods."),
        source("OneForma Nigeria discussion", "https://example.com/oneforma-nigeria", "OneForma is mentioned here. Many platforms are available in Nigeria, but this page does not establish OneForma eligibility.")
      ]
    }
  },
  {
    name: "opportunity-linked claims are allowed as evidence",
    expected: "MAYBE",
    input: {
      name: "OneForma",
      claim: "AI and data-work projects",
      answer: "OneForma information was found.",
      profile: {},
      sources: [
        source("OneForma official website", "https://www.oneforma.com/", "OneForma is an established legitimate platform with an official website."),
        source("OneForma payment information", "https://example.com/oneforma-payment", "OneForma payments are available through supported payment methods for eligible workers."),
        source("OneForma Nigeria information", "https://example.com/oneforma-nigeria", "OneForma is available to eligible users in Nigeria, subject to current project requirements.")
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
        source("Forum mention", "https://example.com/post", "Someone mentioned this opportunity online.")
      ]
    }
  }
];

for (const c of cases) {
  test(c.name, () => {
    const result = assessLiveEvidence(c.input);
    assert.equal(result.verdict, c.expected, JSON.stringify(result, null, 2));
    if (c.expectedMatched !== undefined) {
      assert.equal(result.matchedSourceCount, c.expectedMatched, JSON.stringify(result, null, 2));
    }
  });
}
