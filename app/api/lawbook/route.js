import { NextResponse } from "next/server";
import { getLawbookRules, legalArenaLawbook } from "@/data/legalArenaLawbook";
import { getScenarioById } from "@/data/legalArenaScenarios";

export async function GET(req) {
  const scenarioId = req.nextUrl.searchParams.get("scenarioId");

  if (!scenarioId) {
    return NextResponse.json({
      version: "v1",
      rules: legalArenaLawbook,
    });
  }

  const scenario = getScenarioById(scenarioId);

  return NextResponse.json({
    version: "v1",
    rules: getLawbookRules(scenario?.legalTags),
  });
}
