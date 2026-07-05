const clampNumber = (value, min, max) =>
  Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : 0));

const moodToSatisfaction = (value) =>
  Math.round(((clampNumber(value, -100, 100) + 100) / 200) * 100);

export const calculateSettlementQuality = ({ finalMoods = {} } = {}) => {
  const playerSatisfaction = moodToSatisfaction(finalMoods.player ?? 0);
  const opponentSatisfaction = moodToSatisfaction(finalMoods.opponent ?? 0);
  const averageSatisfaction = Math.round((playerSatisfaction + opponentSatisfaction) / 2);
  const floorSatisfaction = Math.min(playerSatisfaction, opponentSatisfaction);
  const balanceGap = Math.abs(playerSatisfaction - opponentSatisfaction);
  const score = Math.max(
    0,
    Math.min(100, Math.round(floorSatisfaction * 0.55 + averageSatisfaction * 0.45))
  );

  const label =
    score >= 85
      ? "Excellent settlement"
      : score >= 70
      ? "Strong settlement"
      : score >= 55
      ? "Fair settlement"
      : score >= 40
      ? "Uneven settlement"
      : "Fragile settlement";
  const detail =
    balanceGap <= 12
      ? "Both sides left with similar satisfaction."
      : playerSatisfaction > opponentSatisfaction
      ? "Your client did better than the opponent."
      : "The opponent accepted, but your client gave up more ground.";

  return {
    score,
    label,
    detail,
    playerSatisfaction,
    opponentSatisfaction,
    averageSatisfaction,
    floorSatisfaction,
    balanceGap,
  };
};

export const calculateSettlementXp = ({ complexity = 1, finalMoods = {} } = {}) => {
  const baseXp = 55 + (Number(complexity) || 1) * 15;
  const quality = calculateSettlementQuality({ finalMoods });
  const satisfactionBonus = Math.round((quality.score / 100) * 45);

  return {
    baseXp,
    satisfactionBonus,
    cooperationBonus: satisfactionBonus,
    totalXp: baseXp + satisfactionBonus,
    quality,
  };
};
