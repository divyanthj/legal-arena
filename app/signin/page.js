import { getSEOTags } from "@/libs/seo";
import SignInPanel from "./SignInPanel";

export const metadata = getSEOTags({
  title: "Sign in | Legal Arena",
  description: "Sign in to continue your Legal Arena cases.",
  canonicalUrlRelative: "/signin",
  extraTags: { robots: { index: false, follow: false } },
});

export default function SignInPage({ searchParams }) {
  return <SignInPanel callbackUrl={String(searchParams?.callbackUrl || "/dashboard")} error={String(searchParams?.error || "")} />;
}
