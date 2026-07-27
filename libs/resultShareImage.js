import "server-only";

import mongoose from "mongoose";
import sharp from "sharp";
import connectMongo from "@/libs/mongoose";
import CaseSession from "@/models/CaseSession";
import Challenge from "@/models/Challenge";
import { getCategoryTitle } from "@/libs/game/categories";
import { calculateSettlementQuality } from "@/libs/game/settlementQuality";
import {
  buildResultShareData,
  buildResultShareSvg,
} from "@/libs/game/resultShareCard.mjs";

const notFound = () =>
  Object.assign(new Error("Result source not found."), { status: 404 });

export const getResultShareData = async ({ sourceType, sourceId, userId }) => {
  if (!["caseSession", "challenge"].includes(sourceType)) {
    throw Object.assign(new Error("Invalid result source."), { status: 400 });
  }
  if (!mongoose.isValidObjectId(sourceId) || !mongoose.isValidObjectId(userId)) {
    throw notFound();
  }

  await connectMongo();
  const source =
    sourceType === "caseSession"
      ? await CaseSession.findOne({ _id: sourceId, userId }).lean()
      : await Challenge.findOne({
          _id: sourceId,
          "participants.userId": userId,
        }).lean();

  if (!source) throw notFound();

  const settlementQualityScore =
    source.status === "settled" ||
    source.settlement?.status === "settled" ||
    (source.settlement?.resolved === true &&
      source.settlement?.resolution === "settled")
      ? calculateSettlementQuality({
          finalMoods: source.settlement?.moods || {},
        }).score
      : null;

  return buildResultShareData({
    sourceType,
    source,
    viewerId: userId,
    categoryTitle: getCategoryTitle(source.primaryCategory),
    settlementQualityScore,
  });
};

export const renderResultShareImage = async (data) =>
  sharp(Buffer.from(buildResultShareSvg(data)))
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
