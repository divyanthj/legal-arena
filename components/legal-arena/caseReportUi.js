export const getCaseReportProgressLabel = (report = {}) => {
  if (report.status === "published") return "Published and available on the blog.";
  if (report.status === "awaiting_consent") return "Waiting for the other lawyer's consent.";
  if (report.status === "failed") return "Generation stopped before anything was published.";
  return {
    preparing: "Preparing the case record for the report…",
    writing: "Writing and structuring the case report…",
    generating_image: "Generating the editorial courtroom image…",
    storing_image: "Saving the image and publishing the report…",
    published: "Published and available on the blog.",
  }[report.generationStage] || (report.status === "generating" ? "Starting report generation…" : "");
};
