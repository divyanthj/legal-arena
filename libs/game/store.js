import "server-only";

import connectMongo from "@/libs/mongoose";
import CaseSession from "@/models/CaseSession";
import { LAWBOOK_VERSION, getLawbookRules } from "@/data/legalArenaLawbook";
import {
  getScenarioById,
  getScenarioCards,
  legalArenaScenarios,
} from "@/data/legalArenaScenarios";

const toPlain = (doc) => (doc?.toJSON ? doc.toJSON() : doc);

const defaultOpenQuestions = (scenario) =>
  scenario.factInventory.slice(0, 3).map((fact) => fact.label);

export const buildCasePayload = (caseSession) => {
  const plainCase = toPlain(caseSession);
  const scenario = getScenarioById(plainCase.scenarioId);

  return {
    ...plainCase,
    scenario: scenario
      ? {
          id: scenario.id,
          title: scenario.title,
          subtitle: scenario.subtitle,
          courtName: scenario.courtName,
          clientName: scenario.clientName,
          opponentName: scenario.opponentName,
          overview: scenario.overview,
          practiceArea: scenario.practiceArea,
        }
      : null,
    lawbook: getLawbookRules(scenario?.legalTags),
  };
};

export const listScenarioOptions = () => getScenarioCards();

export const createCaseSession = async ({ userId, scenarioId }) => {
  await connectMongo();

  const scenario =
    getScenarioById(scenarioId) ||
    legalArenaScenarios[Math.floor(Math.random() * legalArenaScenarios.length)];

  const caseSession = await CaseSession.create({
    userId,
    title: scenario.title,
    scenarioId: scenario.id,
    practiceArea: scenario.practiceArea,
    status: "interview",
    lawbookVersion: LAWBOOK_VERSION,
    premise: {
      clientName: scenario.clientName,
      opponentName: scenario.opponentName,
      courtName: scenario.courtName,
      overview: scenario.overview,
      desiredRelief: scenario.desiredRelief,
      openingStatement: scenario.openingStatement,
    },
    interviewTranscript: [
      {
        role: "client",
        speaker: scenario.clientName,
        text: scenario.openingStatement,
      },
    ],
    factSheet: {
      summary: scenario.overview,
      timeline: [],
      supportingFacts: [],
      risks: [],
      theory: scenario.starterTheory,
      desiredRelief: scenario.desiredRelief,
      openQuestions: defaultOpenQuestions(scenario),
      discoveredFactIds: [],
      ready: false,
    },
    score: {
      player: 0,
      opponent: 0,
      roundsCompleted: 0,
      lastBenchSignal: "",
      highlights: [],
      weaknesses: [],
    },
    verdict: {
      winner: "",
      summary: "",
      highlights: [],
      concerns: [],
      finalScore: {
        player: 0,
        opponent: 0,
      },
    },
  });

  return buildCasePayload(caseSession);
};

export const listCaseSessionsForUser = async (userId) => {
  await connectMongo();

  const cases = await CaseSession.find({ userId }).sort({ updatedAt: -1 });

  return cases.map((caseSession) => buildCasePayload(caseSession));
};

export const getCaseSessionForUser = async ({ userId, caseId }) => {
  await connectMongo();

  const caseSession = await CaseSession.findOne({ _id: caseId, userId });

  return caseSession ? buildCasePayload(caseSession) : null;
};

export const getCaseSessionDocumentForUser = async ({ userId, caseId }) => {
  await connectMongo();

  return CaseSession.findOne({ _id: caseId, userId });
};
