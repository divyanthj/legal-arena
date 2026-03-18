"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import apiClient from "@/libs/api";

const ALL_FILTER_OPTION = "all";

const emptyManualTemplate = (defaultCategory) => ({
  title: "",
  subtitle: "",
  overview: "",
  desiredRelief: "",
  openingStatement: "",
  starterTheory: "",
  practiceArea: "",
  primaryCategory: defaultCategory,
  complexity: 2,
  courtName: "",
  plaintiffName: "",
  defendantName: "",
  legalTags: "",
  authoringNotes: "",
  canonicalFacts: JSON.stringify(
    [
      {
        factId: "fact-1",
        label: "Key event",
        kind: "timeline",
        truthStatus: "verified",
        canonicalDetail: "Describe what actually happened.",
        discoverability: {
          keywords: ["date", "event"],
          phase: "interview",
          priority: 3,
        },
        evidenceRefs: ["evidence-1"],
        claims: [
          {
            party: "plaintiff",
            claimedDetail: "Client version of this fact.",
            stance: "admits",
            confidence: 0.9,
            accessLevel: "direct",
            deceptionProfile: "straightforward",
            keywords: ["date", "event"],
          },
          {
            party: "defendant",
            claimedDetail: "Opponent version of this fact.",
            stance: "distorts",
            confidence: 0.7,
            accessLevel: "partial",
            deceptionProfile: "self-serving reframing",
            keywords: ["date", "event"],
          },
        ],
      },
    ],
    null,
    2
  ),
  evidenceItems: JSON.stringify(
    [
      {
        id: "evidence-1",
        label: "Key document",
        detail: "Describe the document, message, photo, or witness.",
        type: "document",
        linkedFactIds: ["fact-1"],
      },
    ],
    null,
    2
  ),
});

const splitCsv = (value) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const formatTemplateForForm = (template) => ({
  id: template.id || "",
  title: template.title || "",
  subtitle: template.subtitle || "",
  overview: template.overview || "",
  desiredRelief: template.desiredRelief || "",
  openingStatement: template.openingStatement || "",
  starterTheory: template.starterTheory || "",
  practiceArea: template.practiceArea || "",
  primaryCategory: template.primaryCategory || "contract-violation",
  complexity: template.complexity || 2,
  courtName: template.courtName || "",
  plaintiffName: template.plaintiffName || template.clientName || "",
  defendantName: template.defendantName || template.opponentName || "",
  legalTags: (template.legalTags || []).join(", "),
  authoringNotes: template.authoringNotes || "",
  canonicalFacts: JSON.stringify(template.canonicalFacts || [], null, 2),
  evidenceItems: JSON.stringify(template.evidenceItems || [], null, 2),
});

const SORTABLE_COLUMNS = {
  title: {
    label: "Title",
    getValue: (template) => template.title || "",
  },
  category: {
    label: "Category",
    getValue: (template, categoryMap) =>
      categoryMap.get(template.primaryCategory) || template.primaryCategory || "",
  },
  complexity: {
    label: "Complexity",
    getValue: (template) => Number(template.complexity) || 0,
  },
  plays: {
    label: "Plays",
    getValue: (template) => Number(template.plays) || 0,
  },
  wld: {
    label: "W/L/D",
    getValue: (template) =>
      `${template.wins || 0}-${template.losses || 0}-${template.draws || 0}`,
    compare: (left, right) => {
      const leftValues = [left.wins || 0, left.losses || 0, left.draws || 0];
      const rightValues = [right.wins || 0, right.losses || 0, right.draws || 0];

      for (let index = 0; index < leftValues.length; index += 1) {
        if (leftValues[index] !== rightValues[index]) {
          return leftValues[index] - rightValues[index];
        }
      }

      return 0;
    },
  },
};

