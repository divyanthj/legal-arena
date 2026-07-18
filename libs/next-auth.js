import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import mongoose from "mongoose";
import config from "@/config";
import connectMongo from "./mongo";
import connectMongoose from "@/libs/mongoose";
import { sendMagicLinkEmail } from "@/libs/emailSender";
import User from "@/models/User";
import { recordTimedSoloCampaignLogin } from "@/libs/admin";

const findUserForSessionToken = async (token = {}) => {
  const selectors = [];

  if (token?.sub && mongoose.Types.ObjectId.isValid(token.sub)) {
    selectors.push({ _id: token.sub });
  }

  if (token?.email) {
    selectors.push({ email: String(token.email).trim().toLowerCase() });
  }

  if (!selectors.length) {
    return null;
  }

  return User.findOne({ $or: selectors }).select("_id");
};

export const authOptions = {
  // Set any random key in .env.local
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      // Follow the "Login with Google" tutorial to get your credentials
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
      async profile(profile) {
        return {
          id: profile.sub,
          name: profile.given_name ? profile.given_name : profile.name,
          email: profile.email,
          image: profile.picture,
          createdAt: new Date(),
        };
      },
    }),
    // Email sign-in is sent through Resend.
    ...(connectMongo
      ? [
          EmailProvider({
            from: config.email.fromNoReply,
            sendVerificationRequest: async ({ identifier, url }) => {
              await sendMagicLinkEmail({ email: identifier, url });
            },
          }),
        ]
      : []),
  ],
  // New users will be saved in Database (MongoDB Atlas). Each user (model) has some fields like name, email, image, etc..
  // Requires a MongoDB database. Set MONOGODB_URI env variable.
  // Learn more about the model type: https://next-auth.js.org/v3/adapters/models
  ...(connectMongo && { adapter: MongoDBAdapter(connectMongo) }),

  callbacks: {
    jwt: async ({ token }) => {
      if (!token?.sub) {
        return token;
      }

      try {
        await connectMongoose();
        const user = await findUserForSessionToken(token);

        if (!user) {
          console.warn("next-auth jwt lookup did not find a matching user", {
            sub: token.sub,
            email: token.email,
          });
        }
      } catch (error) {
        console.error("next-auth jwt lookup failed", error);
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (!token?.sub) {
        return null;
      }

      if (session?.user) {
        session.user.id = token.sub;
      }
      return session;
    },
    redirect: async ({ baseUrl }) => {
      return `${baseUrl}${config.auth.callbackUrl}`;
    },
  },
  events: {
    signIn: async ({ user }) => {
      try {
        await recordTimedSoloCampaignLogin({
          userId: user?.id,
          email: user?.email || "",
          nowInput: new Date(),
        });
      } catch (error) {
        // Campaign enrollment must never prevent authentication.
        console.error("timed solo campaign login enrollment failed", error);
      }
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin/verify",
    error: "/signin",
  },
  theme: {
    brandColor: config.colors.main,
    // Add you own logo below. Recommended size is rectangle (i.e. 200x50px) and show your logo + name.
    // It will be used in the login flow to display your logo. If you don't add it, it will look faded.
    logo: `https://${config.domainName}/logoAndName.png`,
  },
};
