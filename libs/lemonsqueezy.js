import {
  createCheckout,
  getCustomer,
  lemonSqueezySetup,
} from "@lemonsqueezy/lemonsqueezy.js";
import config from "../config.js";

// This is used to create a Lemon Squeezy Checkout for one-time payments.
export const createLemonSqueezyCheckout = async ({
  userId,
  email,
  redirectUrl,
  variantId,
  discountCode,
  datafastVisitorId,
  datafastSessionId,
}) => {
  try {
    lemonSqueezySetup({ apiKey: process.env.LEMONSQUEEZY_API_KEY });

    const storeId = config.lemonsqueezy.storeId || process.env.LEMONSQUEEZY_STORE_ID;
    const resolvedVariantId =
      variantId || config.lemonsqueezy.earlyAccessVariantId;

    if (!storeId || !resolvedVariantId) {
      throw new Error("Missing Lemon Squeezy storeId or variantId");
    }

    const customData = Object.fromEntries(
      Object.entries({
        userId,
        datafast_visitor_id: datafastVisitorId,
        datafast_session_id: datafastSessionId,
      }).filter(([, value]) => value)
    );

    const newCheckout = {
      productOptions: {
        redirectUrl,
      },
      checkoutData: {
        discountCode,
        email,
        custom: customData,
      },
    };

    const { data, error } = await createCheckout(
      storeId,
      resolvedVariantId,
      newCheckout
    );

    if (error) {
      throw error;
    }

    return data.data.attributes.url;
  } catch (e) {
    console.error(e);
    return null;
  }
};

// This is used to create Customer Portal sessions, so users can manage billing.
export const createCustomerPortal = async ({ customerId }) => {
  try {
    lemonSqueezySetup({ apiKey: process.env.LEMONSQUEEZY_API_KEY });

    const { data, error } = await getCustomer(customerId);

    if (error) {
      throw error;
    }

    return data.data.attributes.urls.customer_portal;
  } catch (error) {
    console.error(error);
    return null;
  }
};
