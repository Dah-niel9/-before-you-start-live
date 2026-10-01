import assert from "node:assert/strict";
import { FIELD_CONTRACTS, answerFromPacket } from "./worker-live.js";

const opportunity = {
  name: "YouTube Automation",
  claim: "Running a YouTube channel using outsourced or automated content production, with the goal of earning money from the channel."
};

const mixedSources = [
  {
    title: "Mixed YouTube/Google evidence bundle",
    url: "https://support.google.com/youtube/answer/72851",
    content: "The YouTube Partner Programme requires living in an eligible country, turning on two-step verification, and having an AdSense for YouTube account. Nigeria is an eligible country. Eligibility for ad revenue includes 1,000 subscribers and either 4,000 qualified watch hours or 10 million qualified Shorts views. YouTube says monetized content should be original and authentic and not mass-produced, generic, repetitive, or manipulative. Automated tools may be used, but the final product must still demonstrate creative value. AdSense requires identity and address verification at applicable verification thresholds. For USD payment accounts, the payment-method selection threshold is $10 and the payment threshold is $100. The AdSense payment cycle is monthly. If the balance reaches the payment threshold and there are no payment holds, payment is issued between the 21st and 26th. Bank transfers can take additional business days to arrive."
  }
];

const candidateAnswers = {
  opportunity: "A person runs a YouTube channel and may outsource or automate parts of content production, while still producing content that meets YouTube's monetization rules.",
  workType: "Content creation and channel-based online business.",
  nigeriaAccess: "Nigeria is listed as a country where the YouTube Partner Programme is available.",
  availability: "The YouTube Partner Programme is currently operating and has published eligibility requirements for creators.",
  device: "No clear evidence found.",
  kyc: "Identity and address verification can be required for AdSense payments when the applicable verification thresholds are reached.",
  payment: "Creators receive payouts through supported payment methods such as bank transfer.",
  withdrawal: "For USD accounts, the payment threshold is $100; when the threshold is reached and there are no holds, payment is issued between the 21st and 26th.",
  startingCost: "No mandatory upfront registration fee is established by the evidence reviewed.",
  earnings: "Creators can earn ad revenue from monetized YouTube content after meeting the applicable eligibility requirements.",
  firstMoney: "Before receiving a first payment, the channel must qualify for monetization, earnings must accrue, and the payment account must reach the payment threshold with required verification completed.",
  legitimacy: "The opportunity is documented by official YouTube and Google AdSense help pages with published monetization, eligibility, and payment rules.",
  dataCost: "No clear evidence found.",
  timeCost: "No clear evidence found.",
  opportunityCost: "No clear evidence found.",
  checkLegitimacy: "Official YouTube and Google documentation provides evidence about the platform and its monetization rules.",
  checkAccessibility: "Nigeria is listed as a country where the YouTube Partner Programme is available.",
  checkWorthwhile: "No clear evidence found.",
  realCash: "No mandatory upfront registration fee is established by the evidence reviewed.",
  realData: "No clear evidence found.",
  realTime: "No clear evidence found.",
  realOpportunity: "No clear evidence found."
};

const contaminated = {
  nigeriaAccess: "Nigeria is supported, but identity verification and government ID are required.",
  kyc: "You need identity verification, and payments are made by bank transfer.",
  payment: "Payment is by bank transfer and the minimum withdrawal threshold is $100.",
  withdrawal: "Withdrawals can use bank transfer and the payment method is bank transfer.",
  startingCost: "There is no registration fee, but a camera is optional and earnings vary.",
  earnings: "Creators earn ad revenue, and the payment threshold is $100.",
  firstMoney: "Payments are monthly and may be sent by bank transfer.",
  realCash: "There is no mandatory fee, but optional camera equipment may cost money.",
  realTime: "The payment cycle is monthly and bank transfers can take days.",
  checkLegitimacy: "The platform is established and creators can earn ad revenue.",
  checkAccessibility: "Nigeria is supported and bank transfer is a payment method.",
  checkWorthwhile: "Creators can earn ad revenue, with payments issued monthly.",
  device: "A laptop is required and bank transfer is used for payment."
};

assert.equal(FIELD_CONTRACTS.length, 22, "Expected 23 production field contracts");

const results = [];
let contaminatedRejected = 0;

for (const contract of FIELD_CONTRACTS) {
  const clean = candidateAnswers[contract.key] ?? "No clear evidence found.";
  const packet = {
    key: contract.key,
    name: opportunity.name,
    question: contract.question,
    extract: contract.extract,
    answer: clean,
    sources: mixedSources.map(source => ({ ...source, researchKey: contract.key }))
  };

  const cleanResult = answerFromPacket(packet);
  assert.equal(cleanResult, clean, `Valid own-field answer rejected for ${contract.key}`);

  if (contaminated[contract.key]) {
    const badResult = answerFromPacket({ ...packet, answer: contaminated[contract.key] });
    if (badResult === "No clear evidence found.") contaminatedRejected++;
    else console.error("CONTAMINATION ACCEPTED", contract.key, badResult);
  }

  results.push({ key: contract.key, answer: cleanResult });
}

console.log("REAL_WORLD_YOUTUBE_AUTOMATION_FIELD_ISOLATION");
console.log(JSON.stringify({
  opportunity,
  fieldCount: results.length,
  contaminatedCases: Object.keys(contaminated).length,
  contaminatedRejected,
  fields: results
}, null, 2));

assert.equal(contaminatedRejected, Object.keys(contaminated).length, "Every deliberately contaminated field answer must be rejected");
console.log(`REAL-WORLD FIELD ISOLATION PASSED: ${results.length}/23 own-field answers accepted; ${contaminatedRejected}/${Object.keys(contaminated).length} contaminated answers rejected.`);
