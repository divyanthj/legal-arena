const LEMON_SQUEEZY_API_URL = "https://api.lemonsqueezy.com/v1";

const getHeaders = () => {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("LEMONSQUEEZY_API_KEY is required");
  }

  return {
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
    Authorization: `Bearer ${apiKey}`,
  };
};

export const createLemonSqueezyCheckout = async ({
  variantId,
  redirectUrl,
  email,
  userId,
}) => {
  if (!variantId) {
    throw new Error("Lemon Squeezy variant ID is required");
  }

  const storeId = process.env.LEMONSQUEEZY_STORE_ID?.trim();

  if (!storeId) {
    throw new Error("LEMONSQUEEZY_STORE_ID is required");
  }

  const response = await fetch(`${LEMON_SQUEEZY_API_URL}/checkouts`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          product_options: {
            redirect_url: redirectUrl,
          },
          checkout_data: {
            email,
            custom: userId
              ? {
                  userId,
                }
              : undefined,
          },
        },
        relationships: {
          store: {
            data: {
              type: "stores",
              id: String(storeId),
            },
          },
          variant: {
            data: {
              type: "variants",
              id: String(variantId),
            },
          },
        },
      },
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const detail =
      payload?.errors?.map((error) => error.detail).filter(Boolean).join(", ") ||
      "Failed to create Lemon Squeezy checkout";
    throw new Error(detail);
  }

  return payload?.data?.attributes?.url || null;
};
