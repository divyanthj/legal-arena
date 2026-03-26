import {
  createCheckout,
  lemonSqueezySetup,
} from "@lemonsqueezy/lemonsqueezy.js";

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();
const normalizeString = (value = "") => String(value || "").trim();

const getApiKey = () => {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("LEMONSQUEEZY_API_KEY is required");
  }

  return apiKey;
};

export const appendLemonSqueezyPrefillParams = (checkoutUrl, data = {}) => {
  const url = new URL(checkoutUrl);
  const normalizedEmail = normalizeEmail(data.email);
  const normalizedName = normalizeString(data.name);
  const normalizedUserId = normalizeString(data.userId);

  if (normalizedEmail) {
    url.searchParams.set("checkout[email]", normalizedEmail);
  }

  if (normalizedName) {
    url.searchParams.set("checkout[name]", normalizedName);
  }

  if (normalizedUserId) {
    url.searchParams.set("checkout[custom][userId]", normalizedUserId);
  }

  return url.toString();
};

export const buildLemonSqueezyCheckoutPayload = ({
  redirectUrl,
  email,
  name,
  userId,
}) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = normalizeString(name);
  const normalizedUserId = normalizeString(userId);

  if (!normalizedEmail) {
    throw new Error("A signed-in email address is required for checkout");
  }

  const checkoutData = {
    email: normalizedEmail,
  };

  if (normalizedName) {
    checkoutData.name = normalizedName;
  }

  if (normalizedUserId) {
    checkoutData.custom = {
      userId: normalizedUserId,
    };
  }

  return {
    productOptions: {
      redirectUrl,
    },
    checkoutData,
  };
};

export const createLemonSqueezyCheckout = async ({
  variantId,
  redirectUrl,
  email,
  name,
  userId,
}) => {
  if (!variantId) {
    throw new Error("Lemon Squeezy variant ID is required");
  }

  const storeId = process.env.LEMONSQUEEZY_STORE_ID?.trim();

  if (!storeId) {
    throw new Error("LEMONSQUEEZY_STORE_ID is required");
  }

  lemonSqueezySetup({ apiKey: getApiKey() });

  const checkoutPayload = buildLemonSqueezyCheckoutPayload({
    redirectUrl,
    email,
    name,
    userId,
  });

  const { data, error } = await createCheckout(
    String(storeId),
    String(variantId),
    checkoutPayload
  );

  if (error) {
    const detail =
      error?.error?.message ||
      error?.message ||
      "Failed to create Lemon Squeezy checkout";
    throw new Error(detail);
  }

  const checkoutUrl = data?.data?.attributes?.url || null;

  if (!checkoutUrl) {
    return null;
  }

  return appendLemonSqueezyPrefillParams(checkoutUrl, {
    email,
    name,
    userId,
  });
};
