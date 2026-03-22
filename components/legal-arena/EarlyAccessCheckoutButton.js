"use client";

import { useState } from "react";
import apiClient from "@/libs/api";

export default function EarlyAccessCheckoutButton({ variantId }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckout = async () => {
    setIsLoading(true);

    try {
      const response = await apiClient.post("/lemonsqueezy/create-checkout", {
        variantId,
        redirectUrl: window.location.href,
      });

      if (response?.url) {
        window.location.href = response.url;
      }
    } catch (error) {
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
        "Get early access for $9.99"
      )}
    </button>
  );
}
