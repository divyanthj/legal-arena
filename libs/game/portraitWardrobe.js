const everydayWardrobes = [
  "a soft fine-knit crewneck sweater in muted sage with a simple undershirt",
  "a warm rust cardigan over a cream cotton top",
  "a pale blue Oxford shirt with the sleeves naturally rolled once",
  "a forest-green knit polo with understated texture",
  "a burgundy patterned woven shirt or blouse with a small-scale print",
  "a sand-colored linen shirt with a relaxed open collar",
  "a navy mock-neck knit top with clean, minimal styling",
  "a charcoal non-denim overshirt over a light neutral T-shirt",
  "a soft plum pullover with a subtle ribbed texture",
  "a tan cotton chore jacket over an off-white shirt",
  "a teal wrap-style top or collared shirt in matte fabric",
  "a lightweight oatmeal quarter-zip knit over a plain shirt",
];

const organizationWardrobes = [
  "a charcoal suit with a pale blue dress shirt and restrained accessories",
  "a navy blazer over an open-collar ivory shirt",
  "a taupe blazer with a deep green blouse or dress shirt",
  "a dark olive business jacket over a warm white shirt",
  "a subtle pinstripe waistcoat and crisp light shirt",
  "a burgundy blazer over a soft gray business-casual top",
  "a medium-gray suit with a muted patterned shirt and no visible branding",
  "a camel blazer over a navy blouse or open-collar shirt",
];

const counselWardrobes = [
  "a tailored charcoal suit jacket with a crisp white shirt and understated tie or neckwear",
  "a deep navy suit with a pale blue shirt and restrained professional accessories",
  "a dark brown suit jacket with an ivory shirt and muted burgundy accent",
  "a medium-gray suit with a soft lavender or blue shirt",
  "a black tailored blazer with a warm white formal top and minimal accessories",
  "a dark olive tailored suit with a cream shirt and conservative styling",
];

const stableWardrobeIndex = (seed, length) => {
  const text = String(seed || "portrait");
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) % length;
};

export const buildPortraitWardrobeGuidance = ({ seed, role = "everyday" } = {}) => {
  const wardrobes =
    role === "counsel"
      ? counselWardrobes
      : role === "organization"
        ? organizationWardrobes
        : everydayWardrobes;
  const wardrobe = wardrobes[stableWardrobeIndex(`${role}:${seed}`, wardrobes.length)];

  return `Wardrobe assignment for this specific portrait: ${wardrobe}. Make that assigned outfit clearly visible across the shoulders and upper torso. Follow the assignment instead of choosing a generic outfit. Do not use denim, chambray, a jean jacket, or a blue workwear jacket, and do not substitute one for the assigned garment.`;
};

export const PORTRAIT_WARDROBE_VARIETY_COUNTS = Object.freeze({
  everyday: everydayWardrobes.length,
  organization: organizationWardrobes.length,
  counsel: counselWardrobes.length,
});
