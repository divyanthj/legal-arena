import { IBM_Plex_Serif, Inter, Inter_Tight } from "next/font/google";
import Script from "next/script";
import PlausibleProvider from "next-plausible";
import { getSEOTags } from "@/libs/seo";
import ClientLayout from "@/components/LayoutClient";
import Footer from "@/components/Footer";
import config from "@/config";
import "./globals.css";

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
          <Script
            defer
            data-website-id="dfid_jj19izF8dJN5YpCrXoA2G"
            data-domain="legalarena.app"
            src="https://datafa.st/js/script.js"
            strategy="afterInteractive"
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
