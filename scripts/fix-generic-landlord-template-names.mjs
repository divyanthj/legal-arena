import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { MongoClient, ObjectId } from "mongodb";

const GENERIC_PLAINTIFF_NAMES = new Set(["tenant", "the tenant"]);
const GENERIC_DEFENDANT_NAMES = new Set(["landlord", "the landlord"]);
const ROLE_LABEL_PLAINTIFF_NAMES = new Set(["plaintiff", "the plaintiff"]);
const ROLE_LABEL_DEFENDANT_NAMES = new Set(["defendant", "the defendant"]);
const SECURITY_DEPOSIT_FALLBACK_NAMES = {
  plaintiffName: "Maya Chen",
  defendantName: "Harborview Property Management",
};
const CONNECTOR_WORDS = new Set([
  "after",
  "and",
  "because",
  "before",
  "but",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "over",
  "the",
  "to",
  "vs",
  "with",
]);

const readEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};

  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const rawValue = line.slice(index + 1).trim();
        const value = rawValue.replace(/^['"]|['"]$/g, "");
        return [key, value];
      })
  );
};

const normalizeName = (value = "") =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const isGenericPlaintiffName = (value = "") =>
  GENERIC_PLAINTIFF_NAMES.has(normalizeName(value).toLowerCase()) ||
  ROLE_LABEL_PLAINTIFF_NAMES.has(normalizeName(value).toLowerCase());

const isGenericDefendantName = (value = "") =>
  GENERIC_DEFENDANT_NAMES.has(normalizeName(value).toLowerCase()) ||
  ROLE_LABEL_DEFENDANT_NAMES.has(normalizeName(value).toLowerCase());

const isSecurityDepositTemplate = (template = {}) =>
  /\bsecurity deposit|habitability|lease|rental|tenant|landlord|move-?out\b/i.test(
    [
      template.title,
      template.subtitle,
      template.overview,
      template.openingStatement,
      template.canonicalStory?.story,
    ]
      .filter(Boolean)
      .join(" ")
  );

