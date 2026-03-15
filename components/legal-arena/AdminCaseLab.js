"use client";

import { useState } from "react";
import Link from "next/link";
import apiClient from "@/libs/api";

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
  clientName: "",
  opponentName: "",
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
            party: "client",
            claimedDetail: "Client version of this fact.",
            stance: "admits",
            confidence: 0.9,
            accessLevel: "direct",
            deceptionProfile: "straightforward",
            keywords: ["date", "event"],
          },
          {
            party: "opponent",
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
  clientName: template.clientName || "",
  opponentName: template.opponentName || "",
  legalTags: (template.legalTags || []).join(", "),
  authoringNotes: template.authoringNotes || "",
  canonicalFacts: JSON.stringify(template.canonicalFacts || [], null, 2),
  evidenceItems: JSON.stringify(template.evidenceItems || [], null, 2),
});

export default function AdminCaseLab({
  categories,
  initialTemplates,
  adminEmails,
}) {
  const defaultCategory = categories[0]?.slug || "contract-violation";
  const [templates, setTemplates] = useState(initialTemplates);
  const [manualForm, setManualForm] = useState(emptyManualTemplate(defaultCategory));
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [generatorForm, setGeneratorForm] = useState({
    primaryCategory: defaultCategory,
    complexity: 2,
    prompt: "",
  });
  const [working, setWorking] = useState(false);

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
    } finally {
      setWorking(false);
    }
  };

  const handleGenerate = async (event) => {
    event.preventDefault();
    setWorking(true);

    try {
      const { template } = await apiClient.post("/admin/case-templates/generate", {
        ...generatorForm,
        complexity: Number(generatorForm.complexity),
      });
      setTemplates((current) => [template, ...current]);
      setGeneratorForm({
        primaryCategory: defaultCategory,
        complexity: 2,
        prompt: "",
      });
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
                  ["clientName", "Client name"],
                  ["opponentName", "Opponent name"],
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

                  <button className="btn btn-secondary" disabled={working}>
                    {working && <span className="loading loading-spinner loading-xs" />}
                    Generate Template
                  </button>
                </div>
              </div>
            </form>

            <div className="card border border-base-300 bg-base-100 shadow-xl">
              <div className="card-body p-6">
                <p className="text-sm uppercase tracking-[0.25em] text-base-content/50">
                  Existing Templates
                </p>
                <h2 className="mt-2 text-2xl font-bold">Library</h2>
                <div className="mt-5 space-y-3">
                  {templates.map((template) => (
                    <article key={template.id} className="rounded-box bg-base-200 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge badge-outline">{template.primaryCategory}</span>
                        <span className="badge badge-outline">Complexity {template.complexity}</span>
                        <span className="badge badge-outline">{template.sourceType}</span>
                      </div>
                      <h3 className="mt-3 text-lg font-bold">{template.title}</h3>
                      <p className="mt-1 text-sm text-base-content/70">{template.overview}</p>
                      <div className="mt-4">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => {
                            setEditingTemplateId(template.id);
                            setManualForm(formatTemplateForForm(template));
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
