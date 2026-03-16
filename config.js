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
  aws: {
    bucket: "bucket-name",
    bucketUrl: `https://bucket-name.s3.amazonaws.com/`,
    cdn: "https://cdn-id.cloudfront.net/",
  },
  email: {
    fromNoReply: `Legal Arena <noreply@legalarena.app>`,
    fromSupport: `Legal Arena <support@legalarena.app>`,
    supportEmail: "support@legalarena.app",
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
