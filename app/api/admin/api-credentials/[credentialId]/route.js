import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectMongo from "@/libs/mongoose";
import { requireAdminSession } from "@/libs/admin-auth";
import ApiCredential from "@/models/ApiCredential";

export async function DELETE(_req, { params }) {
  const { error } = await requireAdminSession();
  if (error) return error;
  if (!mongoose.Types.ObjectId.isValid(params.credentialId)) {
    return NextResponse.json({ error: "Credential not found." }, { status: 404 });
  }

  await connectMongo();
  const credential = await ApiCredential.findById(params.credentialId);
  if (!credential) {
    return NextResponse.json({ error: "Credential not found." }, { status: 404 });
  }
  if (!credential.revokedAt) {
    credential.revokedAt = new Date();
    await credential.save();
  }
  return NextResponse.json({ revoked: true, revokedAt: credential.revokedAt });
}
