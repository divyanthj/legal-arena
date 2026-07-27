const normalizeLevel = (value, fallback = 1) => {
  const numeric = Math.round(Number(value));
  return Number.isFinite(numeric) ? Math.max(1, Math.min(5, numeric)) : fallback;
};

export const getCaseLibraryChallengeCap = ({
  playerComplexityCap = 1,
  unlockedComplexity = 1,
} = {}) => {
  const playerCap = normalizeLevel(playerComplexityCap);
  const categoryCap = normalizeLevel(unlockedComplexity);
  return Math.min(5, Math.min(playerCap, categoryCap) + 1);
};

export const clampCaseLibraryDifficulty = ({
  difficulty = 1,
  playerComplexityCap = 1,
  unlockedComplexity = 1,
} = {}) =>
  Math.min(
    normalizeLevel(difficulty),
    getCaseLibraryChallengeCap({
      playerComplexityCap,
      unlockedComplexity,
    })
  );
