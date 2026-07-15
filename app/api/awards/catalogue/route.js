import { NextResponse } from "next/server";
import AwardDefinition from "@/models/AwardDefinition";
import AwardRaritySnapshot from "@/models/AwardRaritySnapshot";
import { ensureAwardCatalogue } from "@/libs/game/awards/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureAwardCatalogue();
    const [definitions, rarity] = await Promise.all([
      AwardDefinition.find({ enabled: true }).sort({ sortOrder: 1 }).lean(),
      AwardRaritySnapshot.find({}).lean(),
    ]);
    const rarityById = new Map(rarity.map((item) => [String(item.awardDefinitionId), item]));
    return NextResponse.json({ awards: definitions.map((item) => ({ code: item.code, name: item.name, emoji: item.emoji, description: item.description, category: item.category, kind: item.kind, repeatable: item.repeatable, hiddenUntilUnlocked: item.hiddenUntilUnlocked, tierThresholds: item.tierThresholds, sortOrder: item.sortOrder, rarity: rarityById.get(String(item._id)) || null })) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
