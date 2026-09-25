import { readFileSync } from "node:fs";
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
    expected: "TRY",
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


// Defect C: verdict integrity. The final verdict must come from
// opportunity-linked evidence, not from a generic Tavily summary or unrelated sources.
test("verdict ignores a generic Tavily summary when evidence is strong", () => {
  const input = {
    name: "Clean Work",
    claim: "Remote work opportunities",
    answer: "This generic summary says the opportunity is risky and not recommended, but it does not discuss Clean Work.",
    profile: {},
    sources: [
      source("Clean Work official", "https://cleanwork.com", "Clean Work is an established legitimate company with an official website and terms of service."),
      source("Clean Work Nigeria", "https://www.gov.ng/cleanwork", "Clean Work is supported in Nigeria. Nigerian users are eligible to participate."),
      source("Clean Work payments", "https://example.com/clean-work", "Clean Work payouts are available through a supported payment option for workers.")
    ]
  };
  const result = assessLiveEvidence(input);
  assert.equal(result.verdict, "TRY", JSON.stringify(result, null, 2));
});

test("relevant conflicting evidence cannot produce TRY", () => {
  const input = {
    name: "Conflict Work",
    claim: "Remote work opportunities",
    answer: "Conflict Work information was found.",
    profile: {},
    sources: [
      source("Conflict Work official", "https://conflictwork.com", "Conflict Work is an established legitimate company. Official website and terms of service are available."),
      source("Conflict Work Nigeria", "https://example.com/conflict-nigeria", "Conflict Work is supported in Nigeria and Nigerian users are eligible."),
      source("Conflict Work warning", "https://example.com/conflict-warning", "Independent reports about Conflict Work describe a fake platform and phishing concerns.")
    ]
  };
  const result = assessLiveEvidence(input);
  assert.notEqual(result.verdict, "TRY", JSON.stringify(result, null, 2));
});

test("unrelated negative sources cannot force SKIP", () => {
  const input = {
    name: "Good Work",
    claim: "Remote work opportunities",
    answer: "Generic scam warnings about other websites were found.",
    profile: {},
    sources: [
      source("Good Work official", "https://goodwork.com", "Good Work is an established legitimate company. Official website and terms of service are available."),
      source("Good Work Nigeria", "https://example.com/goodwork-nigeria", "Good Work is supported in Nigeria. Nigerian users are eligible to participate."),
      source("Good Work payments", "https://example.com/goodwork-payments", "Good Work payouts are available through a supported payment option for workers."),
      source("Other platform scam warning", "https://example.com/other-platform", "Another platform is a scam and has phishing complaints. Nigeria is excluded for that other platform.")
    ]
  };
  const result = assessLiveEvidence(input);
  assert.equal(result.verdict, "TRY", JSON.stringify(result, null, 2));
});


test("live research uses the existing Before You Start result layout", () => {
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  assert.match(html, /function consideredResearch/);
  assert.match(html, /showResult\(name,researchO,u,r,true,'research'\)/);
  assert.match(html, /What we considered/);
  assert.match(html, /Three checks/);
  assert.match(html, /💰 Real cost/);
  assert.doesNotMatch(html, /Before You Start breakdown/);
  assert.doesNotMatch(html, /Sources checked/);
});


test("profile mismatch can change a strong opportunity to SKIP", () => {
  const result = assessLiveEvidence({
    name: "Laptop Work",
    claim: "Remote work",
    answer: "Laptop Work information was found.",
    profile: { devices: ["Android phone"], budgetLabel: "₦0", experience: "Complete beginner", time: "1–3 hours/day", goals: ["Steady Income"], ids: ["NIN / National ID (digital)"], skills: ["None yet"] },
    sources: [
      source("Laptop Work official", "https://laptopwork.com", "Laptop Work is an established legitimate company with an official website and terms of service."),
      source("Laptop Work Nigeria", "https://example.com/laptopwork-nigeria", "Laptop Work is supported in Nigeria. Nigerian users are eligible to participate."),
      source("Laptop Work requirements", "https://example.com/laptopwork-requirements", "Laptop Work requires a laptop or computer to complete the work. Laptop Work payouts are available through a supported payment option.")
    ]
  });
  assert.equal(result.verdict, "SKIP", JSON.stringify(result, null, 2));
  assert.match(result.blockers.join(" "), /laptop/i);
});

