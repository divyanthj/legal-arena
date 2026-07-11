import config from "@/config";

export default function robots() {
  const base = `https://${config.domainName}`;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard/"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
