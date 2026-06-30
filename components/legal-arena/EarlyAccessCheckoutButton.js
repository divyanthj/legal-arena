"use client";

import { useState } from "react";
import apiClient from "@/libs/api";
import { trackGoal } from "@/libs/datafast";

export default function EarlyAccessCheckoutButton({
  variantId,
  label = "Get early access for $9.99",
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckout = async () => {
    setIsLoading(true);
    trackGoal("early_access_checkout_started", {
      provider: "lemonsqueezy",
      variant_id: variantId,
      source: "early_access_button",
    });

    try {
      const response = await apiClient.post("/lemonsqueezy/create-checkout", {
        variantId,
        redirectUrl: window.location.href,
      });

      if (response?.url) {
        trackGoal("early_access_checkout_redirect", {
          provider: "lemonsqueezy",
          variant_id: variantId,
        });
        window.location.href = response.url;
      }
    } catch (error) {
      trackGoal("early_access_checkout_failed", {
        provider: "lemonsqueezy",
        variant_id: variantId,
      });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      className="btn btn-primary btn-block h-12 text-base"
      onClick={handleCheckout}
      disabled={isLoading}
    >
      {isLoading ? (
        <span className="loading loading-spinner loading-sm" />
      ) : (
        label
      )}
    </button>
  );
}
