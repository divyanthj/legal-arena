import { NextResponse } from "next/server";
import {
  LAWBOOK_VERSION,
  getLawbookRules,
  getLawbookRulesForCategory,
  legalArenaLawbook,
} from "@/data/legalArenaLawbook";
import { LEGAL_CASE_CATEGORIES } from "@/libs/game/categories";
import connectMongo from "@/libs/mongoose";
import CaseTemplate from "@/models/CaseTemplate";

export async function GET(req) {
  const templateId = req.nextUrl.searchParams.get("caseTemplateId");

  if (!templateId) {
    return NextResponse.json({
      version: LAWBOOK_VERSION,
      categories: LEGAL_CASE_CATEGORIES,
      defaultCategorySlug: "all",
      rules: legalArenaLawbook,
    });
  }

  await connectMongo();
  const template = await CaseTemplate.findById(templateId);

  return NextResponse.json({
    version: LAWBOOK_VERSION,
    categories: LEGAL_CASE_CATEGORIES,
    defaultCategorySlug: template?.primaryCategory || "all",
    rules: getLawbookRules(),
    defaultCategoryRules: getLawbookRulesForCategory(template?.primaryCategory),
  });
}
