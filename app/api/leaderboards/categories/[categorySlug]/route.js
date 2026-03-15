import { NextResponse } from "next/server";
import { listCategoryLeaderboard } from "@/libs/game/progression";
import { isValidCategorySlug } from "@/libs/game/categories";

export async function GET(req, { params }) {
  if (!isValidCategorySlug(params.categorySlug)) {
    return NextResponse.json({ error: "Unknown category" }, { status: 404 });
  }

  try {
    return NextResponse.json({
      category: params.categorySlug,
      leaderboard: await listCategoryLeaderboard(params.categorySlug),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