test("profile budget mismatch can change the verdict when cost evidence is clear", () => {
  const result = assessLiveEvidence({
    name: "Paid Start Work",
    claim: "Remote work",
    answer: "Paid Start Work information was found.",
    profile: { devices: ["Laptop"], budgetLabel: "₦0", experience: "Experienced", time: "3+ hours/day", goals: ["Steady Income"], ids: ["Passport"], skills: ["Writing"] },
    sources: [
      source("Paid Start Work official", "https://paidstartwork.com", "Paid Start Work is an established legitimate company with an official website and terms of service."),
      source("Paid Start Work Nigeria", "https://example.com/paidstartwork-nigeria", "Paid Start Work is supported in Nigeria. Nigerian users are eligible to participate."),
      source("Paid Start Work cost", "https://example.com/paidstartwork-cost", "Paid Start Work requires ₦20,000 to start. Paid Start Work payouts are available through a supported payment option.")
    ]
  });
  assert.equal(result.verdict, "SKIP", JSON.stringify(result, null, 2));
  assert.match(result.blockers.join(" "), /₦20,000|budget/i);
});

test("matching profile requirements do not weaken a strong verdict", () => {
  const result = assessLiveEvidence({
    name: "Good Fit Work",
    claim: "Remote work",
    answer: "Good Fit Work information was found.",
    profile: { devices: ["Laptop"], budgetLabel: "₦25,000–₦49,999", experience: "Experienced", time: "3+ hours/day", goals: ["Steady Income"], ids: ["Passport"], skills: ["Writing"] },
    sources: [
      source("Good Fit Work official", "https://goodfitwork.com", "Good Fit Work is an established legitimate company with an official website and terms of service."),
      source("Good Fit Work Nigeria", "https://example.com/goodfitwork-nigeria", "Good Fit Work is supported in Nigeria. Nigerian users are eligible to participate."),
      source("Good Fit Work requirements", "https://example.com/goodfitwork-requirements", "Good Fit Work requires a laptop or computer and prior experience. Good Fit Work payouts are available through a supported payment option.")
    ]
  });
  assert.equal(result.verdict, "TRY", JSON.stringify(result, null, 2));
});


test("source presentation curates useful opportunity-specific sources", () => {
  const result = assessLiveEvidence({
    name: "OneForma",
    claim: "AI and data-work projects",
    answer: "OneForma information was found.",
    profile: {},
    sources: [
      source("OneForma official website", "https://www.oneforma.com/", "OneForma is an established legitimate platform with official information and terms of service."),
      source("OneForma Help Center payment information", "https://www.oneforma.com/help", "OneForma payment methods and withdrawal information are documented for eligible contributors."),
      source("OneForma Nigeria eligibility", "https://example.com/oneforma-nigeria", "OneForma is available to eligible users in Nigeria, subject to project requirements."),
      source("Best ways to make money online in Nigeria", "https://example.com/make-money-nigeria", "Many online platforms can offer income opportunities to Nigerian users."),
      source("Top freelancing platforms in Nigeria", "https://example.com/freelancing-nigeria", "Freelancing platforms may offer work and payments in Nigeria.")
    ]
  });
  assert.equal(result.matchedSourceCount, 3, JSON.stringify(result, null, 2));
  assert.equal(result.displayedSourceCount, 3, JSON.stringify(result, null, 2));
  assert.deepEqual(
    result.sources.map(s => s.title),
    [
      "OneForma Help Center payment information",
      "OneForma official website",
      "OneForma Nigeria eligibility"
    ]
  );
});

test("source curation can return fewer than five when only a few sources are useful", () => {
  const result = assessLiveEvidence({
    name: "OneForma",
    claim: "AI and data-work projects",
    answer: "OneForma information was found.",
    profile: {},
    sources: [
      source("OneForma official website", "https://www.oneforma.com/", "OneForma is an established legitimate platform with official information and terms of service."),
      source("Generic Nigeria earning guide", "https://example.com/make-money", "Many online opportunities exist in Nigeria.")
    ]
  });
  assert.equal(result.matchedSourceCount, 1, JSON.stringify(result, null, 2));
  assert.equal(result.displayedSourceCount, 1, JSON.stringify(result, null, 2));
  assert.equal(result.sources[0].title, "OneForma official website");
});


