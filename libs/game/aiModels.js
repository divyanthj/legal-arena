import "server-only";

export const CASE_CREATION_MODEL =
  process.env.OPENAI_CASE_CREATION_MODEL?.trim() ||
  process.env.OPENAI_DYNAMIC_CASE_MODEL?.trim() ||
  "gpt-5.6-sol";
