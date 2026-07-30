export const getAwardEventKey = (award = {}) =>
  String(
    award.eventKey ||
      [
        award.code || "award",
        award.type || "unlocked",
        award.tier || "none",
        award.evaluationSource || "objective",
      ].join(":")
  );

export const mergeAwardChanges = (current = [], incoming = []) => {
  const currentChanges = Array.isArray(current) ? current : [];
  const nextChanges = Array.isArray(incoming) ? incoming : [];
  const seen = new Set(currentChanges.map(getAwardEventKey));
  const additions = [];

  nextChanges.forEach((award) => {
    const eventKey = getAwardEventKey(award);
    if (seen.has(eventKey)) return;
    seen.add(eventKey);
    additions.push(award);
  });

  return additions.length ? [...currentChanges, ...additions] : currentChanges;
};