test("live research breakdown contains opportunity-specific findings, not methodology boilerplate", () => {
  const result = assessLiveEvidence({
    name: "YouTube",
    claim: "Create and publish videos for potential monetization",
    answer: "YouTube information was found.",
    profile: { devices: ["Android phone", "iPhone"], budgetLabel: "₦0", experience: "Complete beginner", time: "3+ hours/day", goals: ["Steady Income"] },
    sources: [
      source("YouTube official", "https://www.youtube.com/", "YouTube is an established platform. YouTube Partner Program eligibility and monetization information are documented."),
      source("YouTube Nigeria availability", "https://support.google.com/youtube/", "YouTube is available to users in Nigeria. Eligible creators can apply for the YouTube Partner Program."),
      source("YouTube monetization", "https://support.google.com/youtube/answer/94522", "YouTube monetization can include advertising revenue and other features. Earnings vary and are not guaranteed."),
      source("YouTube payments", "https://support.google.com/adsense/", "Eligible YouTube creators receive payments through AdSense for YouTube after meeting applicable payment thresholds.")
    ]
  });
  const b = result.researchBreakdown;
  assert.match(b.opportunity.evidence, /Create and publish videos|YouTube/i);
  assert.doesNotMatch(b.opportunity.evidence, /sources were checked|current web research/i);
  assert.match(b.nigeriaAccess.evidence, /Nigeria/i);
  assert.match(b.gettingPaid.evidence, /AdSense|payment/i);
  assert.match(b.withdrawal.evidence, /threshold|payment/i);
  assert.match(b.earnings.evidence, /earnings|revenue|vary/i);
  assert.doesNotMatch(b.biggestCatch.evidence, /decision layer highlights|sources were checked/i);
});

test("live research confidence reflects evidence coverage", () => {
  const low = assessLiveEvidence({
    name: "Thin Work",
    claim: "Online work",
    answer: "",
    profile: {},
    sources: [
      source("Thin Work mention", "https://example.com/thin-work", "Thin Work is mentioned online.")
    ]
  });
  assert.equal(low.confidence, "Low");

  const high = assessLiveEvidence({
    name: "Strong Work",
    claim: "Remote work",
    answer: "Strong Work information was found.",
    profile: {},
    sources: [
      source("Strong Work official", "https://strongwork.com", "Strong Work is an established legitimate company with an official website and terms of service."),
      source("Strong Work Nigeria", "https://www.gov.ng/strongwork", "Strong Work is supported in Nigeria. Nigerian users are eligible to participate."),
      source("Strong Work payments", "https://example.com/strongwork-payments", "Strong Work payouts are available through a supported payment option for workers."),
      source("Strong Work requirements", "https://example.com/strongwork-requirements", "Strong Work requirements are documented for eligible workers.")
    ]
  });
  assert.equal(high.confidence, "High");
});


test("YouTube content-creation aliases keep relevant YouTube evidence", () => {
  const result = assessLiveEvidence({
    name: "YouTube Content-Creation",
    claim: "Payment for content creation",
    answer: "YouTube monetization and creator information was found.",
    profile: { devices: ["Android phone", "iPhone"], budgetLabel: "₦0", experience: "Complete beginner", time: "3+ hours/day", goals: ["Steady Income"] },
    sources: [
      source("YouTube official", "https://www.youtube.com/", "YouTube is an established platform. YouTube Partner Program eligibility and monetization information are documented."),
      source("YouTube Nigeria availability", "https://support.google.com/youtube/", "YouTube is available to users in Nigeria. Eligible creators can apply for the YouTube Partner Program."),
      source("YouTube monetization", "https://support.google.com/youtube/answer/94522", "YouTube monetization can include advertising revenue and other features. Earnings vary and are not guaranteed."),
      source("YouTube payments", "https://support.google.com/adsense/", "Eligible YouTube creators receive payments through AdSense for YouTube after meeting applicable payment thresholds."),
      source("Generic online income guide", "https://example.com/make-money-online", "Many online platforms can offer income opportunities to Nigerian users.")
    ]
  });
  assert.equal(result.matchedSourceCount, 4, JSON.stringify(result, null, 2));
  assert.match(result.researchBreakdown.nigeriaAccess.evidence, /Nigeria/i);
  assert.match(result.researchBreakdown.gettingPaid.evidence, /AdSense|payment/i);
  assert.match(result.researchBreakdown.earnings.evidence, /earnings|revenue|vary/i);
  assert.doesNotMatch(result.researchBreakdown.nigeriaAccess.evidence, /sources were checked|current web research/i);
});


