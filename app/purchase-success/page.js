import { getSEOTags } from "@/libs/seo";
import { Suspense } from "react";
import PurchaseSuccessRedirect from "./PurchaseSuccessRedirect";

export const metadata = getSEOTags({
  title: "Purchase Complete | Legal Arena",
  description: "Thank you for purchasing Legal Arena early access.",
  canonicalUrlRelative: "/purchase-success",
});

export default function PurchaseSuccessPage() {
  return (
    <Suspense fallback={<main className="arena-app-shell min-h-screen bg-black" />}>
      <PurchaseSuccessRedirect />
    </Suspense>
  );
}
