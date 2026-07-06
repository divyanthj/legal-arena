"use client";

import { useState } from "react";
import * as HeroIcons from "@heroicons/react/24/outline";
import apiClient from "@/libs/api";
import { trackGoal } from "@/libs/datafast";

export default function EarlyAccessCheckoutButton({
  variantId,
  label = "Get early access for $15.99",
  source = "early_access_button",
  className = "btn btn-primary btn-block min-h-14 text-base font-black uppercase tracking-[0.08em]",
  onIntent = null,
  showArrow = false,
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckout = async () => {
    setIsLoading(true);
    onIntent?.();
    trackGoal("early_access_checkout_started", {
      provider: "lemonsqueezy",
      variant_id: variantId,
      source,
    });

    try {
      const purchaseSuccessUrl = new URL("/purchase-success", window.location.origin).toString();
      const response = await apiClient.post("/lemonsqueezy/create-checkout", {
        variantId,
        redirectUrl: purchaseSuccessUrl,
      });

      if (response?.url) {
        trackGoal("early_access_checkout_redirect", {
          provider: "lemonsqueezy",
          variant_id: variantId,
          source,
        });
        window.location.href = response.url;
      }
    } catch (error) {
      trackGoal("early_access_checkout_failed", {
        provider: "lemonsqueezy",
        variant_id: variantId,
        source,
      });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      className={className}
      onClick={handleCheckout}
      disabled={isLoading}
    >
      {isLoading ? (
        <span className="loading loading-spinner loading-sm" />
      ) : (
        <>
          <span>{label}</span>
          {showArrow ? (
            <HeroIcons.ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
          ) : null}
        </>
      )}
    </button>
  );
}
