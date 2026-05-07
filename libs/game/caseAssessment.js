export const clampSuccessChance = (value) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
};

export const normalizeAssessmentReasons = (reasons = [], limit = 3) =>
  (Array.isArray(reasons) ? reasons : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, limit);

export const normalizeCaseAssessment = (assessment = {}, previous = null) => {
  const chance = clampSuccessChance(
    assessment.successChance ?? assessment.currentSuccessChance
  );

  if (chance === null) {
    return previous || null;
  }

  return {
    currentSuccessChance: chance,
    currentReasons: normalizeAssessmentReasons(
      assessment.reasons || assessment.currentReasons
    ),
    lockedCourtEntryChance:
      clampSuccessChance(assessment.lockedCourtEntryChance) ?? null,
    lockedReasons: normalizeAssessmentReasons(assessment.lockedReasons),
    assessedAt: assessment.assessedAt || new Date(),
    lockedAt: assessment.lockedAt || null,
  };
};

export const lockCaseAssessment = (assessment = null) => {
  const normalized = normalizeCaseAssessment(assessment);

  if (!normalized) {
    return null;
  }

  return {
    ...normalized,
    lockedCourtEntryChance: normalized.currentSuccessChance,
    lockedReasons: normalized.currentReasons,
    lockedAt: new Date(),
  };
};

export const calculateUnderdogBonus = (lockedCourtEntryChance, verdictWinner) => {
  const chance = clampSuccessChance(lockedCourtEntryChance);

  if (verdictWinner !== "player" || chance === null || chance >= 50) {
    return {
      bonusXp: 0,
      bonusRating: 0,
      note: "",
    };
  }

  const gap = 50 - chance;
  const bonusXp = Math.min(50, Math.round(gap * 1.2));
  const bonusRating = Math.min(10, Math.ceil(gap / 10) * 2);

  return {
    bonusXp,
    bonusRating,
    note: `Won as a ${chance}% underdog`,
  };
};
