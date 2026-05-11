import themes from "daisyui/src/theming/themes.js";

const config = {
  appName: "Legal Arena",
  appDescription:
    "An online lawyer game where players interview clients, build fact sheets, argue courtroom cases against AI, and climb specialty leaderboards.",
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
        description: "Start practicing courtroom cases in Legal Arena.",
        price: 79,
        priceAnchor: 99,
        features: [
          { name: "AI courtroom case simulations" },
          { name: "Client intake and fact sheet practice" },
          { name: "Verdicts, scoring, and progression" },
        ],
      },
      {
        isFeatured: true,
        priceId:
          process.env.NODE_ENV === "development"
            ? "price_1O5KtcAxyNprDp7iftKnrrpw"
            : "price_456",
        name: "Advanced",
        description: "Deeper access for frequent Legal Arena players.",
        price: 99,
        priceAnchor: 149,
        features: [
          { name: "Expanded case library access" },
          { name: "Advanced courtroom practice modes" },
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
          "One-time purchase for immediate access while Legal Arena is still in early access.",
        price: 9.99,
        priceAnchor: 29.99,
        features: [
          { name: "Immediate access to the full Legal Arena build" },
          { name: "Challenge other players to async PVP cases" },
          { name: "All future early-access updates included" },
          { name: "One-time payment, no subscription" },
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
