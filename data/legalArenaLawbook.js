export const LAWBOOK_VERSION = "v1";

export const legalArenaLawbook = [
  {
    id: "burden-of-proof",
    title: "Rule 1: The Claim Needs Proof",
    principle:
      "The side asking the court for relief must point to specific facts, records, or testimony that support the request.",
    guidance:
      "Strong arguments cite dates, documents, and direct observations instead of broad accusations.",
    tags: ["evidence", "records", "credibility", "criminal"],
  },
  {
    id: "notice-and-fair-warning",
    title: "Rule 2: Fair Notice Matters",
    principle:
      "A party should warn the other side about important problems before imposing a major penalty or withholding money.",
    guidance:
      "Late surprise claims are weaker than issues raised promptly and clearly.",
    tags: ["notice", "fairness", "housing", "services"],
  },
  {
    id: "ordinary-wear-vs-damage",
    title: "Rule 3: Ordinary Wear Is Not Misconduct",
    principle:
      "Normal use over time is treated differently from negligent or intentional damage.",
    guidance:
      "The court weighs whether the claimed harm is routine wear or something exceptional.",
    tags: ["housing", "damage", "fairness"],
  },
  {
    id: "reliable-records",
    title: "Rule 4: Reliable Records Beat Vague Stories",
    principle:
      "Receipts, photos, timestamps, and written messages usually carry more weight than unsupported recollections.",
    guidance:
      "When stories conflict, the side with consistent records gains credibility.",
    tags: ["records", "evidence", "credibility", "criminal"],
  },
  {
    id: "mitigation-and-reasonableness",
    title: "Rule 5: Losses Must Be Handled Reasonably",
    principle:
      "A party should take sensible steps to reduce avoidable harm instead of letting losses grow unnecessarily.",
    guidance:
      "Courts favor practical responses over inflated or strategic escalation.",
    tags: ["reasonableness", "damages", "services", "employment"],
  },
  {
    id: "proportional-remedy",
    title: "Rule 6: The Remedy Should Match the Harm",
    principle:
      "The requested outcome should be tied to the proven injury and not exceed what fairness requires.",
    guidance:
      "Narrow, well-supported remedies usually land better than sweeping demands.",
    tags: ["damages", "remedy", "fairness"],
  },
  {
    id: "presumption-and-proof",
    title: "Rule 7: Suspicion Is Not Proof",
    principle:
      "In criminal-style matters, accusation alone is not enough; the record must support each key element with reliable proof.",
    guidance:
      "Weak inferences and shaky identifications carry less weight than direct evidence and consistent testimony.",
    tags: ["criminal", "evidence", "credibility"],
  },
  {
    id: "credibility-under-pressure",
    title: "Rule 8: Credibility Turns on Consistency",
    principle:
      "When timelines shift or witnesses contradict themselves, the court becomes more cautious about accepting the accusation.",
    guidance:
      "Arguments are stronger when they identify inconsistencies and tie them to the burden of proof.",
    tags: ["criminal", "credibility", "records"],
  },
  {
    id: "procedure-shapes-fairness",
    title: "Rule 9: Procedure Protects Fairness",
    principle:
      "The court considers whether investigators, agencies, or accusers followed a fair process before relying on the result.",
    guidance:
      "Sloppy notice, weak verification, or rushed procedure can undermine the case even when suspicion exists.",
    tags: ["criminal", "notice", "fairness", "administrative"],
  },
];

export const getLawbookRules = (tags = []) => {
  if (!tags?.length) {
    return legalArenaLawbook;
  }

  const matchedRules = legalArenaLawbook.filter((rule) =>
    rule.tags.some((tag) => tags.includes(tag))
  );

  return matchedRules.length > 0 ? matchedRules : legalArenaLawbook;
};
