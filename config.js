import themes from "daisyui/src/theming/themes";

const config = {
  appName: "Legal Arena",
  appDescription:
    "A legal training arena where lawyers build case files, argue disputes, and climb specialty leaderboards.",
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
        description: "Perfect for small projects",
        price: 79,
        priceAnchor: 99,
        features: [
          {
            name: "NextJS boilerplate",
          },
          { name: "User oauth" },
          { name: "Database" },
          { name: "Emails" },
        ],
      },
      {
        isFeatured: true,
        priceId:
          process.env.NODE_ENV === "development"
            ? "price_1O5KtcAxyNprDp7iftKnrrpw"
            : "price_456",
        name: "Advanced",
        description: "You need more power",
        price: 99,
        priceAnchor: 149,
        features: [
          {
            name: "NextJS boilerplate",
          },
          { name: "User oauth" },
          { name: "Database" },
          { name: "Emails" },
          { name: "1 year of updates" },
          { name: "24/7 support" },
        ],
      },
    ],
  },
  lemonsqueezy: {
    earlyAccessVariantId:
      process.env.NODE_ENV === "development"
        ? process.env.LEMONSQUEEZY_VARIANT_ID_DEV || ""
        : process.env.LEMONSQUEEZY_VARIANT_ID || "",
    plans: [
      {
        variantId:
          process.env.NODE_ENV === "development"
            ? process.env.LEMONSQUEEZY_VARIANT_ID_DEV || ""
            : process.env.LEMONSQUEEZY_VARIANT_ID || "",
        name: "Early Access",
        description:
          "One-time purchase for immediate access while Legal Arena is still in early access.",
        price: 9.99,
        priceAnchor: 29.99,
        features: [
          { name: "Immediate access to the full Legal Arena build" },
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
