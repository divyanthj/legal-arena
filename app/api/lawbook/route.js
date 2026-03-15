import { NextResponse } from "next/server";
import { getLawbookRules, legalArenaLawbook } from "@/data/legalArenaLawbook";
import connectMongo from "@/libs/mongoose";
import CaseTemplate from "@/models/CaseTemplate";

export async function GET(req) {
  const templateId = req.nextUrl.searchParams.get("caseTemplateId");

  if (!templateId) {
    return NextResponse.json({
      version: "v1",
      rules: legalArenaLawbook,
    });
  }

  await connectMongo();
  const template = await CaseTemplate.findById(templateId);

  return NextResponse.json({
    version: "v1",
    rules: getLawbookRules(template?.legalTags),
  });
}
