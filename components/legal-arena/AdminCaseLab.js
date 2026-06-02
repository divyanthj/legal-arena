"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import apiClient from "@/libs/api";

import {
  ALL_FILTER_OPTION,
  emptyManualTemplate,
  splitCsv,
  GENERATION_STAGES,
  parseSseEventBlocks,
  formatTemplateForForm,
  SORTABLE_COLUMNS,
  formatCompletionTimeIst,
} from "./adminCaseLabUtils";

const adminTabs = [
  { id: "case-authoring", label: "Case Authoring" },
  { id: "email-updates", label: "Email Updates" },
  { id: "retention", label: "Retention Ops" },
  { id: "system", label: "System" },
];

const arenaInputClass = "input arena-field min-h-12 w-full text-slate-100";
const arenaTextareaClass = "textarea arena-textarea arena-field w-full text-slate-100";
const arenaSelectClass = "arena-select select min-h-12 w-full text-slate-100";
const arenaToggleClass =
  "checkbox checkbox-warning checkbox-md";
const retentionNudgeLabels = {
  resume_interview: "Resume intake reminders",
  resume_courtroom: "Resume courtroom reminders",
  post_verdict_next_case: "Post-verdict next case nudges",
  cooldown_return: "Cooldown return reminders",
  new_unlock: "New unlock emails",
  leaderboard_milestone: "Leaderboard milestone updates",
  new_content_relevant: "Relevant new matter alerts",
  dormant_winback: "Dormant winback emails",
};
const retentionThresholdLabels = {
  resumeInterviewIdleHours: "Resume intake after idle hours",
  resumeInterviewWindowHours: "Only consider intakes created within hours",
  resumeCourtroomIdleHours: "Resume courtroom after idle hours",
  resumeCourtroomWindowHours: "Only consider court rounds within hours",
  postVerdictDelayHours: "Send post-verdict delay after hours",
  postVerdictWindowDays: "Ignore verdicts older than days",
  cooldownReturnHours: "Exited case cooldown return after hours",
  dormantWinbackDays: "Dormant winback after days inactive",
  newContentWindowDays: "Relevant new matter freshness window in days",
};

const defaultFreeGameplayCampaign = {
  enabled: false,
  startsAt: "",
  endsAt: "",
  announcementEnabled: false,
  announcementTitle: "Free solo cases are open",
  announcementBody:
    "Start any solo case and play through your first verdict while this campaign is live.",
  announcementCtaLabel: "Play Free Case",
  announcementCtaHref: "/dashboard",
};
const FREE_GAMEPLAY_START_NOW_DEFAULT_DAYS = 7;

