export const LEGAL_CASE_CATEGORIES = [
  {
    slug: "rental-dispute",
    title: "Rental Dispute",
    description: "Landlord-tenant conflicts over deposits, habitability, notice, or eviction.",
  },
  {
    slug: "marital-dispute",
    title: "Marital Dispute",
    description: "Family and relationship disputes involving separation, support, or shared obligations.",
  },
  {
    slug: "business-dispute",
    title: "Business Dispute",
    description: "Commercial disagreements between businesses, founders, partners, or vendors.",
  },
  {
    slug: "contract-violation",
    title: "Contract Violation",
    description: "Breaches of written or oral agreements over payment, delivery, or performance.",
  },
  {
    slug: "employment",
    title: "Employment",
    description: "Workplace disputes involving pay, discipline, termination, or policy compliance.",
  },
  {
    slug: "property",
    title: "Property",
    description: "Disputes over possession, towing, damage, boundaries, or use of property.",
  },
  {
    slug: "personal-injury",
    title: "Personal Injury",
    description: "Claims involving physical harm, negligence, or unsafe conditions.",
  },
  {
    slug: "consumer",
    title: "Consumer",
    description: "Disputes over purchases, services, unfair fees, or deceptive conduct.",
  },
  {
    slug: "criminal",
    title: "Criminal",
    description: "Criminal-law matters involving charges, procedure, and defense theory.",
  },
  {
    slug: "administrative",
    title: "Administrative",
    description: "Agency, licensing, and regulatory disputes or appeals.",
  },
];

export const DEFAULT_CATEGORY_SLUG = "contract-violation";

export const getCategoryBySlug = (slug) =>
  LEGAL_CASE_CATEGORIES.find((category) => category.slug === slug) || null;

export const isValidCategorySlug = (slug) =>
  LEGAL_CASE_CATEGORIES.some((category) => category.slug === slug);

export const getCategoryTitle = (slug) =>
  getCategoryBySlug(slug)?.title || "General";

