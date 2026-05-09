const LOW_SIGNAL_RULE_TITLE_TOKENS = new Set([
  "claim",
  "needs",
  "proof",
  "matter",
  "matters",
  "requires",
  "must",
]);

export const pickRuleMentions = (argument, rules) => {
  const lowerArgument = argument.toLowerCase();

  return rules
    .filter((rule) => {
      const titleTokens = rule.title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length > 4);
      const matchingTitleTokens = titleTokens.filter((token) =>
        lowerArgument.includes(token)
      );
      const hasDistinctiveTitleMatch = matchingTitleTokens.some(
        (token) => !LOW_SIGNAL_RULE_TITLE_TOKENS.has(token)
      );
      const requiredTitleMatches = Math.min(2, titleTokens.length);

      return (
        (hasDistinctiveTitleMatch &&
          matchingTitleTokens.length >= requiredTitleMatches) ||
        lowerArgument.includes(rule.id.replace(/-/g, " "))
      );
    })
    .map((rule) => rule.id)
    .slice(0, 3);
};