test("category findings can come from sentences inside a trusted opportunity source", () => {
  const result = assessLiveEvidence({
    name: "YouTube Content-Creation",
    claim: "Payment for content creation",
    answer: "YouTube information was found.",
    profile: { devices: ["Android phone", "iPhone"], budgetLabel: "₦0", experience: "Complete beginner", time: "1–3 hours/day", goals: ["Steady Income"] },
    sources: [
      source("YouTube Partner Program Nigeria", "https://support.google.com/youtube/", "Live in a country or region in which the YouTube Partner Program is available. Have 500 subscribers and 3 public uploads in the past 90 days."),
      source("YouTube payments", "https://support.google.com/adsense/", "Eligible creators receive payments through AdSense after meeting applicable payment thresholds. Earnings vary and are not guaranteed.")
    ]
  });
  assert.match(result.researchBreakdown.nigeriaAccess.evidence, /country or region|available/i);
  assert.match(result.researchBreakdown.requirements.evidence, /500 subscribers|public uploads/i);
  assert.match(result.researchBreakdown.gettingPaid.evidence, /AdSense|payments/i);
  assert.match(result.researchBreakdown.withdrawal.evidence, /payment threshold/i);
  assert.match(result.researchBreakdown.earnings.evidence, /Earnings vary|earnings/i);
});


test("live research does not mistake incidental paid language for a payment method", () => {
  const result = assessLiveEvidence({
    name: "YouTube Content-Creation",
    claim: "Create and publish videos for potential monetization",
    answer: "YouTube information was found.",
    profile: {},
    sources: [
      source("YouTube creator story", "https://example.com/youtube-story", "Inside this episode: the creator discusses multiple income streams and how they turned a side passion into a powerful brand. The video is paid promotion."),
      source("YouTube official", "https://www.youtube.com/", "YouTube is an established platform with official creator documentation.")
    ]
  });
  assert.equal(result.researchBreakdown.gettingPaid.status, "Needs confirmation", JSON.stringify(result.researchBreakdown, null, 2));
});

test("live research does not mistake device mentions for starting cost", () => {
  const result = assessLiveEvidence({
    name: "YouTube Content-Creation",
    claim: "Create and publish videos for potential monetization",
    answer: "YouTube information was found.",
    profile: {},
    sources: [
      source("YouTube Studio help", "https://support.google.com/youtube/", "YouTube Studio can be accessed on a phone, tablet, or computer."),
      source("YouTube official", "https://www.youtube.com/", "YouTube is an established platform with official creator documentation.")
    ]
  });
  assert.equal(result.researchBreakdown.realCost.status, "No clear upfront cost found", JSON.stringify(result.researchBreakdown, null, 2));
});

test("live research does not turn a generic review duration into time to first money", () => {
  const result = assessLiveEvidence({
    name: "YouTube Content-Creation",
    claim: "Create and publish videos for potential monetization",
    answer: "YouTube information was found.",
    profile: {},
    sources: [
      source("YouTube review", "https://support.google.com/youtube/", "The review process typically takes about a month, but delays are possible."),
      source("YouTube official", "https://www.youtube.com/", "YouTube is an established platform with official creator documentation.")
    ]
  });
  assert.equal(result.researchBreakdown.availability.timeToFirstMoney, "No clear time-to-first-money information was found.", JSON.stringify(result.researchBreakdown, null, 2));
});

test("live result has the plain-English summary above the research boxes", () => {
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  assert.match(html, /What am I about to get into/);
  assert.match(html, /buildResearchSummary/);
  assert.match(html, /\$\{summary\}\$\{why\}/);
});
