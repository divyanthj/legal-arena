import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import { isAdminEmail } from "@/libs/admin";
import {
  sendFreeAccessGrantedEmail,
  sendFreeAccessRevokedEmail,
} from "@/libs/emailSender";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";

const normalizeEmail = (value = "") => value.trim().toLowerCase();

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const serializeGrant = (user) => ({
  id: user._id.toString(),
  email: user.email || "",
  freeAccessGrantedAt: user.freeAccessGrantedAt || null,
  freeAccessGrantedBy: user.freeAccessGrantedBy || "",
});

const requireAdminSession = async () => {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: "Not signed in" }, { status: 401 }),
    };
  }

  if (!isAdminEmail(session.user.email)) {
    return {
      error: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      ),
    };
  }

  return { session };
};

export async function GET() {
  const { error } = await requireAdminSession();

  if (error) {
    return error;
  }

  try {
    await connectMongo();
    const users = await User.find({ freeAccessGranted: true })
      .select("email freeAccessGrantedAt freeAccessGrantedBy")
      .sort({ freeAccessGrantedAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({
      grants: users.map(serializeGrant),
      total: await User.countDocuments({ freeAccessGranted: true }),
    });
  } catch (error) {
    console.error("Failed to load free access grants:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load free access grants." },
      { status: 500 }
    );
  }
}

const sendAccessEmail = async (sender, payload) => {
  try {
    await sender(payload);
    return { sent: true };
  } catch (error) {
    console.error("Failed to send access email:", error);
    return {
      sent: false,
      error: error.message || "Email failed to send.",
    };
  }
};

export async function POST(req) {
  const { session, error } = await requireAdminSession();

  if (error) {
    return error;
  }

  try {
    const body = await req.json();
    const email = normalizeEmail(body?.email);

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    await connectMongo();

    const grantedBy = normalizeEmail(session.user.email);
    const user = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          email,
          freeAccessGranted: true,
          freeAccessGrantedAt: new Date(),
          freeAccessGrantedBy: grantedBy,
        },
      },
      {
        new: true,
        runValidators: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    ).select("email name freeAccessGrantedAt freeAccessGrantedBy");

    const emailResult = await sendAccessEmail(sendFreeAccessGrantedEmail, {
      email: user.email,
      name: user.name || "",
      grantedBy,
    });

    return NextResponse.json(
      {
        grant: serializeGrant(user),
        emailSent: emailResult.sent,
        emailError: emailResult.error || "",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to grant free access:", error);
    return NextResponse.json(
      { error: error.message || "Failed to grant free access." },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  const { session, error } = await requireAdminSession();

  if (error) {
    return error;
  }

  try {
    const body = await req.json();
    const email = normalizeEmail(body?.email);

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    await connectMongo();

    const revokedBy = normalizeEmail(session.user.email);
    const user = await User.findOneAndUpdate(
      { email, freeAccessGranted: true },
      {
        $set: {
          freeAccessGranted: false,
          freeAccessGrantedBy: "",
        },
        $unset: {
          freeAccessGrantedAt: "",
        },
      },
      {
        new: false,
        runValidators: true,
      }
    ).select("email name freeAccessGrantedAt freeAccessGrantedBy");

    if (!user) {
      return NextResponse.json(
        { error: "No manual free-access grant found for that email." },
        { status: 404 }
      );
    }

    const emailResult = await sendAccessEmail(sendFreeAccessRevokedEmail, {
      email: user.email,
      name: user.name || "",
      revokedBy,
    });

    return NextResponse.json({
      revoked: serializeGrant(user),
      emailSent: emailResult.sent,
      emailError: emailResult.error || "",
    });
  } catch (error) {
    console.error("Failed to revoke free access:", error);
    return NextResponse.json(
      { error: error.message || "Failed to revoke free access." },
      { status: 500 }
    );
  }
}