const looksLikePersonName = (value = "") => {
  const name = normalizeName(value);
  const words = name.split(" ");

  if (words.length < 2 || words.length > 3) return false;
  if (words.some((word) => CONNECTOR_WORDS.has(word.toLowerCase()))) return false;

  return words.every((word) => /^[A-Z][a-z]+(?:[-'][A-Z][a-z]+)?$/.test(word));
};

const collectText = (template = {}) =>
  [
    template.title,
    template.subtitle,
    template.overview,
    template.openingStatement,
    template.starterTheory,
    template.desiredRelief,
    template.authoringNotes,
    template.canonicalStory?.story,
    ...(template.canonicalStory?.events || []).map((event) =>
      typeof event === "string" ? event : event?.detail || event?.text || ""
    ),
    ...(template.canonicalFacts || []).flatMap((fact) => [
      fact.label,
      fact.canonicalDetail,
      ...(fact.claims || []).map((claim) => claim.claimedDetail),
    ]),
    template.interviewBlueprint?.plaintiff?.opening,
    template.interviewBlueprint?.defendant?.opening,
  ]
    .filter(Boolean)
    .join("\n");

const scoreCandidate = (corpus, candidate) => {
  const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mentions = corpus.match(new RegExp(`\\b${escaped}\\b`, "g"))?.length || 0;
  const fullNameBonus = candidate.split(" ").length > 1 ? 2 : 0;
  return mentions + fullNameBonus;
};

const inferPlaintiffName = (template = {}) => {
  const corpus = collectText(template);
  const candidates = [
    ...corpus.matchAll(/\b(?:I am|I'm|My name is|This is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g),
    ...corpus.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s+(?:moved out|paid|rented|leased|cleaned|asked|requested|wants back|wants the deposit)/g),
  ]
    .map((match) => normalizeName(match[1]))
    .filter(looksLikePersonName);

  return candidates
    .map((candidate) => [candidate, scoreCandidate(corpus, candidate)])
    .sort((left, right) => right[1] - left[1])[0]?.[0];
};

const inferDefendantName = (template = {}) => {
  const corpus = collectText(template);
  const candidates = [
    ...corpus.matchAll(/\b(?:landlord|property manager|manager|owner)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g),
    ...corpus.matchAll(/\b([A-Z][A-Za-z&.' -]+(?:LLC|Inc\.?|Properties|Management|Apartments|Homes|Realty|Rentals|Group))\b/g),
  ]
    .map((match) => normalizeName(match[1]))
    .filter((candidate) => candidate.length <= 60)
    .filter((candidate) => !/^(The|A|An)\s/i.test(candidate));

  return candidates
    .map((candidate) => [candidate, scoreCandidate(corpus, candidate)])
    .sort((left, right) => right[1] - left[1])[0]?.[0];
};

const buildPatch = (template = {}) => {
  const patch = {};

  if (isGenericPlaintiffName(template.plaintiffName)) {
    const plaintiffName =
      inferPlaintiffName(template) ||
      (isSecurityDepositTemplate(template)
        ? SECURITY_DEPOSIT_FALLBACK_NAMES.plaintiffName
        : "Plaintiff");
    patch.plaintiffName = plaintiffName;
    patch.clientName = plaintiffName;
  }

  if (isGenericDefendantName(template.defendantName)) {
    const defendantName =
      inferDefendantName(template) ||
      (isSecurityDepositTemplate(template)
        ? SECURITY_DEPOSIT_FALLBACK_NAMES.defendantName
        : "Defendant");
    patch.defendantName = defendantName;
    patch.opponentName = defendantName;
  }

  return patch;
};

const replaceGenericTranscriptPartyNames = ({
  transcript = [],
  plaintiffName,
  defendantName,
}) =>
  transcript.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;

    const next = { ...entry };
    if (plaintiffName && isGenericPlaintiffName(next.speaker)) {
      next.speaker = plaintiffName;
    }
    if (defendantName && isGenericDefendantName(next.speaker)) {
      next.speaker = defendantName;
    }
    if (plaintiffName && /^(?:the\s+)?plaintiff\.?$/i.test(String(next.text || "").trim())) {
      next.text = plaintiffName;
    }
    if (defendantName && /^(?:the\s+)?defendant\.?$/i.test(String(next.text || "").trim())) {
      next.text = defendantName;
    }

    return next;
  });

const repairSessionCopies = async ({ sessions, template, patch, apply }) => {
  const sessionSet = {};
  if (patch.plaintiffName) {
    sessionSet["premise.clientName"] = patch.plaintiffName;
    sessionSet["templateSnapshot.plaintiffName"] = patch.plaintiffName;
    sessionSet["templateSnapshot.clientName"] = patch.plaintiffName;
    sessionSet["canonicalStory.plaintiffName"] = patch.plaintiffName;
    sessionSet["canonicalStory.clientName"] = patch.plaintiffName;
  }
  if (patch.defendantName) {
    sessionSet["premise.opponentName"] = patch.defendantName;
    sessionSet["templateSnapshot.defendantName"] = patch.defendantName;
    sessionSet["templateSnapshot.opponentName"] = patch.defendantName;
    sessionSet["canonicalStory.defendantName"] = patch.defendantName;
    sessionSet["canonicalStory.opponentName"] = patch.defendantName;
  }
  if (Object.keys(sessionSet).length === 0) {
    return 0;
  }

  const sessionQuery = {
    $or: [
      { caseTemplateId: template._id },
      { templateSlug: template.slug },
      { scenarioId: template.slug },
    ],
  };
  const matchingSessions = await sessions.find(sessionQuery).toArray();
  let changedSessions = 0;

  for (const session of matchingSessions) {
    const repairedTranscript = replaceGenericTranscriptPartyNames({
      transcript: session.interviewTranscript || [],
      plaintiffName: patch.plaintiffName,
      defendantName: patch.defendantName,
    });
    const transcriptChanged =
      JSON.stringify(repairedTranscript) !==
      JSON.stringify(session.interviewTranscript || []);
    const update = {
      $set: {
        ...sessionSet,
        updatedAt: new Date(),
      },
    };

    if (transcriptChanged) {
      update.$set.interviewTranscript = repairedTranscript;
    }

    if (apply) {
      const result = await sessions.updateOne({ _id: session._id }, update);
      changedSessions += result.modifiedCount;
    } else {
      changedSessions += 1;
    }
  }

  return changedSessions;
};

const main = async () => {
  const apply = process.argv.includes("--apply");
  const ids = process.argv
    .filter((arg) => arg.startsWith("--id="))
    .map((arg) => arg.slice("--id=".length))
    .filter(Boolean);
  const env = {
    ...readEnvFile(path.join(process.cwd(), ".env.local")),
    ...process.env,
  };

  if (!env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from the environment or .env.local");
  }

  const client = new MongoClient(env.MONGODB_URI);
  await client.connect();

  try {
    const templates = client.db().collection("casetemplates");
    const sessions = client.db().collection("casesessions");
    const query = ids.length
      ? { _id: { $in: ids.map((id) => new ObjectId(id)) } }
      : {
          $or: [
            { plaintiffName: { $regex: /^(?:the\s+)?tenant$/i } },
            { defendantName: { $regex: /^(?:the\s+)?landlord$/i } },
            { clientName: { $regex: /^(?:the\s+)?tenant$/i } },
            { opponentName: { $regex: /^(?:the\s+)?landlord$/i } },
            { plaintiffName: { $regex: /^(?:the\s+)?plaintiff$/i } },
            { defendantName: { $regex: /^(?:the\s+)?defendant$/i } },
            { clientName: { $regex: /^(?:the\s+)?plaintiff$/i } },
            { opponentName: { $regex: /^(?:the\s+)?defendant$/i } },
          ],
        };

    const matches = await templates.find(query).sort({ updatedAt: -1 }).toArray();

    console.log(`${apply ? "Applying" : "Dry run for"} ${matches.length} matching template(s).`);

    let updated = 0;
    let skipped = 0;

    for (const template of matches) {
      const patch = buildPatch(template);
      const hasPatch = Object.keys(patch).length > 0;
      const summary = {
        id: String(template._id),
        slug: template.slug,
        title: template.title,
        from: {
          plaintiffName: template.plaintiffName || template.clientName,
          defendantName: template.defendantName || template.opponentName,
        },
        to: hasPatch ? patch : null,
      };

      console.log(JSON.stringify(summary, null, 2));

      if (!hasPatch) {
        skipped += 1;
        continue;
      }

      if (apply) {
        await templates.updateOne(
          { _id: template._id },
          {
            $set: {
              ...patch,
              updatedAt: new Date(),
            },
          }
        );
      }

      const sessionCount = await repairSessionCopies({
        sessions,
        template,
        patch,
        apply,
      });
      console.log(
        `${apply ? "Updated" : "Would update"} ${sessionCount} existing session(s) for ${template.slug}.`
      );

      updated += 1;
    }

    const genericSessionQuery = {
      $or: [
        { "premise.clientName": { $regex: /^(?:the\s+)?(?:tenant|plaintiff)$/i } },
        { "premise.opponentName": { $regex: /^(?:the\s+)?(?:landlord|defendant)$/i } },
        { "templateSnapshot.clientName": { $regex: /^(?:the\s+)?(?:tenant|plaintiff)$/i } },
        { "templateSnapshot.opponentName": { $regex: /^(?:the\s+)?(?:landlord|defendant)$/i } },
        { "interviewTranscript.speaker": { $regex: /^(?:the\s+)?(?:tenant|plaintiff|landlord|defendant)$/i } },
        { "interviewTranscript.text": { $regex: /^(?:the\s+)?(?:plaintiff|defendant)\.?$/i } },
      ],
    };
    const genericSessions = await sessions.find(genericSessionQuery).toArray();
    let sessionOnlyUpdates = 0;

    for (const session of genericSessions) {
      const source = {
        title: session.title,
        subtitle: session.templateSnapshot?.subtitle,
        overview: session.templateSnapshot?.overview || session.premise?.overview,
        openingStatement:
          session.templateSnapshot?.openingStatement || session.premise?.openingStatement,
        canonicalStory: session.canonicalStory,
      };
      if (!isSecurityDepositTemplate(source)) {
        continue;
      }

      const patch = {
        plaintiffName: SECURITY_DEPOSIT_FALLBACK_NAMES.plaintiffName,
        clientName: SECURITY_DEPOSIT_FALLBACK_NAMES.plaintiffName,
        defendantName: SECURITY_DEPOSIT_FALLBACK_NAMES.defendantName,
        opponentName: SECURITY_DEPOSIT_FALLBACK_NAMES.defendantName,
      };
      const repairedTranscript = replaceGenericTranscriptPartyNames({
        transcript: session.interviewTranscript || [],
        plaintiffName: patch.plaintiffName,
        defendantName: patch.defendantName,
      });
      const update = {
        $set: {
          "premise.clientName": patch.plaintiffName,
          "premise.opponentName": patch.defendantName,
          "templateSnapshot.plaintiffName": patch.plaintiffName,
          "templateSnapshot.clientName": patch.plaintiffName,
          "templateSnapshot.defendantName": patch.defendantName,
          "templateSnapshot.opponentName": patch.defendantName,
          "canonicalStory.plaintiffName": patch.plaintiffName,
          "canonicalStory.clientName": patch.plaintiffName,
          "canonicalStory.defendantName": patch.defendantName,
          "canonicalStory.opponentName": patch.defendantName,
          interviewTranscript: repairedTranscript,
          updatedAt: new Date(),
        },
      };

      console.log(
        JSON.stringify(
          {
            sessionOnly: true,
            id: String(session._id),
            title: session.title,
            from: {
              clientName: session.premise?.clientName,
              opponentName: session.premise?.opponentName,
            },
            to: {
              clientName: patch.plaintiffName,
              opponentName: patch.defendantName,
            },
          },
          null,
          2
        )
      );

      if (apply) {
        const result = await sessions.updateOne({ _id: session._id }, update);
        sessionOnlyUpdates += result.modifiedCount;
      } else {
        sessionOnlyUpdates += 1;
      }
    }

    if (sessionOnlyUpdates > 0) {
      console.log(
        `${apply ? "Updated" : "Would update"} ${sessionOnlyUpdates} session-only generic copy/copies.`
      );
    }

    console.log(
      `${apply ? "Updated" : "Would update"} ${updated} template(s); skipped ${skipped} ambiguous template(s).`
    );
  } finally {
    await client.close();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
