const settlementQuestionPattern =
  /\b(settle|settles|settled|settling|settlement|resolve|resolution|deal|negotiate|offer|out of court|avoid court)\b/i;

const positiveAuthorityPattern =
  /\b(yes|yeah|yep|ok|okay|sure|agree|authorize|authorise|approved|approval|go ahead|open to|willing|prepared to|let's|we can|you can|that's fine|that is fine|i would accept|i'd accept)\b/i;

const negativeAuthorityPattern =
  /\b(no|not now|not yet|don't|do not|won't|will not|can't|cannot|refuse|not willing|not open|rather go to court|want court|take it to court)\b/i;

export const hasClientSettlementAuthority = (interviewTranscript = []) => {
  const transcript = Array.isArray(interviewTranscript) ? interviewTranscript : [];

  for (let index = 0; index < transcript.length - 1; index += 1) {
    const question = transcript[index];
    const answer = transcript[index + 1];

    if (question?.role !== "player" || answer?.role === "player") {
      continue;
    }

    const questionText = String(question.text || "");
    const answerText = String(answer.text || "");

    if (!settlementQuestionPattern.test(questionText)) {
      continue;
    }

    if (
      positiveAuthorityPattern.test(answerText) &&
      !negativeAuthorityPattern.test(answerText)
    ) {
      return true;
    }
  }

  return false;
};
