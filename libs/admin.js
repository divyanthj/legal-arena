import "server-only";
import mongoose from "mongoose";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";

const normalizeEmail = (value = "") => value.trim().toLowerCase();

const parseEmailList = (rawValue = "") => {
  const raw = rawValue?.trim();

  if (!raw) {
    return [];
  }

  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(normalizeEmail).filter(Boolean) : [];
    } catch (error) {
      return [];
    }
  }

  return raw.split(",").map(normalizeEmail).filter(Boolean);
};

const parseAdmins = () => parseEmailList(process.env.ADMINS);
const parseGrantedAccess = () => parseEmailList(process.env.ACCESS_GRANTED);

export const getAdminEmails = () => parseAdmins();
export const getGrantedAccessEmails = () => parseGrantedAccess();

export const isAdminEmail = (email) =>
  Boolean(email) && parseAdmins().includes(normalizeEmail(email));

export const hasGameAccess = (email) =>
  Boolean(email) &&
  (isAdminEmail(email) || parseGrantedAccess().includes(normalizeEmail(email)));

export const userCanAccessArena = async (session) => {
  if (!session?.user?.id) {
    return false;
  }

  if (hasGameAccess(session.user?.email)) {
    return true;
  }

  await connectMongo();
  const selectors = [];
  const normalizedEmail = normalizeEmail(session.user?.email || "");

  if (mongoose.Types.ObjectId.isValid(session.user.id)) {
    selectors.push({ _id: session.user.id });
  }

  if (normalizedEmail) {
    selectors.push({ email: normalizedEmail });
  }

  if (!selectors.length) {
    return false;
  }

  const users = await User.find({ $or: selectors }).select(
    "_id email hasAccess freeAccessGranted freeAccessGrantedAt freeAccessGrantedBy"
  );
  const grantingUser = users.find(
    (user) => user?.hasAccess || user?.freeAccessGranted
  );

  if (!grantingUser) {
    return false;
  }

  const sessionUser = users.find(
    (user) => user?._id?.toString() === session.user.id
  );

  if (
    sessionUser &&
    !sessionUser.freeAccessGranted &&
    grantingUser.freeAccessGranted &&
    normalizedEmail &&
    normalizeEmail(grantingUser.email || "") === normalizedEmail
  ) {
    await User.updateOne(
      { _id: session.user.id },
      {
        $set: {
          freeAccessGranted: true,
          freeAccessGrantedAt: grantingUser.freeAccessGrantedAt || new Date(),
          freeAccessGrantedBy: grantingUser.freeAccessGrantedBy || "email-grant",
        },
      }
    );
  }

  return true;
};

export const getCaseGeneratorApiKey = () =>
  process.env.CASE_GENERATOR_API_KEY?.trim() || "";

export const hasValidCaseGeneratorApiKey = (req) => {
  const expected = getCaseGeneratorApiKey();
  if (!expected) {
    return false;
  }

  const bearer = req.headers.get("authorization") || "";
  const headerKey = req.headers.get("x-case-generator-key") || "";
  const bearerKey = bearer.startsWith("Bearer ") ? bearer.slice(7).trim() : "";

  return headerKey === expected || bearerKey === expected;
};
