export const INDEPENDENCE_DAY_PROMO = {
  code: "4THJULY",
  discountPercent: 30,
  endsAt: "2026-07-07T23:59:00.000Z",
};

export const isIndependenceDayPromoActive = (now = new Date()) => {
  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const endsAtTime = new Date(INDEPENDENCE_DAY_PROMO.endsAt).getTime();

  return Number.isFinite(currentTime) && currentTime < endsAtTime;
};

export const getActiveIndependenceDayDiscountCode = (now = new Date()) =>
  isIndependenceDayPromoActive(now) ? INDEPENDENCE_DAY_PROMO.code : null;

export const getDiscountedPrice = (price) => {
  const discounted = price * (1 - INDEPENDENCE_DAY_PROMO.discountPercent / 100);

  return Math.round(discounted * 100) / 100;
};
