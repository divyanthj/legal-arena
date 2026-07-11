import UnsubscribeConfirmation from "./UnsubscribeConfirmation";
import { getSEOTags } from "@/libs/seo";

export const metadata = getSEOTags({
  title: "Unsubscribe | Legal Arena",
  description: "Update your Legal Arena mailing preference.",
  canonicalUrlRelative: "/unsubscribe",
  extraTags: { robots: { index: false, follow: false } },
});

export default function UnsubscribePage({ searchParams }) {
  return <UnsubscribeConfirmation token={String(searchParams?.token || "")} />;
}
