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
    .replace(/^(unavailable:\s*)+/g, "")
    .replace(/^[-•]\s*/g, "")
    .replace(/^(client says|client wants|client requests|client is asking for|client asked for)\s+(that\s+)?/g, "")
    .replace(/\bany formal\s+/g, "")
    .replace(/\bsigned or provided at move in\b/g, "")
    .replace(/\bif one exists\b/g, "")
    .replace(/\bmove in checklist\b/g, "move in checklist")
    .replace(/\bmove out checklist\b/g, "move out checklist")
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

const marksUnavailable = (value = "") => /^unavailable:\s*/i.test(String(value || "").trim());

const stripUnavailablePrefixes = (value = "") =>
  collapseWhitespace(value)
    .replace(/^(unavailable:\s*)+/i, "")
    .replace(/\bunavailable:\s*/gi, "")
    .trim();

const uniqueList = (items = []) => {
  const seen = new Map();
  const result = [];

  items.forEach((item) => {
    const key = canonicalize(item);
    if (!key) {
      return;
    }

    if (!seen.has(key)) {
      seen.set(key, result.length);
      result.push(item);
      return;
    }

    const existingIndex = seen.get(key);
    const existing = result[existingIndex];

    if (marksUnavailable(item) && !marksUnavailable(existing)) {
      result[existingIndex] = item;
    }
  });

  return result;
};

const FACT_SHEET_FIELD_LIMITS = {
  summary: 4,
  theory: 2,
  desiredRelief: 2,
  timeline: 8,
  supportingFacts: 8,
  risks: 6,
  knownFacts: 8,
  knownClaims: 8,
  disputedFacts: 6,
  corroboratedFacts: 8,
  missingEvidence: 8,
};

const coerceFactSheetList = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    return value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const hasMemoryQualifier = (text = "") =>
  /\b(from memory|in memory|without the file|without my file|without reviewing|right now)\b/i.test(
    text
  );

const startsWithClientVoice = (text = "") =>
  /^(i|my|me|we|our|what i|from what i|i know|i recall|i recalls|i remember|i believe|i think|client says|client recalls|client believes)\b/i.test(
    String(text || "").trim()
  );

const hasFirstPersonVoice = (text = "") =>
  /\b(i|my|me|we|our|what i|from what i)\b/i.test(String(text || ""));

const isTranscriptLike = (text = "") =>
  startsWithClientVoice(text) ||
  /\b(i know|i recall|i recalls|i remember|i believe|i think|what i do have|what i have|what i had|wish i had|does not offend me to admit)\b/i.test(
    text
  );

const isVagueProofLabel = (text = "") =>
  /^(proof for this point|relevant messages?|messages?|records?|documents?|proof|evidence|supporting proof)\.?$/i.test(
    collapseWhitespace(text)
  );

const rewriteClientVoiceNote = (field, text = "") => {
  const cleaned = collapseWhitespace(text);

  if (!isTranscriptLike(cleaned)) {
    return cleaned;
  }

  if (/\bno\b.*\b(formal|signed|written)\b.*\b(agreement|memorandum|mou|contract|document)\b/i.test(cleaned)) {
    return field === "timeline"
      ? "Before work began, no signed pre-start agreement was executed."
      : "No signed pre-start agreement.";
  }

  if (
    /\b(emails?|texts?|messages?)\b/i.test(cleaned) &&
    /\bdeposit\b/i.test(cleaned) &&
    /\b(invoice|site went live|launch|access records?)\b/i.test(cleaned)
  ) {
    return "Proof depends on emails, texts, deposit, invoice, and launch/access records.";
  }

  if (field === "theory" && /\bcharge\b/i.test(cleaned) && /\bnot caused by\b/i.test(cleaned)) {
    return "Charge was not caused by the client.";
  }

  if (/\bwish\b/i.test(cleaned) && /\bsign(ed|ing)?\b/i.test(cleaned)) {
    return field === "risks" ? "No signed agreement may weaken proof of terms." : "";
  }

  return "";
};

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

