import { IBM_Plex_Serif, Inter, Inter_Tight } from "next/font/google";
import Script from "next/script";
import PlausibleProvider from "next-plausible";
import { getSEOTags } from "@/libs/seo";
import ClientLayout from "@/components/LayoutClient";
import Footer from "@/components/Footer";
import config from "@/config";
import "./globals.css";

const DATAFAST_WEBSITE_ID =
  process.env.NEXT_PUBLIC_DATAFAST_WEBSITE_ID || "dfid_jj19izF8dJN5YpCrXoA2G";
const GOOGLE_ADS_ID = "AW-18300889585";

const font = Inter({ subsets: ["latin"] });
const arenaHeadlineFont = Inter_Tight({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-arena-headline",
});
const arenaCaseFont = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-arena-case",
});

export const viewport = {
  // Will use the primary color of your theme to show a nice theme color in the URL bar of supported browsers
  themeColor: config.colors.main,
  width: "device-width",
  initialScale: 1,
};

// This adds default SEO tags to all pages in our app.
// You can override them in each page passing params to getSOTags() function.
export const metadata = getSEOTags();

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: config.appName,
  alternateName: ["Legal Arena lawyer game", "AI courtroom game"],
  url: `https://${config.domainName}/`,
  description: config.appDescription,
};

const webApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: config.appName,
  url: `https://${config.domainName}/`,
  description:
    "Legal Arena is an online lawyer game and AI courtroom simulator where players interview clients, build fact sheets, argue cases, and receive rulings.",
  applicationCategory: "GameApplication",
  operatingSystem: "Web",
  browserRequirements: "Requires a modern web browser.",
  isAccessibleForFree: true,
  offers: {
    "@type": "Offer",
    name: "Early Access",
    price: "15.99",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
  publisher: {
    "@type": "Organization",
    name: config.appName,
    url: `https://${config.domainName}/`,
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-theme={config.colors.theme}
      className={`${font.className} ${arenaHeadlineFont.variable} ${arenaCaseFont.variable}`}
    >
      {config.domainName && (
        <head>
          <PlausibleProvider domain={config.domainName} />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(webApplicationSchema),
            }}
          />
          <script
            id="datafast-queue"
            dangerouslySetInnerHTML={{
              __html:
                "window.datafast=window.datafast||function(){window.datafast.q=window.datafast.q||[];window.datafast.q.push(arguments);};",
            }}
          />
          <Script
            defer
            data-website-id={DATAFAST_WEBSITE_ID}
            data-domain="legalarena.app"
            data-disable-payments="true"
            src="https://datafa.st/js/script.js"
            strategy="afterInteractive"
          />
          <Script
            async
            src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
            strategy="afterInteractive"
          />
          <Script
            id="google-ads-gtag"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GOOGLE_ADS_ID}');
              `,
            }}
          />
        </head>
      )}
      <body className="min-h-screen">
        {/* ClientLayout contains all the client wrappers (Crisp chat support, toast messages, tooltips, etc.) */}
        <div className="flex min-h-screen flex-col">
          <div className="flex-1">
            <ClientLayout>{children}</ClientLayout>
          </div>
          <Footer />
        </div>
      </body>
    </html>
  );
}
