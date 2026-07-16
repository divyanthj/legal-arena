const MOOD_KEYS = ["player", "opponent"];

const readMood = (snapshot, key) => {
  const value = Number(snapshot?.[key]);
  return Number.isFinite(value) ? value : null;
};

const formatDelta = (delta) => `${delta > 0 ? "+" : ""}${delta}`;

const describeReaction = ({ name, delta }) => {
  if (delta >= 8) {
    return `${name} liked this proposal`;
  }

  if (delta > 0) {
    return `${name} became more receptive`;
  }

  if (delta <= -8) {
    return `${name} reacted poorly to this proposal`;
  }

  return `${name} became less receptive`;
};

export const annotateSettlementMoodReactions = (
  transcript,
  { playerName = "Your client", opponentName = "The opposing side" } = {}
) => {
  let previousSnapshot = null;

  return (Array.isArray(transcript) ? transcript : []).map((entry) => {
    const snapshot = entry?.moodSnapshot;
    const hasSnapshot = MOOD_KEYS.every((key) => readMood(snapshot, key) !== null);

    if (!hasSnapshot) {
      return { ...entry, moodReactions: [] };
    }

    const reactions = [];
    if (previousSnapshot) {
      const subjects = [
        { key: "player", name: playerName },
        { key: "opponent", name: opponentName },
      ];

      subjects.forEach(({ key, name }) => {
        const delta = readMood(snapshot, key) - readMood(previousSnapshot, key);
        if (!delta) {
          return;
        }

        reactions.push({
          key,
          delta,
          deltaLabel: formatDelta(delta),
          tone: delta > 0 ? "positive" : "negative",
          label: describeReaction({ name, delta }),
        });
      });
    }

    previousSnapshot = snapshot;
    return { ...entry, moodReactions: reactions };
  });
};
