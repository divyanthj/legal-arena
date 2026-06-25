import { NextResponse } from "next/server";
import { trackAICrawlerRequest } from "@datafast/ai-crawl";

const DATAFAST_WEBSITE_ID =
  process.env.NEXT_PUBLIC_DATAFAST_WEBSITE_ID || "dfid_jj19izF8dJN5YpCrXoA2G";

export function middleware(request, event) {
  trackAICrawlerRequest(request, event, {
    websiteId: DATAFAST_WEBSITE_ID,
  });

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
