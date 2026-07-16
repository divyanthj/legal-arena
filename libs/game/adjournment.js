export const getAdjournmentAllowance = (complexity = 1) => {
  const normalized = Math.max(1, Math.min(5, Math.round(Number(complexity) || 1)));

  if (normalized >= 5) return 3;
  if (normalized >= 3) return 2;
  return 1;
};

const toPlainHistoryEntry = (entry) =>
  entry?.toObject ? entry.toObject() : { ...(entry || {}) };

export const normalizeAdjournmentState = (adjournment = {}, complexity = 1) => ({
  active: Boolean(adjournment?.active),
  grantsUsed: Math.max(0, Number(adjournment?.grantsUsed) || 0),
  grantsAllowed: Math.max(
    0,
    Number(adjournment?.grantsAllowed) || getAdjournmentAllowance(complexity)
  ),
  history: Array.isArray(adjournment?.history)
    ? adjournment.history.map(toPlainHistoryEntry)
    : [],
});

export const getAdjournmentRound = (source = {}) => {
  if (Array.isArray(source?.courtroomRounds)) {
    const openRound = source.courtroomRounds.find((round) => round.status === "open");
    const judgedCount = source.courtroomRounds.filter(
      (round) => round.status === "judged"
    ).length;
    return openRound?.round || judgedCount + 1;
  }

  return Math.max(1, (Number(source?.score?.roundsCompleted) || 0) + 1);
};

export const hasAdjournmentRequestForRound = ({
  adjournment,
  round,
  requestedByUserId = "",
} = {}) =>
  normalizeAdjournmentState(adjournment).history.some(
    (entry) =>
      entry.trigger === "player_request" &&
      Number(entry.courtroomRound) === Number(round) &&
      (!requestedByUserId ||
        String(entry.requestedByUserId || "") === String(requestedByUserId))
  );

export const getAdjournmentRemaining = (adjournment = {}, complexity = 1) => {
  const state = normalizeAdjournmentState(adjournment, complexity);
  return Math.max(0, state.grantsAllowed - state.grantsUsed);
};

export const recordAdjournmentDecision = ({
  source,
  trigger,
  requestedByUserId = null,
  courtroomRound,
  reason,
  ruling,
  granted,
} = {}) => {
  const normalized = normalizeAdjournmentState(source?.adjournment, source?.complexity);
  const entry = {
    trigger,
    requestedByUserId: requestedByUserId || null,
    courtroomRound,
    reason,
    ruling,
    outcome: granted ? "granted" : "denied",
    createdAt: new Date(),
    resumedAt: null,
  };

  source.adjournment = {
    active: granted,
    grantsUsed: normalized.grantsUsed + (granted ? 1 : 0),
    grantsAllowed: normalized.grantsAllowed,
    history: [...normalized.history, entry],
  };
  source.markModified?.("adjournment");
  return entry;
};

export const resolveActiveAdjournment = (source) => {
  const state = normalizeAdjournmentState(source?.adjournment, source?.complexity);
  if (!state.active) return false;

  const resumedAt = new Date();
  const history = state.history.map((entry, index) =>
    index === state.history.length - 1 && entry.outcome === "granted"
      ? { ...entry, resumedAt }
      : entry
  );

  source.adjournment = { ...state, active: false, history };
  source.markModified?.("adjournment");
  return true;
};
