import { getSEOTags } from "@/libs/seo";
import PurchaseSuccessRedirect from "./PurchaseSuccessRedirect";

export const metadata = getSEOTags({
  title: "Purchase Complete | Legal Arena",
  description: "Thank you for purchasing Legal Arena early access.",
  canonicalUrlRelative: "/purchase-success",
});

export default function PurchaseSuccessPage() {
  return <PurchaseSuccessRedirect />;
}