export default function AdminCaseLab({
  categories,
  initialTemplates,
  adminEmails,
}) {
  const defaultCategory = categories[0]?.slug || "contract-violation";
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.slug, category.title])),
    [categories]
  );
  const [templates, setTemplates] = useState(initialTemplates);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [sortConfig, setSortConfig] = useState({
    column: "title",
    direction: "asc",
  });
  const [inventoryFilters, setInventoryFilters] = useState({
    category: ALL_FILTER_OPTION,
    complexity: ALL_FILTER_OPTION,
  });
  const [manualForm, setManualForm] = useState(emptyManualTemplate(defaultCategory));
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [generatorForm, setGeneratorForm] = useState({
    primaryCategory: defaultCategory,
    complexity: 1,
    prompt: "",
    batchCount: 1,
  });
  const [working, setWorking] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState("");
  const [generationProgress, setGenerationProgress] = useState({
    total: 0,
    completed: 0,
    successes: 0,
    failures: 0,
    activeIndex: 0,
    currentStep: "",
    items: [],
  });

  const complexityOptions = useMemo(
    () =>
      [...new Set(templates.map((template) => Number(template.complexity) || 0).filter(Boolean))]
        .sort((left, right) => left - right),
    [templates]
  );

  const filteredTemplates = useMemo(
    () =>
      templates.filter((template) => {
        if (
          inventoryFilters.category !== ALL_FILTER_OPTION &&
          template.primaryCategory !== inventoryFilters.category
        ) {
          return false;
        }

        if (
          inventoryFilters.complexity !== ALL_FILTER_OPTION &&
          Number(template.complexity) !== Number(inventoryFilters.complexity)
        ) {
          return false;
        }

        return true;
      }),
    [inventoryFilters, templates]
  );

  const sortedTemplates = useMemo(() => {
    const nextTemplates = [...filteredTemplates];
    const activeColumn = SORTABLE_COLUMNS[sortConfig.column] || SORTABLE_COLUMNS.title;
    const direction = sortConfig.direction === "desc" ? -1 : 1;

    nextTemplates.sort((left, right) => {
      const customCompare = activeColumn.compare?.(left, right, categoryMap);
      if (typeof customCompare === "number" && customCompare !== 0) {
        return customCompare * direction;
      }

      const leftValue = activeColumn.getValue(left, categoryMap);
      const rightValue = activeColumn.getValue(right, categoryMap);

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return (leftValue - rightValue) * direction;
      }

      return String(leftValue).localeCompare(String(rightValue)) * direction;
    });

    return nextTemplates;
  }, [categoryMap, filteredTemplates, sortConfig]);

  const hasActiveInventoryFilters =
    inventoryFilters.category !== ALL_FILTER_OPTION ||
    inventoryFilters.complexity !== ALL_FILTER_OPTION;

  const handleSort = (column) => {
    setSortConfig((current) => ({
      column,
      direction:
        current.column === column && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleSelectTemplate = (template) => {
    setSelectedTemplateId(template.id);
    setEditingTemplateId(template.id);
    setManualForm(formatTemplateForForm(template));
  };

  const handleDeleteTemplate = async (event, template) => {
    event.stopPropagation();

    const confirmed = window.confirm(
      `Delete "${template.title}"? This will also remove any case sessions created from it.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingTemplateId(template.id);

    try {
      await apiClient.delete("/admin/case-templates", {
        data: { id: template.id },
      });

      setTemplates((current) => current.filter((item) => item.id !== template.id));

      if (selectedTemplateId === template.id) {
        setSelectedTemplateId("");
      }

      if (editingTemplateId === template.id) {
        setEditingTemplateId("");
        setManualForm(emptyManualTemplate(defaultCategory));
      }
    } finally {
      setDeletingTemplateId("");
    }
  };

  const handleManualCreate = async (event) => {
    event.preventDefault();
    setWorking(true);

    try {
      const payload = {
        ...manualForm,
        complexity: Number(manualForm.complexity),
        secondaryCategories: [],
        legalTags: splitCsv(manualForm.legalTags),
        canonicalFacts: JSON.parse(manualForm.canonicalFacts),
        evidenceItems: JSON.parse(manualForm.evidenceItems),
      };

      const { template } = editingTemplateId
        ? await apiClient.patch("/admin/case-templates", {
            ...payload,
            id: editingTemplateId,
          })
        : await apiClient.post("/admin/case-templates", payload);

      setTemplates((current) =>
        editingTemplateId
          ? current.map((item) => (item.id === template.id ? template : item))
          : [template, ...current]
      );
      setManualForm(emptyManualTemplate(defaultCategory));
      setEditingTemplateId("");
      setSelectedTemplateId("");
    } finally {
      setWorking(false);
    }
  };

  const handleGenerate = async (event) => {
    event.preventDefault();
    const total = Math.max(1, Number(generatorForm.batchCount) || 1);

    setGenerationProgress({
      total,
      completed: 0,
      successes: 0,
      failures: 0,
      activeIndex: 1,
      currentStep: total > 1 ? "Starting batch run" : "Starting generation",
      items: Array.from({ length: total }, (_, index) => ({
        index: index + 1,
        title: "",
        status: "queued",
        message: "Waiting to start",
      })),
    });
    setWorking(true);

    try {
      let latestTemplateId = "";
      let successCount = 0;
      let failureCount = 0;

      for (let index = 0; index < total; index += 1) {
        const caseNumber = index + 1;

        setGenerationProgress((current) => ({
          ...current,
          activeIndex: caseNumber,
          currentStep: `Generating case ${caseNumber} of ${total}`,
          items: current.items.map((item) =>
            item.index === caseNumber
              ? {
                  ...item,
                  status: "running",
                  message:
                    "Calling the generator. This will create the base case, refine the interview plan, then save it.",
                }
              : item
          ),
        }));

        try {
          const { template } = await apiClient.post("/admin/case-templates/generate", {
            primaryCategory: generatorForm.primaryCategory,
            complexity: Number(generatorForm.complexity),
            prompt: generatorForm.prompt,
          });

          latestTemplateId = template.id;
          successCount += 1;
          setTemplates((current) => [template, ...current]);
          setSelectedTemplateId(template.id);

          setGenerationProgress((current) => ({
            ...current,
            completed: caseNumber,
            successes: successCount,
            failures: failureCount,
            currentStep:
              caseNumber < total
                ? `Saved "${template.title}". Preparing the next case.`
                : `Saved "${template.title}". Batch complete.`,
            items: current.items.map((item) =>
              item.index === caseNumber
                ? {
                    ...item,
                    title: template.title,
                    status: "completed",
                    message: "Saved to the library and available immediately.",
                  }
                : item
            ),
          }));
        } catch (error) {
          failureCount += 1;
          setGenerationProgress((current) => ({
            ...current,
            completed: caseNumber,
            successes: successCount,
            failures: failureCount,
            currentStep:
              caseNumber < total
                ? `Case ${caseNumber} failed. Continuing with the next case.`
                : "Batch finished with errors.",
            items: current.items.map((item) =>
              item.index === caseNumber
                ? {
                    ...item,
                    status: "failed",
                    message: error.message || "Generation failed.",
                  }
                : item
            ),
          }));
        }
      }

      if (latestTemplateId) {
        setSelectedTemplateId(latestTemplateId);
      }

      setGeneratorForm({
        primaryCategory: defaultCategory,
        complexity: 1,
        prompt: "",
        batchCount: 1,
      });

      if (failureCount === 0) {
        toast.success(
          successCount === 1
            ? "1 case template generated."
            : `${successCount} case templates generated.`
        );
      } else {
        toast.success(
          `${successCount} generated, ${failureCount} failed. Review the run log for details.`
        );
      }
    } finally {
      setWorking(false);
    }
  };

  return (
    <main className="min-h-screen bg-base-200 px-4 py-6 md:px-8 md:py-10">
      <section className="mx-auto max-w-7xl space-y-6">
        <div className="card border border-base-300 bg-neutral text-neutral-content shadow-2xl">
          <div className="card-body p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-primary-content/75">
                  Admin
                </p>
                <h1 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">
                  Case Authoring Lab
                </h1>
                <p className="mt-3 max-w-3xl text-neutral-content/75">
                  Manage reusable case templates, create them manually, or generate
                  new ones for cron/API workflows.
                </p>
                <p className="mt-3 text-sm text-neutral-content/65">
                  Allowed admins: {adminEmails.length ? adminEmails.join(", ") : "none configured"}
                </p>
              </div>
              <Link href="/dashboard" className="btn btn-ghost btn-sm text-neutral-content">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-2">
          <form className="card border border-base-300 bg-base-100 shadow-xl" onSubmit={handleManualCreate}>
            <div className="card-body p-6">
              <p className="text-sm uppercase tracking-[0.25em] text-base-content/50">
                Manual
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                {editingTemplateId ? "Edit case template" : "Create a case template"}
              </h2>
              <div className="mt-5 grid gap-4">
                {[
                  ["title", "Title"],
                  ["subtitle", "Subtitle"],
                  ["overview", "Overview"],
                  ["desiredRelief", "Desired relief"],
                  ["openingStatement", "Opening statement"],
                  ["starterTheory", "Starter theory"],
                  ["practiceArea", "Practice area"],
                  ["courtName", "Court name"],
                  ["plaintiffName", "Plaintiff name"],
                  ["defendantName", "Defendant name"],
                  ["legalTags", "Legal tags (comma separated)"],
                  ["authoringNotes", "Authoring notes"],
                ].map(([key, label]) => (
                  <label key={key} className="form-control">
                    <span className="label-text font-semibold">{label}</span>
                    <textarea
                      className="textarea textarea-bordered"
                      value={manualForm[key]}
                      onChange={(event) =>
                        setManualForm((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                    />
                  </label>
                ))}

                <label className="form-control">
                  <span className="label-text font-semibold">Primary category</span>
                  <select
                    className="select select-bordered"
                    value={manualForm.primaryCategory}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        primaryCategory: event.target.value,
                      }))
                    }
                  >
                    {categories.map((category) => (
                      <option key={category.slug} value={category.slug}>
                        {category.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-control">
                  <span className="label-text font-semibold">Complexity</span>
                  <input
                    className="input input-bordered"
                    type="number"
                    min="1"
                    max="5"
                    value={manualForm.complexity}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        complexity: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="form-control">
                  <span className="label-text font-semibold">Canonical facts JSON</span>
                  <textarea
                    className="textarea textarea-bordered h-64 font-mono text-xs"
                    value={manualForm.canonicalFacts}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        canonicalFacts: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="form-control">
                  <span className="label-text font-semibold">Evidence items JSON</span>
                  <textarea
                    className="textarea textarea-bordered h-40 font-mono text-xs"
                    value={manualForm.evidenceItems}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        evidenceItems: event.target.value,
                      }))
                    }
                  />
                </label>

                <button className="btn btn-primary" disabled={working}>
                  {working && <span className="loading loading-spinner loading-xs" />}
                  {editingTemplateId ? "Update Template" : "Save Template"}
                </button>
                {editingTemplateId && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setEditingTemplateId("");
                      setSelectedTemplateId("");
                      setManualForm(emptyManualTemplate(defaultCategory));
                    }}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>
          </form>

          <div className="space-y-6">
            <form className="card border border-base-300 bg-base-100 shadow-xl" onSubmit={handleGenerate}>
              <div className="card-body p-6">
                <p className="text-sm uppercase tracking-[0.25em] text-base-content/50">
                  Generator
                </p>
                <h2 className="mt-2 text-2xl font-bold">Generate a new case</h2>
                <div className="mt-5 grid gap-4">
                  <label className="form-control">
                    <span className="label-text font-semibold">Category</span>
                    <select
                      className="select select-bordered"
                      value={generatorForm.primaryCategory}
                      onChange={(event) =>
                        setGeneratorForm((current) => ({
                          ...current,
                          primaryCategory: event.target.value,
                        }))
                      }
                    >
                      {categories.map((category) => (
                        <option key={category.slug} value={category.slug}>
                          {category.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold">Complexity</span>
                    <input
                      className="input input-bordered"
                      type="number"
                      min="1"
                      max="5"
                      value={generatorForm.complexity}
                      onChange={(event) =>
                        setGeneratorForm((current) => ({
                          ...current,
                          complexity: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold">Prompt</span>
                    <textarea
                      className="textarea textarea-bordered h-40"
                      placeholder="Describe the type of dispute, tone, jurisdiction flavor, or special evidence you want."
                      value={generatorForm.prompt}
                      onChange={(event) =>
                        setGeneratorForm((current) => ({
                          ...current,
                          prompt: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold">How many cases</span>
                    <input
                      className="input input-bordered"
                      type="number"
                      min="1"
                      max="25"
                      value={generatorForm.batchCount}
                      onChange={(event) =>
                        setGeneratorForm((current) => ({
                          ...current,
                          batchCount: event.target.value,
                        }))
                      }
                    />
                    <span className="label-text-alt text-base-content/60">
                      Cases are generated one by one so each completed template appears in
                      the library immediately.
                    </span>
                  </label>

                  <button className="btn btn-secondary" disabled={working}>
                    {working && <span className="loading loading-spinner loading-xs" />}
                    {Number(generatorForm.batchCount) > 1
                      ? "Generate Batch"
                      : "Generate Template"}
                  </button>
                </div>
              </div>
            </form>

            {(working || generationProgress.total > 0) && (
              <div className="card border border-base-300 bg-base-100 shadow-xl">
                <div className="card-body p-6">
                  <p className="text-sm uppercase tracking-[0.25em] text-base-content/50">
                    Batch Progress
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">
                    {generationProgress.completed >= generationProgress.total &&
                    generationProgress.total > 0
                      ? "Latest generation run"
                      : "Generation in progress"}
                  </h2>
                  <p className="mt-3 text-sm text-base-content/70">
                    {generationProgress.currentStep ||
                      "Waiting for the next generation run."}
                  </p>
                  <progress
                    className="progress progress-secondary mt-4 w-full"
                    value={generationProgress.completed}
                    max={Math.max(generationProgress.total, 1)}
                  />
                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <div className="rounded-box border border-base-300 bg-base-200 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-base-content/45">
                        Total
                      </p>
                      <p className="mt-1 text-2xl font-bold">{generationProgress.total}</p>
                    </div>
                    <div className="rounded-box border border-base-300 bg-base-200 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-base-content/45">
                        Completed
                      </p>
                      <p className="mt-1 text-2xl font-bold">
                        {generationProgress.completed}
                      </p>
                    </div>
                    <div className="rounded-box border border-base-300 bg-base-200 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-base-content/45">
                        Saved
                      </p>
                      <p className="mt-1 text-2xl font-bold text-success">
                        {generationProgress.successes}
                      </p>
                    </div>
                    <div className="rounded-box border border-base-300 bg-base-200 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-base-content/45">
                        Failed
                      </p>
                      <p className="mt-1 text-2xl font-bold text-error">
                        {generationProgress.failures}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    {generationProgress.items.map((item) => (
                      <div
                        key={`generation-progress-${item.index}`}
                        className="rounded-box border border-base-300 bg-base-200/70 p-4"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-sm font-semibold">
                              Case {item.index}
                              {item.title ? `: ${item.title}` : ""}
                            </p>
                            <p className="mt-1 text-sm text-base-content/65">
                              {item.message}
                            </p>
                          </div>
                          <span
                            className={[
                              "badge badge-outline",
                              item.status === "completed"
                                ? "badge-success"
                                : item.status === "failed"
                                  ? "badge-error"
                                  : item.status === "running"
                                    ? "badge-secondary"
                                    : "badge-ghost",
                            ].join(" ")}
                          >
                            {item.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="card border border-base-300 bg-base-100 shadow-xl">
              <div className="card-body p-6">
                <p className="text-sm uppercase tracking-[0.25em] text-base-content/50">
                  Existing Templates
                </p>
                <h2 className="mt-2 text-2xl font-bold">Library</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-base-content/65">
                  <p>
                    {hasActiveInventoryFilters
                      ? `${sortedTemplates.length} / ${templates.length} cases shown`
                      : `${templates.length} total cases in the library`}
                  </p>
                  {hasActiveInventoryFilters && (
                    <span className="badge badge-outline">
                      Filtered total: {sortedTemplates.length}
                    </span>
                  )}
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                  <label className="form-control">
                    <span className="label-text font-semibold">Filter by category</span>
                    <select
                      className="select select-bordered"
                      value={inventoryFilters.category}
                      onChange={(event) =>
                        setInventoryFilters((current) => ({
                          ...current,
                          category: event.target.value,
                        }))
                      }
                    >
                      <option value={ALL_FILTER_OPTION}>All categories</option>
                      {categories.map((category) => (
                        <option key={category.slug} value={category.slug}>
                          {category.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold">Filter by complexity</span>
                    <select
                      className="select select-bordered"
                      value={inventoryFilters.complexity}
                      onChange={(event) =>
                        setInventoryFilters((current) => ({
                          ...current,
                          complexity: event.target.value,
                        }))
                      }
                    >
                      <option value={ALL_FILTER_OPTION}>All levels</option>
                      {complexityOptions.map((complexity) => (
                        <option key={complexity} value={complexity}>
                          Complexity {complexity}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex items-end">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={!hasActiveInventoryFilters}
                      onClick={() =>
                        setInventoryFilters({
                          category: ALL_FILTER_OPTION,
                          complexity: ALL_FILTER_OPTION,
                        })
                      }
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>
                <div className="mt-5 overflow-x-auto rounded-box border border-base-300">
                  <table className="table table-zebra">
                    <thead>
                      <tr>
                        {Object.entries(SORTABLE_COLUMNS).map(([key, column]) => {
                          const isActive = sortConfig.column === key;
                          const directionLabel =
                            isActive && sortConfig.direction === "asc" ? "^" : "v";

                          return (
                            <th key={key}>
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs px-0 normal-case"
                                onClick={() => handleSort(key)}
                              >
                                {column.label} {isActive ? directionLabel : ""}
                              </button>
                            </th>
                          );
                        })}
                        <th className="text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTemplates.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-8 text-center text-sm text-base-content/60">
                            No case templates match the current filters.
                          </td>
                        </tr>
                      ) : (
                        sortedTemplates.map((template) => (
                          <tr
                            key={`stats-${template.id}`}
                            className={selectedTemplateId === template.id ? "active" : "cursor-pointer"}
                            onClick={() => handleSelectTemplate(template)}
                          >
                            <td className="font-semibold">{template.title}</td>
                            <td>{categoryMap.get(template.primaryCategory) || template.primaryCategory}</td>
                            <td>{template.complexity}</td>
                            <td>{template.plays || 0}</td>
                            <td>
                              {template.wins || 0}/{template.losses || 0}/{template.draws || 0}
                            </td>
                            <td className="text-right">
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs text-error"
                                disabled={deletingTemplateId === template.id}
                                onClick={(event) => handleDeleteTemplate(event, template)}
                              >
                                {deletingTemplateId === template.id ? "Deleting..." : "Delete"}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-sm text-base-content/60">
                  Select a row to load that case into the editor.
                </p>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