const toDatetimeLocal = (value = "") => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const fromDatetimeLocal = (value = "") => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const getValidFutureCampaignEnd = (currentEnd = "", now = new Date()) => {
  const endDate = currentEnd ? new Date(currentEnd) : null;

  if (endDate && !Number.isNaN(endDate.getTime()) && endDate > now) {
    return endDate.toISOString();
  }

  return new Date(
    now.getTime() + FREE_GAMEPLAY_START_NOW_DEFAULT_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
};

const getCampaignStatusLabel = (campaign = {}) => {
  if (!campaign.enabled) {
    return { label: "Inactive", body: "Free solo gameplay is closed.", tone: "text-white/56" };
  }

  const startsAt = campaign.startsAt ? new Date(campaign.startsAt) : null;
  const endsAt = campaign.endsAt ? new Date(campaign.endsAt) : null;
  const now = new Date();

  if (
    !startsAt ||
    !endsAt ||
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    startsAt >= endsAt
  ) {
    return { label: "Invalid Window", body: "Add a valid start and end date.", tone: "text-amber-300" };
  }

  if (now < startsAt) {
    return {
      label: "Scheduled",
      body: `Opens ${startsAt.toLocaleString()}.`,
      tone: "text-sky-300",
    };
  }

  if (now > endsAt) {
    return {
      label: "Expired",
      body: `Closed ${endsAt.toLocaleString()}.`,
      tone: "text-white/56",
    };
  }

  return {
    label: "Active",
    body: `Open until ${endsAt.toLocaleString()}.`,
    tone: "text-emerald-300",
  };
};

export default function AdminCaseLab({
  categories,
  initialTemplates,
  adminEmails,
  adminStats = {},
  initialFreeAccessGrants = [],
}) {
  const defaultCategory = categories[0]?.slug || "contract-violation";
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.slug, category.title])),
    [categories]
  );
  const [activeTab, setActiveTab] = useState("case-authoring");
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
    purgePreviousWork: false,
  });
  const [emailForm, setEmailForm] = useState({
    audience: "all",
    userId: "",
    subject: "",
    content: "",
    type: "announcement",
  });
  const [working, setWorking] = useState(false);
  const [emailWorking, setEmailWorking] = useState(false);
  const [accessWorking, setAccessWorking] = useState(false);
  const [revokingAccessEmail, setRevokingAccessEmail] = useState("");
  const [opsLoading, setOpsLoading] = useState(true);
  const [opsSaving, setOpsSaving] = useState(false);
  const [retentionRunWorking, setRetentionRunWorking] = useState(false);
  const [digestWorking, setDigestWorking] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState("");
  const [retentionConfig, setRetentionConfig] = useState(null);
  const [digestConfig, setDigestConfig] = useState(null);
  const [freeGameplayCampaign, setFreeGameplayCampaign] = useState(
    defaultFreeGameplayCampaign
  );
  const [retentionRunForm, setRetentionRunForm] = useState({
    dryRun: true,
    limit: 50,
    ignoreAutomationState: false,
  });
  const [retentionSummary, setRetentionSummary] = useState(null);
  const [recentNudges, setRecentNudges] = useState([]);
  const [digestForm, setDigestForm] = useState({
    audience: "all_users",
    subject: "",
    content: "",
    footerNote: "",
  });
  const [accessForm, setAccessForm] = useState({
    email: "",
  });
  const [freeAccessGrants, setFreeAccessGrants] = useState(initialFreeAccessGrants);
  const [generationProgress, setGenerationProgress] = useState({
    total: 0,
    completed: 0,
    successes: 0,
    failures: 0,
    activeIndex: 0,
    currentStep: "",
    currentStageIndex: -1,
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
  const freeGameplayCampaignStatus =
    getCampaignStatusLabel(freeGameplayCampaign);

  useEffect(() => {
    let cancelled = false;

    const loadOpsConfig = async () => {
      try {
        const result = await apiClient.get("/admin/ops-config");

        if (cancelled) {
          return;
        }

        setRetentionConfig(result.config?.retention || null);
        setDigestConfig(result.config?.digest || null);
        setFreeGameplayCampaign({
          ...defaultFreeGameplayCampaign,
          ...(result.config?.freeGameplayCampaign || {}),
        });
        setRecentNudges(result.recentNudges || []);
        setRetentionRunForm((current) => ({
          ...current,
          dryRun: result.config?.retention?.runDefaults?.dryRun ?? true,
          limit: result.config?.retention?.runDefaults?.limit ?? 50,
        }));
        setDigestForm((current) => ({
          ...current,
          audience: result.config?.digest?.defaultAudience || "all_users",
          subject: result.config?.digest?.defaultSubject || "",
          content: result.config?.digest?.defaultContent || "",
          footerNote: result.config?.digest?.footerNote || "",
        }));
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error?.response?.data?.error ||
              error?.message ||
              "Failed to load retention configuration."
          );
        }
      } finally {
        if (!cancelled) {
          setOpsLoading(false);
        }
      }
    };

    loadOpsConfig();

    return () => {
      cancelled = true;
    };
  }, []);

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
      toast.success(editingTemplateId ? "Template updated." : "Template created.");
    } catch (error) {
      toast.error(error?.message || "Failed to save template.");
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
      currentStageIndex: 0,
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
          currentStageIndex: -1,
          currentStep: `Starting case ${caseNumber} of ${total}`,
          items: current.items.map((item) =>
            item.index === caseNumber
              ? {
                  ...item,
                  status: "running",
                  message: "Waiting for live generator updates from the server.",
                }
              : item
          ),
        }));

        try {
          const response = await fetch("/api/admin/case-templates/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              primaryCategory: generatorForm.primaryCategory,
              complexity: Number(generatorForm.complexity),
              prompt: generatorForm.prompt,
              purgePreviousWork: Boolean(generatorForm.purgePreviousWork),
              stream: true,
            }),
          });

          if (!response.ok || !response.body) {
            let errorMessage = "Generation failed.";

            try {
              const errorPayload = await response.json();
              errorMessage = errorPayload?.error || errorMessage;
            } catch (_error) {
              // Ignore malformed error payloads and fall back to the generic message.
            }

            throw new Error(errorMessage);
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let template = null;
          let artifactId = "";
          let streamError = "";
          let streamDone = false;

          while (!streamDone) {
            const { value, done } = await reader.read();

            if (done) {
              streamDone = true;
              continue;
            }

            buffer += decoder.decode(value, { stream: true });
            buffer = parseSseEventBlocks(buffer, (eventName, payload) => {
              if (eventName === "stage") {
                const stageLabel = payload.label || payload.stage || "Working";
                const nextStageIndex = GENERATION_STAGES.indexOf(stageLabel);

                setGenerationProgress((current) => ({
                  ...current,
                  activeIndex: caseNumber,
                  currentStageIndex: nextStageIndex,
                  currentStep: `${stageLabel} for case ${caseNumber} of ${total}`,
                  items: current.items.map((item) =>
                    item.index === caseNumber
                      ? {
                          ...item,
                          status: "running",
                          message: stageLabel,
                        }
                      : item
                  ),
                }));
              }

              if (eventName === "complete") {
                template = payload.template;
                artifactId = payload.artifactId || "";
              }

              if (eventName === "error") {
                streamError = payload.error || "Generation failed.";
              }
            });
          }

          if (streamError) {
            throw new Error(streamError);
          }

          if (!template) {
            throw new Error("Generation finished without a template.");
          }

          latestTemplateId = template.id;
          successCount += 1;
          setTemplates((current) => [template, ...current]);
          setSelectedTemplateId(template.id);
          const completedAtIst = formatCompletionTimeIst(new Date());

          setGenerationProgress((current) => ({
            ...current,
            completed: caseNumber,
            successes: successCount,
            failures: failureCount,
            currentStep:
              caseNumber < total
                ? `Saved "${template.title}". Preparing the next case.`
                : `Saved "${template.title}". Batch complete.`,
            currentStageIndex: GENERATION_STAGES.length - 1,
            items: current.items.map((item) =>
              item.index === caseNumber
                ? {
                    ...item,
                    title: template.title,
                    status: "completed",
                    message: artifactId
                      ? `Saved to the library and linked to artifact ${artifactId}. Completed at ${completedAtIst} IST.`
                      : `Saved to the library and available immediately. Completed at ${completedAtIst} IST.`,
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
        purgePreviousWork: false,
      });

      toast.success(
        failureCount === 0
          ? successCount === 1
            ? "1 case template generated."
            : `${successCount} case templates generated.`
          : `${successCount} generated, ${failureCount} failed.`
      );
    } finally {
      setWorking(false);
    }
  };

  const handleSendEmail = async (event) => {
    event.preventDefault();
    setEmailWorking(true);

    try {
      const payload = {
        userId: emailForm.audience === "single" ? emailForm.userId.trim() : "",
        subject: emailForm.subject.trim(),
        content: emailForm.content.trim(),
        type: emailForm.type,
      };

      const result = await apiClient.post("/send-email", payload);
      toast.success(
        result?.totalEmailsSent
          ? `Sent ${result.totalEmailsSent} email${result.totalEmailsSent === 1 ? "" : "s"}.`
          : "Email update sent."
      );
      setEmailForm({
        audience: "all",
        userId: "",
        subject: "",
        content: "",
        type: "announcement",
      });
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message || "Failed to send email.");
    } finally {
      setEmailWorking(false);
    }
  };

  const handleGrantFreeAccess = async (event) => {
    event.preventDefault();
    const email = accessForm.email.trim();

    if (!email) {
      toast.error("Enter an email address.");
      return;
    }

    setAccessWorking(true);

    try {
      const result = await apiClient.post("/admin/access", { email });
      const grant = result.grant;

      if (grant) {
        setFreeAccessGrants((current) => [
          grant,
          ...current.filter((item) => item.email !== grant.email),
        ]);
      }

      setAccessForm({ email: "" });
      if (result.emailSent === false) {
        toast(
          `Free access granted to ${grant?.email || email}, but the email did not send: ${
            result.emailError || "unknown email error"
          }`
        );
      } else {
        toast.success(`Free access granted and emailed ${grant?.email || email}.`);
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message || "Failed to grant access.");
    } finally {
      setAccessWorking(false);
    }
  };

  const handleRevokeFreeAccess = async (grant) => {
    const email = grant?.email?.trim?.();

    if (!email) {
      return;
    }

    const confirmed = window.confirm(`Revoke manually granted free access for ${email}?`);

    if (!confirmed) {
      return;
    }

    setRevokingAccessEmail(email);

    try {
      const result = await apiClient.delete("/admin/access", {
        data: { email },
      });

      setFreeAccessGrants((current) => current.filter((item) => item.email !== email));

      if (result.emailSent === false) {
        toast(
          `Free access revoked for ${email}, but the email did not send: ${
            result.emailError || "unknown email error"
          }`
        );
      } else {
        toast.success(`Free access revoked and emailed ${email}.`);
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message || "Failed to revoke access.");
    } finally {
      setRevokingAccessEmail("");
    }
  };

  const handleSaveOpsConfig = async (event) => {
    event.preventDefault();

    if (!retentionConfig || !digestConfig) {
      return;
    }

    setOpsSaving(true);

    try {
      const result = await apiClient.patch("/admin/ops-config", {
        retention: retentionConfig,
        digest: digestConfig,
        freeGameplayCampaign,
      });

      setRetentionConfig(result.config.retention);
      setDigestConfig(result.config.digest);
      setFreeGameplayCampaign({
        ...defaultFreeGameplayCampaign,
        ...(result.config.freeGameplayCampaign || {}),
      });
      setRetentionRunForm((current) => ({
        ...current,
        dryRun: result.config.retention.runDefaults?.dryRun ?? current.dryRun,
        limit: result.config.retention.runDefaults?.limit ?? current.limit,
      }));
      toast.success("Admin ops configuration saved.");
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          error?.message ||
          "Failed to save retention configuration."
      );
    } finally {
      setOpsSaving(false);
    }
  };

  const startFreeGameplayCampaignImmediately = () => {
    const now = new Date();

    setFreeGameplayCampaign((current) => ({
      ...current,
      enabled: true,
      startsAt: now.toISOString(),
      endsAt: getValidFutureCampaignEnd(current.endsAt, now),
      announcementEnabled: true,
      announcementTitle:
        current.announcementTitle || defaultFreeGameplayCampaign.announcementTitle,
      announcementBody:
        current.announcementBody || defaultFreeGameplayCampaign.announcementBody,
      announcementCtaLabel:
        current.announcementCtaLabel ||
        defaultFreeGameplayCampaign.announcementCtaLabel,
      announcementCtaHref:
        current.announcementCtaHref || defaultFreeGameplayCampaign.announcementCtaHref,
    }));
  };

  const handleRunRetention = async (event) => {
    event.preventDefault();
    setRetentionRunWorking(true);

    try {
      const result = await apiClient.post("/admin/retention-run", {
        dryRun: retentionRunForm.dryRun,
        limit: Number(retentionRunForm.limit) || null,
        ignoreAutomationState: retentionRunForm.ignoreAutomationState,
      });

      setRetentionSummary(result.summary || null);
      toast.success(
        result.summary?.dryRun
          ? `Previewed ${result.summary?.candidates?.length || 0} retention candidates.`
          : `Sent ${result.summary?.sentCount || 0} retention email${
              result.summary?.sentCount === 1 ? "" : "s"
            }.`
      );
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          error?.message ||
          "Failed to run retention ops."
      );
    } finally {
      setRetentionRunWorking(false);
    }
  };

  const handleSendDigest = async (event) => {
    event.preventDefault();
    setDigestWorking(true);

    try {
      const result = await apiClient.post("/admin/news-digest", {
        audience: digestForm.audience,
        subject: digestForm.subject,
        content: digestForm.content,
        footerNote: digestForm.footerNote,
      });

      toast.success(
        result?.totalEmailsSent
          ? `Sent ${result.totalEmailsSent} digest email${
              result.totalEmailsSent === 1 ? "" : "s"
            }.`
          : "Digest sent."
      );
    } catch (error) {
      toast.error(
        error?.response?.data?.error || error?.message || "Failed to send digest."
      );
    } finally {
      setDigestWorking(false);
    }
  };

  const renderCaseAuthoring = () => (
    <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <form className="arena-surface" onSubmit={handleManualCreate}>
        <div className="p-6">
          <p className="arena-kicker">Manual Authoring</p>
          <h2 className="arena-headline mt-2 text-2xl">
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
                <span className="label-text font-semibold text-white">{label}</span>
                <textarea
                  className={arenaTextareaClass}
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
              <span className="label-text font-semibold text-white">Primary category</span>
              <select
                className={arenaSelectClass}
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
              <span className="label-text font-semibold text-white">Complexity</span>
              <input
                className={arenaInputClass}
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
              <span className="label-text font-semibold text-white">Canonical facts JSON</span>
              <textarea
                className={`${arenaTextareaClass} h-64 font-mono text-xs`}
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
              <span className="label-text font-semibold text-white">Evidence items JSON</span>
              <textarea
                className={`${arenaTextareaClass} h-40 font-mono text-xs`}
                value={manualForm.evidenceItems}
                onChange={(event) =>
                  setManualForm((current) => ({
                    ...current,
                    evidenceItems: event.target.value,
                  }))
                }
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button className="arena-btn-light px-5 py-3" disabled={working}>
                {working && <span className="loading loading-spinner loading-xs" />}
                {editingTemplateId ? "Update Template" : "Save Template"}
              </button>
              {editingTemplateId ? (
                <button
                  type="button"
                  className="arena-btn-dark px-5 py-3"
                  onClick={() => {
                    setEditingTemplateId("");
                    setSelectedTemplateId("");
                    setManualForm(emptyManualTemplate(defaultCategory));
                  }}
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </form>

      <div className="space-y-6">
        <form className="arena-surface" onSubmit={handleGenerate}>
          <div className="p-6">
            <p className="arena-kicker">Generator</p>
            <h2 className="arena-headline mt-2 text-2xl">Generate new cases</h2>
            <div className="mt-5 grid gap-4">
              <label className="form-control">
                <span className="label-text font-semibold text-white">Category</span>
                <select
                  className={arenaSelectClass}
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
                <span className="label-text font-semibold text-white">Complexity</span>
                <input
                  className={arenaInputClass}
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
                <span className="label-text font-semibold text-white">Prompt</span>
                <textarea
                  className={`${arenaTextareaClass} h-40`}
                  placeholder="Describe the dispute type, tone, jurisdiction flavor, or special evidence mix you want."
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
                <span className="label-text font-semibold text-white">How many cases</span>
                <input
                  className={arenaInputClass}
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
              </label>

              <label className="arena-surface-soft flex cursor-pointer items-center gap-3 px-4 py-3 text-sm text-white/74">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={Boolean(generatorForm.purgePreviousWork)}
                  onChange={(event) =>
                    setGeneratorForm((current) => ({
                      ...current,
                      purgePreviousWork: event.target.checked,
                    }))
                  }
                />
                <span>Start fresh and purge unfinished matching generation artifacts</span>
              </label>

              <button className="arena-btn-light px-5 py-3" disabled={working}>
                {working && <span className="loading loading-spinner loading-xs" />}
                {Number(generatorForm.batchCount) > 1 ? "Generate Batch" : "Generate Template"}
              </button>
            </div>
          </div>
        </form>

        {(working || generationProgress.total > 0) && (
          <div className="arena-surface">
            <div className="p-6">
              <p className="arena-kicker">Batch Progress</p>
              <h2 className="arena-headline mt-2 text-2xl">
                {generationProgress.completed >= generationProgress.total &&
                generationProgress.total > 0
                  ? "Latest generation run"
                  : "Generation in progress"}
              </h2>
              <p className="mt-3 text-sm text-white/62">
                {generationProgress.currentStep || "Waiting for the next generation run."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {GENERATION_STAGES.map((stage, index) => {
                  const isActive = index === generationProgress.currentStageIndex;
                  const isPassed =
                    generationProgress.currentStageIndex > index &&
                    generationProgress.activeIndex > 0;

                  return (
                    <span
                      key={stage}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                        isActive
                          ? "border-sky-400/40 bg-sky-400/15 text-sky-200"
                          : isPassed
                          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                          : "border-white/10 bg-white/5 text-white/40"
                      }`}
                    >
                      {stage}
                    </span>
                  );
                })}
              </div>
              <progress
                className="progress mt-4 w-full"
                value={generationProgress.completed}
                max={Math.max(generationProgress.total, 1)}
              />
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                {[
                  ["Total", generationProgress.total, "text-white"],
                  ["Completed", generationProgress.completed, "text-white"],
                  ["Saved", generationProgress.successes, "text-emerald-300"],
                  ["Failed", generationProgress.failures, "text-rose-300"],
                ].map(([label, value, color]) => (
                  <div key={label} className="arena-stat-card !p-4">
                    <p className="arena-kicker">{label}</p>
                    <p className={`mt-2 text-2xl font-semibold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-3">
                {generationProgress.items.map((item) => (
                  <div key={`generation-progress-${item.index}`} className="arena-surface-soft p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Case {item.index}
                          {item.title ? `: ${item.title}` : ""}
                        </p>
                        <p className="mt-1 text-sm text-white/62">{item.message}</p>
                      </div>
                      <span className="badge badge-outline text-white/80">{item.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="arena-surface">
          <div className="p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="arena-kicker">Existing Templates</p>
                <h2 className="arena-headline mt-2 text-2xl">Library</h2>
              </div>
              <p className="text-sm text-white/42">
                {hasActiveInventoryFilters
                  ? `${sortedTemplates.length} / ${templates.length} cases shown`
                  : `${templates.length} total cases in the library`}
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_auto]">
              <label className="form-control">
                <span className="label-text font-semibold text-white">Filter by category</span>
                <select
                  className={arenaSelectClass}
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
                <span className="label-text font-semibold text-white">Filter by complexity</span>
                <select
                  className={arenaSelectClass}
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
                  className="arena-btn-dark px-4 py-3"
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

            <div className="mt-5 space-y-3">
              <div className="flex flex-wrap gap-2">
                {Object.entries(SORTABLE_COLUMNS).map(([key, column]) => {
                  const isActive = sortConfig.column === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`px-3 py-2 text-xs uppercase tracking-[0.14em] ${
                        isActive ? "arena-btn-light" : "arena-btn-dark"
                      }`}
                      onClick={() => handleSort(key)}
                    >
                      {column.label}
                      {isActive ? ` ${sortConfig.direction === "asc" ? "^" : "v"}` : ""}
                    </button>
                  );
                })}
              </div>

              {sortedTemplates.length === 0 ? (
                <div className="arena-surface-soft border-dashed p-8 text-center text-sm text-white/60">
                  No case templates match the current filters.
                </div>
              ) : (
                sortedTemplates.map((template) => (
                  <article
                    key={`stats-${template.id}`}
                    className={`arena-surface-soft cursor-pointer p-4 transition hover:border-white/20 ${
                      selectedTemplateId === template.id ? "border-white/25" : ""
                    }`}
                    onClick={() => handleSelectTemplate(template)}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-white">{template.title}</h3>
                        <div className="mt-2 flex flex-wrap gap-3 text-sm text-white/56">
                          <span>{categoryMap.get(template.primaryCategory) || template.primaryCategory}</span>
                          <span>Complexity {template.complexity}</span>
                          <span>{template.plays || 0} plays</span>
                          <span>
                            {template.wins || 0}/{template.losses || 0}/{template.draws || 0}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="arena-btn-danger px-4 py-2 text-sm"
                        disabled={deletingTemplateId === template.id}
                        onClick={(event) => handleDeleteTemplate(event, template)}
                      >
                        {deletingTemplateId === template.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <main className="arena-app-shell min-h-screen overflow-x-hidden px-4 py-6 md:px-8 md:py-10">
      <section className="mx-auto max-w-[1600px] space-y-6 arena-reveal">
        <div className="arena-surface arena-scanline arena-column-bg overflow-hidden">
          <div className="p-6 md:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-4xl">
                <p className="arena-kicker">Admin Command</p>
                <h1 className="arena-headline mt-3 text-4xl uppercase leading-[0.92] md:text-6xl">
                  Arena Operations Console
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-white/66 md:text-base">
                  Manage case authoring, send product updates to existing users, and keep
                  operational workflows in one consistent control surface.
                </p>
                <p className="mt-4 text-sm text-white/48">
                  Allowed admins: {adminEmails.length ? adminEmails.join(", ") : "none configured"}
                </p>
              </div>
              <Link href="/dashboard" className="arena-btn-dark inline-flex px-4 py-2 text-sm">
                Back to Dashboard
              </Link>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="arena-stat-card !p-4">
                <p className="arena-kicker">Templates</p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {adminStats.templateCount || templates.length}
                </p>
              </div>
              <div className="arena-stat-card !p-4">
                <p className="arena-kicker">Users</p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {adminStats.userCount || 0}
                </p>
              </div>
              <div className="arena-stat-card !p-4">
                <p className="arena-kicker">Leads</p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {adminStats.leadCount || 0}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {adminTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`px-4 py-3 text-sm ${
                    activeTab === tab.id ? "arena-btn-light" : "arena-btn-dark"
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {activeTab === "case-authoring" ? (
          renderCaseAuthoring()
        ) : null}

        {activeTab === "email-updates" ? (
          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <form className="arena-surface" onSubmit={handleSendEmail}>
              <div className="p-6">
                <p className="arena-kicker">Email Updates</p>
                <h2 className="arena-headline mt-2 text-2xl">Send updates to users</h2>
                <div className="mt-5 grid gap-4">
                  <label className="form-control">
                    <span className="label-text font-semibold text-white">Audience</span>
                    <select
                      className={arenaSelectClass}
                      value={emailForm.audience}
                      onChange={(event) =>
                        setEmailForm((current) => ({
                          ...current,
                          audience: event.target.value,
                        }))
                      }
                    >
                      <option value="all">All existing users</option>
                      <option value="single">One user by ID</option>
                    </select>
                  </label>

                  {emailForm.audience === "single" ? (
                    <label className="form-control">
                      <span className="label-text font-semibold text-white">User ID</span>
                      <input
                        className={arenaInputClass}
                        value={emailForm.userId}
                        onChange={(event) =>
                          setEmailForm((current) => ({
                            ...current,
                            userId: event.target.value,
                          }))
                        }
                      />
                    </label>
                  ) : null}

                  <label className="form-control">
                    <span className="label-text font-semibold text-white">Email type</span>
                    <select
                      className={arenaSelectClass}
                      value={emailForm.type}
                      onChange={(event) =>
                        setEmailForm((current) => ({
                          ...current,
                          type: event.target.value,
                        }))
                      }
                    >
                      <option value="announcement">Announcement</option>
                      <option value="marketing">Marketing</option>
                    </select>
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold text-white">Subject</span>
                    <input
                      className={arenaInputClass}
                      value={emailForm.subject}
                      onChange={(event) =>
                        setEmailForm((current) => ({
                          ...current,
                          subject: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold text-white">Message</span>
                    <textarea
                      className={`${arenaTextareaClass} h-56`}
                      value={emailForm.content}
                      onChange={(event) =>
                        setEmailForm((current) => ({
                          ...current,
                          content: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <button className="arena-btn-light px-5 py-3" disabled={emailWorking}>
                    {emailWorking && <span className="loading loading-spinner loading-xs" />}
                    Send Email Update
                  </button>
                </div>
              </div>
            </form>

            <div className="space-y-6">
              <div className="arena-surface">
                <div className="p-6">
                  <p className="arena-kicker">Audience Notes</p>
                  <h2 className="arena-headline mt-2 text-2xl">Before you send</h2>
                  <div className="mt-5 space-y-3">
                    {[
                      "Use announcements for product updates, new features, and operational notices.",
                      "Use marketing only when the message should feel more promotional in tone.",
                      "Single-user sends require the MongoDB user id, while all-user sends target every stored account with an email.",
                    ].map((item) => (
                      <div key={item} className="arena-surface-soft p-4 text-sm leading-7 text-white/66">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "retention" ? (
          <section className="space-y-6">
            {opsLoading || !retentionConfig || !digestConfig ? (
              <div className="arena-surface p-6 text-sm text-white/62">
                Loading retention ops configuration...
              </div>
            ) : (
              <>
                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <form className="arena-surface" onSubmit={handleSaveOpsConfig}>
                    <div className="p-6">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="arena-kicker">Retention Ops</p>
                          <h2 className="arena-headline mt-2 text-2xl">Lifecycle messaging</h2>
                        </div>
                        <button
                          className="arena-btn-light px-5 py-3"
                          disabled={opsSaving}
                        >
                          {opsSaving ? "Saving..." : "Save Configuration"}
                        </button>
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <label className="arena-surface-soft flex items-center justify-between gap-4 p-4">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              Retention automation enabled
                            </p>
                            <p className="mt-1 text-sm text-white/56">
                              Cron and internal runs respect this switch unless you force a manual run.
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            className={arenaToggleClass}
                            checked={retentionConfig.automationEnabled}
                            onChange={(event) =>
                              setRetentionConfig((current) => ({
                                ...current,
                                automationEnabled: event.target.checked,
                              }))
                            }
                          />
                        </label>

                        <label className="form-control">
                          <span className="label-text font-semibold text-white">
                            Cooldown between emails to the same user
                          </span>
                          <input
                            className={arenaInputClass}
                            type="number"
                            min="1"
                            value={retentionConfig.perUserCooldownHours}
                            onChange={(event) =>
                              setRetentionConfig((current) => ({
                                ...current,
                                perUserCooldownHours: event.target.value,
                              }))
                            }
                          />
                        </label>
                      </div>

                      <div className="mt-6">
                        <p className="arena-kicker">Nudge Types</p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          {Object.entries(retentionNudgeLabels).map(([key, label]) => (
                            <label
                              key={key}
                              className="arena-surface-soft flex items-center justify-between gap-4 p-4"
                            >
                              <span className="text-sm text-white/72">{label}</span>
                              <input
                                type="checkbox"
                                className={arenaToggleClass}
                                checked={Boolean(retentionConfig.nudgeTypes?.[key])}
                                onChange={(event) =>
                                  setRetentionConfig((current) => ({
                                    ...current,
                                    nudgeTypes: {
                                      ...current.nudgeTypes,
                                      [key]: event.target.checked,
                                    },
                                  }))
                                }
                              />
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="mt-6">
                        <p className="arena-kicker">Thresholds</p>
                        <div className="mt-3 grid gap-4 md:grid-cols-2">
                          {Object.entries(retentionThresholdLabels).map(([key, label]) => (
                            <label key={key} className="form-control">
                              <span className="label-text font-semibold text-white">{label}</span>
                              <input
                                className={arenaInputClass}
                                type="number"
                                min="1"
                                value={retentionConfig.thresholds?.[key] ?? ""}
                                onChange={(event) =>
                                  setRetentionConfig((current) => ({
                                    ...current,
                                    thresholds: {
                                      ...current.thresholds,
                                      [key]: event.target.value,
                                    },
                                  }))
                                }
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </form>

                  <div className="space-y-6">
                    <form className="arena-surface" onSubmit={handleRunRetention}>
                      <div className="p-6">
                        <p className="arena-kicker">Manual Nudge Run</p>
                        <h2 className="arena-headline mt-2 text-2xl">Preview or send now</h2>
                        <div className="mt-5 grid gap-4">
                          <label className="form-control">
                            <span className="label-text font-semibold text-white">
                              Users to scan
                            </span>
                            <input
                              className={arenaInputClass}
                              type="number"
                              min="1"
                              value={retentionRunForm.limit}
                              onChange={(event) =>
                                setRetentionRunForm((current) => ({
                                  ...current,
                                  limit: event.target.value,
                                }))
                              }
                            />
                          </label>

                          <label className="arena-surface-soft flex items-center justify-between gap-4 p-4">
                            <div>
                              <p className="text-sm font-semibold text-white">Dry run</p>
                              <p className="mt-1 text-sm text-white/56">
                                Preview who would receive nudges without sending anything.
                              </p>
                            </div>
                            <input
                              type="checkbox"
                              className={arenaToggleClass}
                              checked={retentionRunForm.dryRun}
                              onChange={(event) =>
                                setRetentionRunForm((current) => ({
                                  ...current,
                                  dryRun: event.target.checked,
                                }))
                              }
                            />
                          </label>

                          <label className="arena-surface-soft flex items-center justify-between gap-4 p-4">
                            <div>
                              <p className="text-sm font-semibold text-white">Force when paused</p>
                              <p className="mt-1 text-sm text-white/56">
                                Lets an admin run nudges manually even if automation is disabled.
                              </p>
                            </div>
                            <input
                              type="checkbox"
                              className={arenaToggleClass}
                              checked={retentionRunForm.ignoreAutomationState}
                              onChange={(event) =>
                                setRetentionRunForm((current) => ({
                                  ...current,
                                  ignoreAutomationState: event.target.checked,
                                }))
                              }
                            />
                          </label>

                          <button
                            className="arena-btn-light px-5 py-3"
                            disabled={retentionRunWorking}
                          >
                            {retentionRunWorking
                              ? "Running retention ops..."
                              : retentionRunForm.dryRun
                              ? "Preview Nudge Candidates"
                              : "Send Retention Nudges"}
                          </button>
                        </div>
                      </div>
                    </form>

                    <div className="arena-surface">
                      <div className="p-6">
                        <p className="arena-kicker">Recent Activity</p>
                        <h2 className="arena-headline mt-2 text-2xl">What has been firing</h2>
                        <div className="mt-5 space-y-3">
                          {recentNudges.length ? (
                            recentNudges.map((entry) => (
                              <div
                                key={entry._id}
                                className="arena-surface-soft flex items-center justify-between gap-4 p-4"
                              >
                                <div>
                                  <p className="text-sm font-semibold text-white">
                                    {retentionNudgeLabels[entry._id] || entry._id}
                                  </p>
                                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/42">
                                    Last 14 days
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xl font-semibold text-white">
                                    {entry.sentCount}
                                  </p>
                                  <p className="text-xs text-white/48">
                                    {entry.latestSentAt
                                      ? new Date(entry.latestSentAt).toLocaleString()
                                      : "No recent sends"}
                                  </p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="arena-surface-soft p-4 text-sm text-white/56">
                              No recent nudge sends have been recorded yet.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                  <form className="arena-surface" onSubmit={handleSendDigest}>
                    <div className="p-6">
                      <p className="arena-kicker">News Digest</p>
                      <h2 className="arena-headline mt-2 text-2xl">Compose and send</h2>
                      <div className="mt-5 grid gap-4">
                        <label className="arena-surface-soft flex items-center justify-between gap-4 p-4">
                          <div>
                            <p className="text-sm font-semibold text-white">Digest sending enabled</p>
                            <p className="mt-1 text-sm text-white/56">
                              Use this to pause digest sends without losing the saved draft.
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            className={arenaToggleClass}
                            checked={digestConfig.enabled}
                            onChange={(event) =>
                              setDigestConfig((current) => ({
                                ...current,
                                enabled: event.target.checked,
                              }))
                            }
                          />
                        </label>

                        <label className="form-control">
                          <span className="label-text font-semibold text-white">Audience</span>
                          <select
                            className={arenaSelectClass}
                            value={digestForm.audience}
                            onChange={(event) =>
                              setDigestForm((current) => ({
                                ...current,
                                audience: event.target.value,
                              }))
                            }
                          >
                            <option value="all_users">All users</option>
                            <option value="all_leads">All leads</option>
                            <option value="all_contacts">Users and leads</option>
                          </select>
                        </label>

                        <label className="form-control">
                          <span className="label-text font-semibold text-white">Subject</span>
                          <input
                            className={arenaInputClass}
                            value={digestForm.subject}
                            onChange={(event) =>
                              setDigestForm((current) => ({
                                ...current,
                                subject: event.target.value,
                              }))
                            }
                          />
                        </label>

                        <label className="form-control">
                          <span className="label-text font-semibold text-white">Digest body</span>
                          <textarea
                            className={`${arenaTextareaClass} h-56`}
                            value={digestForm.content}
                            onChange={(event) =>
                              setDigestForm((current) => ({
                                ...current,
                                content: event.target.value,
                              }))
                            }
                          />
                        </label>

                        <label className="form-control">
                          <span className="label-text font-semibold text-white">Footer note</span>
                          <textarea
                            className={`${arenaTextareaClass} h-24`}
                            value={digestForm.footerNote}
                            onChange={(event) =>
                              setDigestForm((current) => ({
                                ...current,
                                footerNote: event.target.value,
                              }))
                            }
                          />
                        </label>

                        <button
                          className="arena-btn-light px-5 py-3"
                          disabled={digestWorking || !digestConfig.enabled}
                        >
                          {digestWorking ? "Sending digest..." : "Send News Digest"}
                        </button>
                      </div>
                    </div>
                  </form>

                  <form className="arena-surface" onSubmit={handleSaveOpsConfig}>
                    <div className="p-6">
                      <p className="arena-kicker">Digest Defaults</p>
                      <h2 className="arena-headline mt-2 text-2xl">Saved configuration</h2>
                      <div className="mt-5 grid gap-4">
                        <label className="form-control">
                          <span className="label-text font-semibold text-white">
                            Default audience
                          </span>
                          <select
                            className={arenaSelectClass}
                            value={digestConfig.defaultAudience}
                            onChange={(event) =>
                              setDigestConfig((current) => ({
                                ...current,
                                defaultAudience: event.target.value,
                              }))
                            }
                          >
                            <option value="all_users">All users</option>
                            <option value="all_leads">All leads</option>
                            <option value="all_contacts">Users and leads</option>
                          </select>
                        </label>

                        <label className="form-control">
                          <span className="label-text font-semibold text-white">Subject prefix</span>
                          <input
                            className={arenaInputClass}
                            value={digestConfig.subjectPrefix}
                            onChange={(event) =>
                              setDigestConfig((current) => ({
                                ...current,
                                subjectPrefix: event.target.value,
                              }))
                            }
                          />
                        </label>

                        <label className="form-control">
                          <span className="label-text font-semibold text-white">
                            Default subject
                          </span>
                          <input
                            className={arenaInputClass}
                            value={digestConfig.defaultSubject}
                            onChange={(event) =>
                              setDigestConfig((current) => ({
                                ...current,
                                defaultSubject: event.target.value,
                              }))
                            }
                          />
                        </label>

                        <label className="form-control">
                          <span className="label-text font-semibold text-white">
                            Default digest body
                          </span>
                          <textarea
                            className={`${arenaTextareaClass} h-40`}
                            value={digestConfig.defaultContent}
                            onChange={(event) =>
                              setDigestConfig((current) => ({
                                ...current,
                                defaultContent: event.target.value,
                              }))
                            }
                          />
                        </label>

                        <div className="arena-surface-soft p-4 text-sm leading-7 text-white/62">
                          The composer on the left is for the next send. These saved defaults let
                          you keep a standing digest format ready for launches, content drops, and
                          weekly product updates.
                        </div>

                        <button
                          className="arena-btn-light px-5 py-3"
                          disabled={opsSaving}
                        >
                          {opsSaving ? "Saving..." : "Save Digest Defaults"}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>

                {retentionSummary ? (
                  <div className="arena-surface">
                    <div className="p-6">
                      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div>
                          <p className="arena-kicker">Last Retention Run</p>
                          <h2 className="arena-headline mt-2 text-2xl">
                            {retentionSummary.dryRun ? "Preview summary" : "Send summary"}
                          </h2>
                        </div>
                        <p className="text-sm text-white/56">
                          Scanned {retentionSummary.scannedUsers || 0} users and found{" "}
                          {retentionSummary.candidates?.length || 0} candidates.
                        </p>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-4">
                        {[
                          ["Candidates", retentionSummary.candidates?.length || 0, "text-white"],
                          ["Sent", retentionSummary.sentCount || 0, "text-emerald-300"],
                          ["Global cap", retentionSummary.skipped?.global_cap || 0, "text-white/72"],
                          ["No eligible nudge", retentionSummary.skipped?.no_eligible_nudge || 0, "text-white/72"],
                        ].map(([label, value, color]) => (
                          <div key={label} className="arena-stat-card !p-4">
                            <p className="arena-kicker">{label}</p>
                            <p className={`mt-2 text-2xl font-semibold ${color}`}>{value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5 space-y-3">
                        {(retentionSummary.candidates || []).slice(0, 12).map((candidate, index) => (
                          <div key={`${candidate.userId}-${index}`} className="arena-surface-soft p-4">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-white">
                                  {retentionNudgeLabels[candidate.nudgeType] || candidate.nudgeType}
                                </p>
                                <p className="mt-1 text-sm text-white/56">{candidate.email}</p>
                                <p className="mt-1 text-sm text-white/62">{candidate.subject}</p>
                              </div>
                              <span className="badge badge-outline text-white/72">
                                {candidate.reason}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>
        ) : null}

        {activeTab === "system" ? (
          <section className="space-y-6">
            <form className="arena-surface" onSubmit={handleSaveOpsConfig}>
              <div className="p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="arena-kicker">Free Gameplay Campaign</p>
                    <h2 className="arena-headline mt-2 text-2xl">
                      One free solo verdict
                    </h2>
                    <p className={`mt-2 text-sm ${freeGameplayCampaignStatus.tone}`}>
                      {freeGameplayCampaignStatus.label}: {freeGameplayCampaignStatus.body}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="arena-btn-dark px-5 py-3"
                      disabled={opsSaving}
                      onClick={startFreeGameplayCampaignImmediately}
                    >
                      Start Immediately
                    </button>
                    <button className="arena-btn-light px-5 py-3" disabled={opsSaving}>
                      {opsSaving ? "Saving..." : "Save Campaign"}
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <label className="arena-surface-soft flex items-center justify-between gap-4 p-4">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Campaign enabled
                      </p>
                      <p className="mt-1 text-sm text-white/56">
                        Opens unpaid solo gameplay only during the configured window.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      className={arenaToggleClass}
                      checked={freeGameplayCampaign.enabled}
                      onChange={(event) =>
                        setFreeGameplayCampaign((current) => ({
                          ...current,
                          enabled: event.target.checked,
                        }))
                      }
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold text-white">Starts at</span>
                    <input
                      className={arenaInputClass}
                      type="datetime-local"
                      value={toDatetimeLocal(freeGameplayCampaign.startsAt)}
                      onChange={(event) =>
                        setFreeGameplayCampaign((current) => ({
                          ...current,
                          startsAt: fromDatetimeLocal(event.target.value),
                        }))
                      }
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold text-white">Ends at</span>
                    <input
                      className={arenaInputClass}
                      type="datetime-local"
                      value={toDatetimeLocal(freeGameplayCampaign.endsAt)}
                      onChange={(event) =>
                        setFreeGameplayCampaign((current) => ({
                          ...current,
                          endsAt: fromDatetimeLocal(event.target.value),
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-[0.75fr_1fr_1fr]">
                  <label className="arena-surface-soft flex items-center justify-between gap-4 p-4">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Landing notice
                      </p>
                      <p className="mt-1 text-sm text-white/56">
                        Shows only while the campaign is active.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      className={arenaToggleClass}
                      checked={freeGameplayCampaign.announcementEnabled}
                      onChange={(event) =>
                        setFreeGameplayCampaign((current) => ({
                          ...current,
                          announcementEnabled: event.target.checked,
                        }))
                      }
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold text-white">
                      Notice title
                    </span>
                    <input
                      className={arenaInputClass}
                      value={freeGameplayCampaign.announcementTitle}
                      onChange={(event) =>
                        setFreeGameplayCampaign((current) => ({
                          ...current,
                          announcementTitle: event.target.value,
                        }))
                      }
                      placeholder="Free gameplay weekend is live"
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold text-white">
                      CTA label
                    </span>
                    <input
                      className={arenaInputClass}
                      value={freeGameplayCampaign.announcementCtaLabel}
                      onChange={(event) =>
                        setFreeGameplayCampaign((current) => ({
                          ...current,
                          announcementCtaLabel: event.target.value,
                        }))
                      }
                      placeholder="Try a Case"
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.45fr]">
                  <label className="form-control">
                    <span className="label-text font-semibold text-white">
                      Notice body
                    </span>
                    <textarea
                      className={`${arenaTextareaClass} h-28`}
                      value={freeGameplayCampaign.announcementBody}
                      onChange={(event) =>
                        setFreeGameplayCampaign((current) => ({
                          ...current,
                          announcementBody: event.target.value,
                        }))
                      }
                      placeholder="Start any solo case and play until your first verdict before the campaign closes."
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold text-white">CTA href</span>
                    <input
                      className={arenaInputClass}
                      value={freeGameplayCampaign.announcementCtaHref}
                      onChange={(event) =>
                        setFreeGameplayCampaign((current) => ({
                          ...current,
                          announcementCtaHref: event.target.value,
                        }))
                      }
                      placeholder="/dashboard"
                    />
                  </label>
                </div>
              </div>
            </form>

            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <div className="arena-surface">
                <div className="p-6">
                <p className="arena-kicker">System</p>
                <h2 className="arena-headline mt-2 text-2xl">Admin access</h2>
                <div className="mt-5 space-y-3">
                  {adminEmails.map((email) => (
                    <div key={email} className="arena-surface-soft p-4 text-sm text-white/72">
                      {email}
                    </div>
                  ))}
                </div>
                </div>
              </div>

              <div className="arena-surface">
                <div className="p-6">
                <p className="arena-kicker">User Access</p>
                <h2 className="arena-headline mt-2 text-2xl">Free access grants</h2>
                <form className="mt-5 grid gap-4" onSubmit={handleGrantFreeAccess}>
                  <label className="form-control">
                    <span className="label-text font-semibold text-white">Email address</span>
                    <input
                      className={arenaInputClass}
                      type="email"
                      value={accessForm.email}
                      onChange={(event) =>
                        setAccessForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      placeholder="person@example.com"
                    />
                  </label>

                  <button className="arena-btn-light px-5 py-3" disabled={accessWorking}>
                    {accessWorking ? "Granting access..." : "Grant Free Access"}
                  </button>
                </form>

                <div className="mt-6">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="arena-kicker">Recent Grants</p>
                      <p className="mt-2 text-sm text-white/56">
                        {freeAccessGrants.length || 0} manual grants
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {freeAccessGrants.length ? (
                      freeAccessGrants.map((grant) => (
                        <div
                          key={grant.id || grant.email}
                          className="arena-surface-soft flex flex-col gap-3 p-4 text-sm leading-6 text-white/72 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="break-words font-semibold text-white">
                              {grant.email}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/42">
                              {grant.freeAccessGrantedAt
                                ? new Date(grant.freeAccessGrantedAt).toLocaleString()
                                : "Grant time unknown"}
                              {grant.freeAccessGrantedBy
                                ? ` by ${grant.freeAccessGrantedBy}`
                                : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="arena-btn-danger min-h-0 shrink-0 px-3 py-2 text-xs"
                            disabled={Boolean(revokingAccessEmail)}
                            onClick={() => handleRevokeFreeAccess(grant)}
                          >
                            {revokingAccessEmail === grant.email
                              ? "Revoking..."
                              : "Revoke Access"}
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="arena-surface-soft p-4 text-sm text-white/56">
                        No manual free-access grants yet.
                      </div>
                    )}
                  </div>
                </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
