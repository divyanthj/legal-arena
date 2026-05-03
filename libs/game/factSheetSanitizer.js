const collapseWhitespace = (value = "") =>
  String(value || "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim();

const toSentence = (value = "") => {
  const text = collapseWhitespace(value);

  if (!text) {
    return "";
  }

  const normalized = text.replace(/\.+$/, "");
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}.`;
};

const canonicalize = (value = "") =>
  collapseWhitespace(value)
    .toLowerCase()
    .replace(/^the other side is likely to argue that\s+/g, "")
    .replace(/^whether\s+/g, "")
    .replace(/^[a-z][a-z0-9&'. -]+ says\s+(that\s+)?/g, "")
    .replace(/^[a-z][a-z0-9&'. -]+'s position is that\s+/g, "")
    .replace(/^[a-z][a-z0-9&'. -]+'s understanding is that\s+/g, "")
    .replace(/^[a-z][a-z0-9&'. -]+ does not deny that\s+/g, "")
    .replace(/^oakview claims\s+/g, "")
    .replace(/^oakview relies on lease language allowing\s+/g, "")
    .replace(/^oakview attributes the deductions to\s+/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const uniqueList = (items = []) => {
  const seen = new Set();

  return items.filter((item) => {
    const key = canonicalize(item);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const hasMemoryQualifier = (text = "") =>
  /\b(from memory|in memory|without the file|without my file|without reviewing|right now)\b/i.test(
    text
  );

const mentionsExactUnverifiedDetail = (text = "") =>
  /\b(do not have|don't have|do not remember|don't remember|cannot confirm|can't confirm)\b/i.test(
    text
  ) &&
  /\b(exact|specific|percentage|amount|language|dated)\b/i.test(text);

const mentionsStatementCritique = (text = "") =>
  /\b(statement|written statement)\b/i.test(text) &&
  /\b(may be challenged|may be criticized|not detailed enough|category-level|cost support|court expects)\b/i.test(
    text
  );

const mentionsAttachmentGap = (text = "") =>
  /\b(invoice|photo|inspection record|inspection report)\b/i.test(text) &&
  /\b(attached|included|support)\b/i.test(text) &&
  /\b(do not|don't|have not|haven't|cannot|can't)\b/i.test(text);

const mentionsLeaseGap = (text = "") =>
  /\blease\b/i.test(text) &&
  /\b(language|quote)\b/i.test(text) &&
  /\b(do not|don't|have not|haven't|cannot|can't)\b/i.test(text);

const mentionsInspectionGap = (text = "") =>
  /\bmove-?out inspection report\b/i.test(text) &&
  /\b(do not|don't|have not|haven't|cannot|can't|identified)\b/i.test(text);

const mentionsDepositGap = (text = "") =>
  /\bdeposit|withhold(?:ing|held)\b/i.test(text) &&
  /\b(amount|percentage)\b/i.test(text) &&
  /\b(do not|don't|have not|haven't|cannot|can't|exact)\b/i.test(text);

const mentionsWearAndTearDispute = (text = "") =>
  /\bwear and tear|ordinary wear|chargeable condition|beyond ordinary\b/i.test(text) &&
  /\b(dispute|disputed|whether|distinction)\b/i.test(text);

const normalizeLeadingFraming = (field, text = "") => {
  const cleaned = collapseWhitespace(text)
    .replace(
      /^the other side is likely to argue that whether\s+/i,
      "Whether "
    )
    .replace(/^the other side is likely to argue that\s+/i, "")
    .replace(/^the other side may dispute\s+/i, "Whether ")
    .replace(/^whether whether\s+/i, "Whether ")
    .replace(/^([A-Z][A-Za-z0-9&'. -]+?) says\s+that\s+/i, "")
    .replace(/^([A-Z][A-Za-z0-9&'. -]+?) says\s+/i, "")
    .replace(/^([A-Z][A-Za-z0-9&'. -]+?)'s position is that\s+/i, "")
    .replace(/^([A-Z][A-Za-z0-9&'. -]+?)'s understanding is that\s+/i, "")
    .replace(/^([A-Z][A-Za-z0-9&'. -]+?) does not deny that\s+/i, "")
    .replace(/^the conditions [A-Z][A-Za-z0-9&'. -]+ identifies are\s+/i, "")
    .replace(/^conditions found at move-?out\.?/i, "Conditions documented at move-out")
    .trim();

  if (!cleaned) {
    return "";
  }

  if (field === "disputedFacts") {
    return toSentence(
      cleaned.replace(/^whether\s+/i, "Whether ")
    );
  }

  return toSentence(cleaned);
};

const simplifySupportingFact = (text = "") => {
  const cleaned = normalizeLeadingFraming("supportingFacts", text);

  if (!cleaned) {
    return "";
  }

  return cleaned
    .replace(
      /^Lease permits deductions for damage beyond ordinary wear and tear\.$/i,
      "Oakview relies on lease language allowing deductions for damage beyond ordinary wear and tear."
    )
    .replace(
      /^Lease permits deductions for cleaning and repair costs tied to the tenant's move-out condition\.$/i,
      "Oakview relies on lease language allowing cleaning and repair deductions tied to move-out condition."
    )
    .replace(
      /^Both reported issues were handled\.$/i,
      "Oakview claims both reported maintenance issues were handled."
    )
    .replace(
      /^Move-out deductions were based on cleaning and repair needs observed after move-out\.$/i,
      "Oakview claims the deductions were based on cleaning and repair needs observed after move-out."
    )
    .replace(
      /^Carpet stains, wall marks, a broken blind, and extra cleaning in the kitchen and bathroom\.$/i,
      "Oakview attributes the deductions to carpet stains, wall marks, a broken blind, and extra cleaning in the kitchen and bathroom."
    );
};

const simplifyRisk = (text = "") => {
  const cleaned = normalizeLeadingFraming("risks", text);

  if (!cleaned) {
    return "";
  }

  return cleaned
    .replace(/^Documented\.$/i, "The record may not fully document each claimed issue.")
    .replace(
      /^Maria may contend the repairs were incomplete even if maintenance responded\.$/i,
      "Maria may argue that maintenance responded but did not fully fix the reported issues."
    );
};

const simplifyDispute = (text = "") => {
  const cleaned = normalizeLeadingFraming("disputedFacts", text);

  if (!cleaned) {
    return "";
  }

  return cleaned
    .replace(
      /^Whether Oakview responded promptly and adequately to the sink and window complaints\.$/i,
      "Whether Oakview responded promptly and adequately to the sink drip and bedroom window complaints."
    )
    .replace(
      /^Whether the sink and window latch issues were fully fixed\.$/i,
      "Whether the sink drip and bedroom window latch were fully repaired."
    );
};

const simplifyCorroboratedFact = (text = "") =>
  normalizeLeadingFraming("corroboratedFacts", text);

const simplifyMissingEvidence = (text = "") =>
  normalizeLeadingFraming("missingEvidence", text);

const rewriteFactSheetEntry = (field, value = "") => {
  const text = collapseWhitespace(value);

  if (!text) {
    return "";
  }

  if (mentionsWearAndTearDispute(text)) {
    return field === "risks"
      ? "The landlord will argue the condition went beyond ordinary wear and tear."
      : "Whether the condition was ordinary wear and tear or chargeable damage.";
  }

  if (mentionsDepositGap(text)) {
    return field === "risks"
      ? "The exact deposit and deduction amounts still need to be confirmed from the file."
      : field === "missingEvidence"
      ? "Confirm the exact deposit amount and each deduction from the file."
      : "";
  }

  if (mentionsAttachmentGap(text)) {
    return field === "risks"
      ? "The deductions may be vulnerable if the file does not include supporting invoices, photos, or inspection records."
      : field === "missingEvidence"
      ? "Confirm which invoices, photos, and inspection records support the deductions."
      : "";
  }

  if (mentionsLeaseGap(text)) {
    return field === "risks"
      ? "The defense position is weaker if the lease language supporting the deductions is not quoted accurately."
      : field === "missingEvidence"
      ? "Quote the exact lease language that supports the deductions."
      : "";
  }

  if (mentionsInspectionGap(text)) {
    return field === "risks"
      ? "The defense may struggle if there is no dated move-out inspection report."
      : field === "missingEvidence"
      ? "Identify the dated move-out inspection report, if one exists."
      : "";
  }

  if (mentionsStatementCritique(text)) {
    return field === "risks"
      ? "The deduction statement may be attacked as too vague if it lists categories without itemized support."
      : field === "missingEvidence"
      ? "The deduction statement may need itemized support for each charge."
      : "";
  }

  if (hasMemoryQualifier(text) || mentionsExactUnverifiedDetail(text)) {
    if (field === "missingEvidence") {
      return "Confirm the exact details from the file before relying on this point.";
    }

    if (field === "risks") {
      return "Some details still need to be confirmed from the file.";
    }

    return "";
  }

  if (field === "supportingFacts") {
    return simplifySupportingFact(text);
  }

  if (field === "risks") {
    return simplifyRisk(text);
  }

  if (field === "disputedFacts") {
    return simplifyDispute(text);
  }

  if (field === "corroboratedFacts") {
    return simplifyCorroboratedFact(text);
  }

  if (field === "missingEvidence") {
    return simplifyMissingEvidence(text);
  }

  return toSentence(text);
};

export const sanitizeFactSheetList = (field, items = []) =>
  uniqueList((Array.isArray(items) ? items : []).map((item) => rewriteFactSheetEntry(field, item)));

export const sanitizeFactSheet = (factSheet = {}) => ({
  ...factSheet,
  timeline: sanitizeFactSheetList("timeline", factSheet.timeline),
  supportingFacts: sanitizeFactSheetList("supportingFacts", factSheet.supportingFacts),
  risks: sanitizeFactSheetList("risks", factSheet.risks),
  knownFacts: sanitizeFactSheetList("knownFacts", factSheet.knownFacts),
  knownClaims: sanitizeFactSheetList("knownClaims", factSheet.knownClaims),
  disputedFacts: sanitizeFactSheetList("disputedFacts", factSheet.disputedFacts),
  corroboratedFacts: sanitizeFactSheetList("corroboratedFacts", factSheet.corroboratedFacts),
  missingEvidence: sanitizeFactSheetList("missingEvidence", factSheet.missingEvidence),
});