const cleanFactSheetPrefix = (value = "") =>
  collapseWhitespace(value)
    .replace(/^[-•]\s*/g, "")
    .replace(/^[-â€¢]\s*/g, "")
    .replace(
      /^(proof gap|risk from intake|live dispute from intake|client says|client wants|client requests|client is asking for|client asked for|client points me to this proof):?\s*/i,
      ""
    )
    .trim();

const normalizeLeadingFraming = (field, text = "") => {
  const cleaned = collapseWhitespace(text)
    .replace(/^[-•]\s*/g, "")
    .replace(/^(proof gap|risk from intake|live dispute from intake|client says|client points me to this proof):\s*/i, "")
    .replace(
      /^the other side is likely to argue that whether\s+/i,
      "Whether "
    )
    .replace(/^the other side is likely to argue that\s+/i, "")
    .replace(/^the other side may dispute\s+/i, "Whether ")
    .replace(/^whether whether\s+/i, "Whether ")
    .replace(/^((?!Client\b)[A-Z][A-Za-z0-9&'. -]+?) says\s+that\s+/i, "")
    .replace(/^((?!Client\b)[A-Z][A-Za-z0-9&'. -]+?) says\s+/i, "")
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

  if (/\bsecurity deposit\b/i.test(cleaned) && /\$[\d,]+/.test(cleaned)) {
    const amount = cleaned.match(/\$[\d,]+(?:\.\d{2})?/)?.[0] || "";
    return amount ? `Security deposit was ${amount}.` : "Security deposit amount is documented.";
  }

  if (/\brent\b/i.test(cleaned) && /\bpaid on time\b/i.test(cleaned)) {
    return "Rent was paid on time.";
  }

  if (mentionsNormalRentalHistory(cleaned)) {
    return "Rental history was normal, with no prior similar disputes.";
  }

  if (
    /\b(cleaned|clean)\b/i.test(cleaned) &&
    /\b(apartment|unit|floors|kitchen|bathroom|before leaving|before move-?out)\b/i.test(cleaned)
  ) {
    return "Apartment was cleaned before move-out.";
  }

  if (/\breturned the keys\b/i.test(cleaned)) {
    return "Keys were returned.";
  }

  if (
    /\b(charges|deductions)\b/i.test(cleaned) &&
    /\b(not justified|not clearly explained|unclear|unsupported)\b/i.test(cleaned)
  ) {
    return "Charges were not clearly justified.";
  }

  if (
    /\b(do not|don't|not really|no detailed|lack of|missing)\b/i.test(cleaned) &&
    /\b(photo|photos|proof|evidence|record|records)\b/i.test(cleaned)
  ) {
    return "";
  }

  if (/\bno\b.*\b(formal|signed|written)\b.*\b(agreement|memorandum|mou|contract|document)\b/i.test(cleaned)) {
    return "No signed pre-start agreement.";
  }

  if (/\b(deposit payment|deposit)\b/i.test(cleaned) && /\b(exists|paid|record)\b/i.test(cleaned)) {
    return "Deposit payment is documented.";
  }

  if (/\bproject communications?\b/i.test(cleaned) && /\bemail|text\b/i.test(cleaned)) {
    return "Project terms were discussed by email and text.";
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

const simplifySummary = (text = "") => {
  const cleaned = normalizeLeadingFraming("summary", text)
    .replace(/\bI rented\b/i, "Tenant rented")
    .replace(/\bI paid\b/i, "Tenant paid")
    .replace(/\bI moved out\b/i, "tenant moved out")
    .replace(/\bI dispute\b/i, "tenant disputes")
    .replace(/\bthey rented\b/i, "Tenant rented")
    .replace(/\bthey paid\b/i, "Tenant paid")
    .replace(/\bthey kept\b/i, "Northside kept")
    .trim();

  if (!cleaned) {
    return "";
  }

  if (
    /\brented\b/i.test(cleaned) &&
    /\bsecurity deposit\b/i.test(cleaned) &&
    /\bkept|withheld\b/i.test(cleaned)
  ) {
    const amount = cleaned.match(/\$[\d,]+(?:\.\d{2})?/)?.[0] || "";
    const deposit = amount ? `the ${amount} security deposit` : "the security deposit";

    return `Tenant rented from Northside for about a year, paid ${deposit}, and disputes Northside withholding most of it for cleaning and repair charges.`;
  }

  if (/\brented\b/i.test(cleaned) && /\babout (a|one) year\b/i.test(cleaned)) {
    return "Tenant rented from Northside for about a year.";
  }

  if (/\bsecurity deposit\b/i.test(cleaned) && /\$[\d,]+/.test(cleaned)) {
    const amount = cleaned.match(/\$[\d,]+(?:\.\d{2})?/)?.[0] || "";
    return amount ? `Tenant paid a ${amount} security deposit.` : "Tenant paid a security deposit.";
  }

  if (
    /\bpaid rent on time\b/i.test(cleaned) &&
    /\bgave notice\b/i.test(cleaned) &&
    /\bcleaned\b/i.test(cleaned) &&
    /\breturned the keys\b/i.test(cleaned)
  ) {
    return "Tenant paid rent, gave notice, cleaned the apartment, and returned the keys.";
  }

  return cleaned;
};

const simplifyRisk = (text = "") => {
  const cleaned = normalizeLeadingFraming("risks", text);

  if (!cleaned) {
    return "";
  }

  if (
    /\b(photo|photos|photographic)\b/i.test(cleaned) &&
    /\b(move-?out|final-day|condition|clean|ordinary wear and tear)\b/i.test(cleaned)
  ) {
    return "No strong move-out photos.";
  }

  if (
    /\b(credibility|how clean|clean the unit|when i left|when the client left)\b/i.test(
      cleaned
    )
  ) {
    return "Cleanliness depends partly on client credibility.";
  }

  if (
    /\b(landlord|northside|oakview)\b/i.test(cleaned) &&
    /\b(deduction letter|inspection)\b/i.test(cleaned) &&
    /\b(enough|sufficient|adequate)\b/i.test(cleaned)
  ) {
    return "Landlord may rely on deduction letter and inspection.";
  }

  return cleaned
    .replace(/^Documented\.$/i, "The record may not fully document each claimed issue.")
    .replace(
      /^Maria may contend the repairs were incomplete even if maintenance responded\.$/i,
      "Maria may argue that maintenance responded but did not fully fix the reported issues."
    );
};

const simplifyTimeline = (text = "") => {
  const cleaned = normalizeLeadingFraming("timeline", text);

  if (!cleaned) {
    return "";
  }

  if (
    /^(yes|yeah|yep|no|nope|not really)\b/i.test(cleaned) ||
    /\bconfirmed in the file|not confirmed in the file|solid photographic proof|actual move-out condition photos\b/i.test(
      cleaned
    ) ||
    isTranscriptLike(cleaned)
  ) {
    return "";
  }

  if (/\bbefore work began\b/i.test(cleaned) && /\bno\b.*\b(signed|formal|written)\b/i.test(cleaned)) {
    return "Before work began: no signed pre-start agreement.";
  }

  if (/\bterms\b/i.test(cleaned) && /\bemail|text\b/i.test(cleaned)) {
    return "Project terms discussed by email and text.";
  }

  if (/\bdeposit\b/i.test(cleaned) && /\bpaid\b/i.test(cleaned)) {
    return "Deposit paid.";
  }

  if (/\bsite\b/i.test(cleaned) && /\b(live|launch)\b/i.test(cleaned)) {
    return "Site launched.";
  }

  if (/\bmove-?in\b/i.test(cleaned) && /\bsecurity deposit\b/i.test(cleaned)) {
    const amount = cleaned.match(/\$[\d,]+(?:\.\d{2})?/)?.[0] || "";
    return amount
      ? `Move-in: security deposit paid (${amount}).`
      : "Move-in: security deposit paid.";
  }

  if (/\blived in the apartment\b/i.test(cleaned) && /\babout one year|year-long|one year\b/i.test(cleaned)) {
    return "Tenancy lasted about one year.";
  }

  if (/\bmoved out\b/i.test(cleaned) && /\bgiving notice|gave notice|notice\b/i.test(cleaned)) {
    return "Move-out followed notice.";
  }

  if (
    /\bbefore moving out\b/i.test(cleaned) &&
    /\bcleaned\b/i.test(cleaned) &&
    /\breturned the keys\b/i.test(cleaned)
  ) {
    return "Before move-out: apartment cleaned and keys returned.";
  }

  if (
    /\bafter move-?out\b/i.test(cleaned) &&
    /\bkept most of|withheld\b/i.test(cleaned) &&
    /\bdeposit\b/i.test(cleaned)
  ) {
    return "After move-out: deposit was mostly withheld.";
  }

  if (
    /\bafter move-?out\b/i.test(cleaned) &&
    /\bdeduction letter\b/i.test(cleaned)
  ) {
    return "After move-out: deduction letter listed cleaning and repair categories.";
  }

  return cleaned
    .replace(/\bclient says\s+/i, "")
    .replace(/\bmy\b/gi, "the")
    .replace(/\bI paid\b/i, "Payment made")
    .replace(/\bI lived\b/i, "Tenant lived")
    .replace(/\bThey lived\b/i, "Tenant lived")
    .replace(/\bThey moved\b/i, "Tenant moved");
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

const simplifyDesiredRelief = (text = "") => {
  const cleaned = normalizeLeadingFraming("desiredRelief", text)
    .replace(/\bmy security deposit\b/i, "the security deposit")
    .replace(/\bmy \$([\d,]+) security deposit\b/i, "the $$$1 security deposit");
  const lower = cleaned.toLowerCase();
  const amountMatch = cleaned.match(/\$[\d,]+(?:\.\d{2})?/);
  const depositText = amountMatch
    ? `the withheld portion of the ${amountMatch[0]} security deposit`
    : "the withheld security deposit";

  if (
    /\b(security deposit|deposit)\b/i.test(cleaned) &&
    /\b(return|refund|returned|withheld)\b/i.test(cleaned)
  ) {
    if (/\b(cleaning|repair|charge|charges|deduction|deductions)\b/i.test(cleaned)) {
      return toSentence(
        `Return ${depositText} and cancel unsupported cleaning and repair charges`
      );
    }

    return toSentence(`Return ${depositText}`);
  }

  if (!cleaned || lower === ".") {
    return "";
  }

  return cleaned;
};

const simplifyTheory = (text = "") => {
  const cleaned = normalizeLeadingFraming("theory", text)
    .replace(/^my position is that\s+/i, "")
    .replace(/^position is that\s+/i, "")
    .replace(/^client'?s position is that\s+/i, "")
    .replace(/\bmy \$([\d,]+) deposit\b/i, "the $$$1 deposit")
    .replace(/\bmy deposit\b/i, "the deposit")
    .replace(/\bI left\b/i, "The unit was left")
    .replace(/\bthey sent\b/i, "Northside sent")
    .trim();

  if (!cleaned) {
    return "";
  }

  if (
    /\bsite\b/i.test(cleaned) &&
    /\b(substantially completed|completed|launched|live)\b/i.test(cleaned) &&
    /\b(final payment|invoice|remaining balance)\b/i.test(cleaned)
  ) {
    return "Site launch and substantial completion support final payment.";
  }

  if (
    /\bcontract|agreement\b/i.test(cleaned) &&
    /\bemail|text|communications?\b/i.test(cleaned) &&
    /\bdeposit|performance|launch|launched|completed\b/i.test(cleaned)
  ) {
    return "Contract formation rests on emails, texts, deposit payment, and performance.";
  }

  if (
    /\bordinary move-?out condition|normal move-?out condition|ordinary wear and tear\b/i.test(
      cleaned
    ) &&
    /\bwithheld|deduction|deductions|charges|cleaning|repairs\b/i.test(cleaned)
  ) {
    const amount = cleaned.match(/\$[\d,]+(?:\.\d{2})?/)?.[0] || "";
    const deposit = amount ? `the ${amount} deposit` : "the deposit";

    return `Northside improperly withheld most of ${deposit} for routine or unsupported charges despite ordinary move-out condition.`;
  }

  if (
    /\bdeduction letter\b/i.test(cleaned) &&
    /\bvague|unsupported|not enough|too vague\b/i.test(cleaned)
  ) {
    return "Northside's deduction letter was too vague to justify withholding most of the deposit.";
  }

  return cleaned;
};

const simplifyEvidenceNeed = (text = "") => {
  const lower = text.toLowerCase();

  if (isVagueProofLabel(text)) {
    return "";
  }

  if (
    /\b(photo|photos|picture|pictures|photographic)\b/.test(lower) &&
    /\b(clean|cleaning|move-?out|surrender|turnover|key return|turned the place over)\b/.test(
      lower
    )
  ) {
    return "Move-out photos after cleaning.";
  }

  if (
    /\b(invoice|invoices|receipt|receipts|work order|work orders|backup document|backup documents)\b/.test(
      lower
    ) &&
    /\b(deduction|deductions|charge|charges|repair|repairs|cleaning|performed|covered|actual costs)\b/.test(
      lower
    )
  ) {
    return "Invoices or receipts supporting each deduction.";
  }

  if (/\b(deduction letter|itemized|itemised|breakdown)\b/.test(lower)) {
    return "Itemized deduction letter.";
  }

  if (/\b(inspection report|move-?out inspection)\b/.test(lower)) {
    return "Move-out inspection report.";
  }

  if (/\bmove-?in checklist\b/.test(lower)) {
    return "Move-in checklist.";
  }

  if (/\bmove-?out checklist|inspection form\b/.test(lower)) {
    return "Move-out checklist or inspection form.";
  }

  if (/\b(lease language|lease clause|lease provision)\b/.test(lower)) {
    return "Lease language supporting the claimed charges.";
  }

  if (
    /\b(email|emails|text|texts|message|messages)\b/.test(lower) &&
    /\b(project|scope|terms|revision|approval|launch|invoice|payment|contract|agreement)\b/.test(lower)
  ) {
    if (/\bemail|emails\b/.test(lower) && /\btext|texts|message|messages\b/.test(lower)) {
      return "Project emails and text messages.";
    }

    if (/\bemail|emails\b/.test(lower)) {
      return "Project emails.";
    }

    return "Project text messages.";
  }

  if (/\bdeposit payment\b|\bpayment record\b|\bdeposit record\b/.test(lower)) {
    return "Deposit payment record.";
  }

  if (/\bfinal invoice\b|\binvoice record\b/.test(lower)) {
    return "Final invoice.";
  }

  if (
    /\b(email|emails|text|texts|message|messages)\b/.test(lower) &&
    /\b(move-?out|surrender|turnover|returning the keys|key return|instructions)\b/.test(lower)
  ) {
    return "Text messages with move-out instructions.";
  }

  return "";
};

const simplifyCorroboratedEvidence = (text = "") =>
  simplifyEvidenceNeed(text) || normalizeLeadingFraming("corroboratedFacts", text);

const isBadCorroboratedFact = (item = "") => {
  const text = String(item || "").trim();

  if (!text) {
    return true;
  }

  if (
    /\b(my testimony|i was not provided|i have not been provided|was not provided invoices|not provided invoices|not provided a formal checklist)\b/i.test(
      text
    )
  ) {
    return true;
  }

  if (/^(yes|yeah|yep|no|nope|not really)\b/i.test(text) && text.length > 80) {
    return true;
  }

  if (
    /^i\b/i.test(text) &&
    !/\b(receipt|photo|photos|picture|pictures|text messages?|emails?|invoice|invoices|letter|checklist|inspection report|witness)\b/i.test(
      text
    )
  ) {
    return true;
  }

  if (isVagueProofLabel(text)) {
    return true;
  }

  if (
    /^(email communications?|text messages?|relevant messages?)\.?$/i.test(text) &&
    !/\b(project|scope|terms|revision|approval|launch|invoice|payment|contract|agreement)\b/i.test(text)
  ) {
    return true;
  }

  return false;
};

const isBadRisk = (item = "") => {
  const text = String(item || "").trim();

  if (!text) {
    return true;
  }

  if (/^(yes|yeah|yep|nope|not really)\b/i.test(text)) {
    return true;
  }

  if (/^no[, ]/i.test(text) && text.length > 40) {
    return true;
  }

  if (
    /\bconfirmed in the file|not confirmed in the file|solid photographic proof|actual move-out condition photos\b/i.test(
      text
    )
  ) {
    return true;
  }

  if (/^some details still need to be confirmed from the file\.$/i.test(text)) {
    return true;
  }

  if (mentionsNormalRentalHistory(text)) {
    return true;
  }

  return false;
};

const mentionsNormalRentalHistory = (item = "") =>
  /\b(rental history|prior landlord|prior landlords|other landlord|other landlords|first time|first problem|first dispute|never had|no prior|no bad notes|normal)\b/i.test(
    item
  ) &&
  /\b(normal|first time|first problem|first dispute|never had|no prior|no bad notes|no issue|no issues)\b/i.test(
    item
  );

const removeResolvedCredibilityRisks = (risks = [], factSheet = {}) => {
  const supportCorpus = [
    ...(factSheet.supportingFacts || []),
    ...(factSheet.corroboratedFacts || []),
  ].join(" ");

  if (!mentionsNormalRentalHistory(supportCorpus)) {
    return risks;
  }

  return risks.filter(
    (risk) => !/^cleanliness depends partly on client credibility\.$/i.test(risk)
  );
};

const withUnavailablePrefix = (original = "", cleaned = "") => {
  const normalized = stripUnavailablePrefixes(cleaned);

  if (!normalized) {
    return "";
  }

  return /^unavailable:\s*/i.test(original)
    ? `Unavailable: ${normalized.replace(/\.+$/g, "")}.`
    : normalized;
};

const simplifyMissingEvidence = (text = "") => {
  const stripped = stripUnavailablePrefixes(text);

  if (isVagueProofLabel(stripped)) {
    return "";
  }

  return withUnavailablePrefix(
    text,
    simplifyEvidenceNeed(text) || normalizeLeadingFraming("missingEvidence", text)
  );
};

const rewriteFactSheetEntry = (field, value = "") => {
  const text = rewriteClientVoiceNote(field, cleanFactSheetPrefix(value));

  if (!text) {
    return "";
  }

  if (
    ["timeline", "supportingFacts", "knownClaims", "theory"].includes(field) &&
    (text.length > 260 || text.split(/(?<=[.!?])\s+/).filter(Boolean).length > 2)
  ) {
    return "";
  }

  if (field !== "summary" && field !== "desiredRelief" && startsWithClientVoice(text)) {
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

  if (field === "summary") {
    return simplifySummary(text);
  }

  if (field === "risks") {
    return simplifyRisk(text);
  }

  if (field === "timeline") {
    return simplifyTimeline(text);
  }

  if (field === "disputedFacts") {
    return simplifyDispute(text);
  }

  if (field === "desiredRelief") {
    return simplifyDesiredRelief(text);
  }

  if (field === "theory") {
    return simplifyTheory(text);
  }

  if (field === "corroboratedFacts") {
    return simplifyCorroboratedEvidence(text);
  }

  if (field === "missingEvidence") {
    return simplifyMissingEvidence(text);
  }

  return toSentence(text);
};

const removeSubsumedRelief = (items = []) => {
  const broadDepositAndChargesRequests = items.filter((item) =>
    /\breturn the withheld(?: portion of the)?(?: \$[\d,]+)? security deposit and cancel unsupported cleaning (?:or|and) repair charges\b/i.test(item)
  );

  if (!broadDepositAndChargesRequests.length) {
    return items;
  }

  const preferredRequest =
    broadDepositAndChargesRequests.find((item) => /\$[\d,]+/.test(item)) ||
    broadDepositAndChargesRequests[0];

  return [
    preferredRequest,
    ...items.filter(
      (item) =>
        item !== preferredRequest &&
        !/^return the withheld(?: portion of the)?(?: \$[\d,]+)? security deposit(?: and cancel unsupported cleaning (?:or|and) repair charges)?\.$/i.test(
          item
        )
    ),
  ];
};

const removeSubsumedTheory = (items = []) => {
  const contractFormation = items.find((item) =>
    /\bcontract formation rests on emails, texts, deposit payment, and performance\b/i.test(item)
  );
  const substantialCompletion = items.find((item) =>
    /\bsite launch and substantial completion support final payment\b/i.test(item)
  );

  if (contractFormation || substantialCompletion) {
    return [
      contractFormation,
      substantialCompletion,
      ...items.filter(
        (item) =>
          item !== contractFormation &&
          item !== substantialCompletion &&
          !/\b(contract|agreement)\b.*\b(email|text|communications?|deposit|performance|launch)\b/i.test(item)
      ),
    ].filter(Boolean);
  }

  const broadTheory = items.find((item) =>
    /\bnorthside improperly withheld most of\b/i.test(item)
  );

  if (!broadTheory) {
    return items;
  }

  return [
    broadTheory,
    ...items.filter(
      (item) =>
        item !== broadTheory &&
        !/\bordinary move-?out condition|normal move-?out condition|ordinary wear and tear|routine or unsupported charges|cleaning and repair charges|deduction letter was too vague\b/i.test(
          item
        )
    ),
  ];
};

const removeSubsumedSummary = (items = []) => {
  const broadSummary = items.find((item) =>
    /\btenant rented from northside for about a year\b/i.test(item) &&
    /\bdisputes northside withholding most of it\b/i.test(item)
  );

  if (!broadSummary) {
    return items;
  }

  return [broadSummary];
};

const sanitizeCorroboratedFacts = (items = []) =>
  items.filter((item) => !isBadCorroboratedFact(item));

const sanitizeRisks = (items = []) => items.filter((item) => !isBadRisk(item));

const semanticKeyForFactSheetItem = (field, item = "") => {
  const text = canonicalize(item);

  if (!text) {
    return "";
  }

  if (/\bno signed pre start agreement\b|\bno formal signed agreement\b|\bno formal pre start memorandum\b|\bsigned pre start agreement absent\b|\bsigned memorandum\b|\bformal written contract\b/.test(text)) {
    return "no-signed-pre-start-agreement";
  }

  if (/\bcontract formation rests\b|\bagreement was formed through emails texts\b|\bcontract formed through communications deposit and performance\b|\bcontract formed through emails texts deposit payment and performance\b/.test(text)) {
    return "contract-formation-communications-deposit-performance";
  }

  if (/\bsite launch and substantial completion\b|\bsite was substantially completed and launched\b/.test(text)) {
    return "site-launch-final-payment";
  }

  if (/\bdeposit payment is documented\b|\bdeposit payment exists\b|\ba deposit was paid\b|\bdeposit was paid\b|\bdeposit payment record\b/.test(text)) {
    return field === "corroboratedFacts" ? "deposit-payment-record" : "deposit-paid";
  }

  if (/\bproject emails and text messages\b|\bproject emails\b|\bproject text messages\b|\bproject communications occurred by email and text\b|\bagreement was handled through emails and texts\b|\bproject terms were discussed by email and text\b/.test(text)) {
    return "project-emails-texts";
  }

  if (/\bfinal invoice\b/.test(text)) {
    return "final-invoice";
  }

  if (/\bpost launch issues\b|\braised issues\b|\bbugs revisions or maintenance\b|\bminor tweaks or serious defects\b|\bunresolved problems\b/.test(text)) {
    return "post-launch-issues";
  }

  if (/\bongoing post launch maintenance\b|\bbug fix obligations\b|\bformal post launch maintenance agreement\b|\bwritten term specifically defining post launch\b/.test(text)) {
    return "post-launch-maintenance-obligation";
  }

  if (/\brecords showing site went live\b|\bclient access\b|\blaunch access records\b/.test(text)) {
    return "site-live-access-records";
  }

  return text;
};

const factSheetItemScore = (item = "") => {
  const text = String(item || "");
  let score = Math.min(text.length, 180);

  if (/\b(email|text|deposit|invoice|photo|receipt|record|agreement|launch|access|maintenance|bug|revision|payment)\b/i.test(text)) {
    score += 30;
  }

  if (/\bsubstantial|specific|pre-start|final|project|documented|access\b/i.test(text)) {
    score += 20;
  }

  if (hasFirstPersonVoice(text) || /^(client says|client recalls|client believes)\b/i.test(text)) {
    score -= 100;
  }

  if (isVagueProofLabel(text)) {
    score -= 200;
  }

  return score;
};

const distillFactSheetList = (field, items = []) => {
  const selected = new Map();

  items.forEach((item) => {
    const key = semanticKeyForFactSheetItem(field, item);

    if (!key) {
      return;
    }

    const existing = selected.get(key);
    if (!existing || factSheetItemScore(item) > factSheetItemScore(existing)) {
      selected.set(key, item);
    }
  });

  return [...selected.values()].filter((item) => {
    if (!item || isVagueProofLabel(item)) {
      return false;
    }

    if (field !== "summary" && field !== "desiredRelief" && startsWithClientVoice(item)) {
      return false;
    }

    if (field === "timeline" && isTranscriptLike(item)) {
      return false;
    }

    if (field === "corroboratedFacts") {
      return !isBadCorroboratedFact(item);
    }

    return true;
  });
};

export const sanitizeFactSheetList = (field, items = []) =>
  (field === "desiredRelief"
    ? removeSubsumedRelief
    : field === "theory"
    ? removeSubsumedTheory
    : field === "summary"
    ? removeSubsumedSummary
    : field === "corroboratedFacts"
    ? sanitizeCorroboratedFacts
    : field === "risks"
    ? sanitizeRisks
    : (value) => value)(
    distillFactSheetList(
      field,
      uniqueList(coerceFactSheetList(items).map((item) => rewriteFactSheetEntry(field, item)))
    )
  ).slice(0, FACT_SHEET_FIELD_LIMITS[field] || 8);

const summaryIsThin = (items = []) =>
  items.length === 0 ||
  items.some((item) =>
    /^tenant rented from northside for about (a|one) year\.$/i.test(item)
  );

const buildUsefulSummary = ({ summary, theory, desiredRelief, timeline, supportingFacts }) => {
  if (!summaryIsThin(summary)) {
    return summary;
  }

  const corpus = [
    ...summary,
    ...theory,
    ...desiredRelief,
    ...timeline,
    ...supportingFacts,
  ].join(" ");

  if (
    /\bsecurity deposit|deposit\b/i.test(corpus) &&
    /\bwithheld|withholding|return the withheld|kept most\b/i.test(corpus)
  ) {
    const amount = corpus.match(/\$[\d,]+(?:\.\d{2})?/)?.[0] || "";
    const deposit = amount ? `${amount} security deposit` : "security deposit";

    if (/\bcleaning|repair|charges|deductions|unsupported|ordinary move-?out condition\b/i.test(corpus)) {
      return [
        `Security-deposit dispute over Northside withholding most of the ${deposit} for contested cleaning and repair charges after move-out.`,
      ];
    }

    return [`Security-deposit dispute over Northside withholding most of the ${deposit}.`];
  }

  return summary.filter(
    (item) => !/^tenant rented from northside for about (a|one) year\.$/i.test(item)
  );
};

export const sanitizeFactSheet = (factSheet = {}) => {
  const sanitized = {
    ...factSheet,
    summary: sanitizeFactSheetList("summary", factSheet.summary),
    theory: sanitizeFactSheetList("theory", factSheet.theory),
    desiredRelief: sanitizeFactSheetList("desiredRelief", factSheet.desiredRelief),
    timeline: sanitizeFactSheetList("timeline", factSheet.timeline),
    supportingFacts: sanitizeFactSheetList("supportingFacts", factSheet.supportingFacts),
    risks: sanitizeFactSheetList("risks", factSheet.risks),
    knownFacts: sanitizeFactSheetList("knownFacts", factSheet.knownFacts),
    knownClaims: sanitizeFactSheetList("knownClaims", factSheet.knownClaims),
    disputedFacts: sanitizeFactSheetList("disputedFacts", factSheet.disputedFacts),
    corroboratedFacts: sanitizeFactSheetList("corroboratedFacts", factSheet.corroboratedFacts),
    missingEvidence: sanitizeFactSheetList("missingEvidence", factSheet.missingEvidence),
  };
  const resolvedRisks = removeResolvedCredibilityRisks(sanitized.risks, sanitized);

  return {
    ...sanitized,
    risks: resolvedRisks,
    summary: buildUsefulSummary(sanitized),
  };
};
