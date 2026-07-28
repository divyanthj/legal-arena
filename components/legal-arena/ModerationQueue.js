"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import apiClient from "@/libs/api";

export default function ModerationQueue({ initialReports }) {
  const [reports, setReports] = useState(initialReports);
  const [workingId, setWorkingId] = useState("");

  const updateStatus = async (reportId, status) => {
    setWorkingId(reportId);
    try {
      const response = await apiClient.patch(`/admin/reports/${reportId}`, { status });
      setReports((current) =>
        current.map((report) =>
          report.id === reportId
            ? { ...report, status: response.report.status, resolvedAt: response.report.resolvedAt }
            : report
        )
      );
      toast.success(`Report marked ${status}.`);
    } finally {
      setWorkingId("");
    }
  };

  if (!reports.length) {
    return (
      <div className="arena-surface p-8 text-center text-sm text-white/58">
        No safety reports are waiting in the queue.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reports.map((report) => (
        <article key={report.id} className="arena-surface overflow-hidden">
          <header className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="arena-pill px-2.5 py-1 text-xs">{report.reportType}</span>
                <span className="arena-pill px-2.5 py-1 text-xs">{report.category}</span>
                <span className="arena-pill px-2.5 py-1 text-xs">{report.status}</span>
              </div>
              <h2 className="mt-3 text-lg font-black">{report.contextLabel || "Reported content"}</h2>
              <p className="mt-1 text-xs text-white/45">
                {new Date(report.createdAt).toLocaleString()} · {report.sourceType} {report.sourceId}
              </p>
            </div>
            <p className="text-xs text-white/50">
              Reporter: {report.reporterName || "Deleted player"}
              {report.reportedName ? ` · Reported: ${report.reportedName}` : ""}
            </p>
          </header>
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/38">Captured context</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/66">
                {report.contentExcerpt || "No automatic excerpt was available."}
              </p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/38">Player details</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/66">
                {report.details || "No additional details."}
              </p>
            </div>
          </div>
          <footer className="flex flex-wrap gap-2 border-t border-white/10 p-4">
            {[
              ["reviewing", "Start review"],
              ["actioned", "Action taken"],
              ["dismissed", "Dismiss"],
            ].map(([status, label]) => (
              <button
                key={status}
                type="button"
                disabled={workingId === report.id || report.status === status}
                onClick={() => updateStatus(report.id, status)}
                className="arena-btn-dark px-3 py-2 text-xs disabled:opacity-40"
              >
                {label}
              </button>
            ))}
          </footer>
        </article>
      ))}
    </div>
  );
}

