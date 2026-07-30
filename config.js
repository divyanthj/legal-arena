import themes from "daisyui/src/theming/themes.js";

const config = {
  appName: "Legal Arena",
  appDescription:
    "A first-of-its-kind AI lawyer game where players interview AI clients, build cases, challenge other players, and fight it out in court before an AI judge.",
  domainName: "legalarena.app",
  crisp: {
    // Crisp website ID. If you don't use Crisp, keep supportEmail below so users can still reach you.
    id: "",
    onlyShowOnRoutes: ["/"],
  },
  stripe: {
    plans: [
      {
        priceId:
          process.env.NODE_ENV === "development"
            ? "price_1Niyy5AxyNprDp7iZIqEyD2h"
            : "price_456",
        name: "Starter",
        description: "Start playing AI-powered lawyer cases in Legal Arena.",
        price: 79,
        priceAnchor: 99,
        features: [
          { name: "Interview AI clients" },
          { name: "Build cases from the facts you uncover" },
          { name: "Argue in court and get verdicts" },
          { name: "Challenge other players in PVP cases" },
        ],
      },
      {
        isFeatured: true,
        priceId:
          process.env.NODE_ENV === "development"
            ? "price_1O5KtcAxyNprDp7iftKnrrpw"
            : "price_456",
        name: "Advanced",
        description: "More access for frequent Legal Arena players.",
        price: 99,
        priceAnchor: 149,
        features: [
          { name: "Infinite legal matter access" },
          { name: "Expanded courtroom game modes" },
          { name: "Progression and leaderboard tracking" },
          { name: "Future Legal Arena updates" },
        ],
      },
    ],
  },
  lemonsqueezy: {
    storeId: process.env.LEMONSQUEEZY_STORE_ID || "",
    earlyAccessVariantId: process.env.LEMONSQUEEZY_VARIANT_ID || "",
    plans: [
      {
        variantId: process.env.LEMONSQUEEZY_VARIANT_ID || "",
        name: "Early Access",
        description:
          "One-time purchase for the complete game available today and gameplay updates released during early access.",
        price: 15.99,
        priceAnchor: null,
        features: [
          {
            name: "Unlimited AI-generated solo cases across multiple areas of law",
          },
          {
            name: "Client interviews, case preparation, and courtroom arguments",
          },
          { name: "PVP cases judged by AI" },
          { name: "Rankings, XP, awards, and progression" },
          {
            name: "Future gameplay updates released during early access",
          },
        ],
      },
    ],
  },
  aws: {
    bucket: "bucket-name",
    bucketUrl: `https://bucket-name.s3.amazonaws.com/`,
    cdn: "https://cdn-id.cloudfront.net/",
  },
  email: {
    fromNoReply: `Legal Arena <noreply@resend.legalarena.app>`,
    fromSupport: `Legal Arena <support@resend.legalarena.app>`,
    supportEmail: "divyanthj@gmail.com",
  },
  colors: {
    theme: "corporate",
    main: themes.corporate.primary,
  },
  auth: {
    loginUrl: "/api/auth/signin",
    callbackUrl: "/dashboard",
  },
};

export default config;
