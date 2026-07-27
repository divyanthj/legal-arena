"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ShareIcon } from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";
import { trackGoal } from "@/libs/datafast";
import { createResultShareData } from "@/libs/game/resultShareCard.mjs";

const canSharePngFile = () => {
  try {
    if (
      typeof navigator === "undefined" ||
      typeof navigator.share !== "function" ||
      typeof navigator.canShare !== "function" ||
      typeof File !== "function"
    ) {
      return false;
    }
    const probe = new File([new Blob(["result"])], "legal-arena-result.png", {
      type: "image/png",
    });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
};

const downloadResult = (blob, fileName) => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};

export default function ShareResultButton({
  sourceType,
  sourceId,
  mode,
  resolutionType,
  outcome,
  playerScore,
  opponentScore,
  settlementQualityScore,
  category,
  categoryTitle,
  complexity,
  className = "",
}) {
  const [working, setWorking] = useState(false);
  const viewedRef = useRef(false);
  const shareData = useMemo(
    () =>
      createResultShareData({
        resolutionType,
        outcome,
        playerScore,
        opponentScore,
        settlementQualityScore,
        category,
        categoryTitle,
        complexity,
      }),
    [
      category,
      categoryTitle,
      complexity,
      opponentScore,
      outcome,
      playerScore,
      resolutionType,
      settlementQualityScore,
    ]
  );
  const analytics = useMemo(
    () => ({
      mode,
      resolution_type: shareData.resolutionType,
      outcome: shareData.outcome,
      category: shareData.category,
      complexity: shareData.complexity,
    }),
    [mode, shareData]
  );

  useEffect(() => {
    if (!sourceId || viewedRef.current) return;
    viewedRef.current = true;
    trackGoal("result_share_button_viewed", {
      ...analytics,
      method: canSharePngFile() ? "native" : "download",
    });
  }, [analytics, sourceId]);

  const handleShare = async () => {
    if (working || !sourceId) return;
    const preferredMethod = canSharePngFile() ? "native" : "download";
    trackGoal("result_share_started", {
      ...analytics,
      method: preferredMethod,
    });
    setWorking(true);

    try {
      const response = await fetch(
        `/api/result-share/${encodeURIComponent(sourceType)}/${encodeURIComponent(sourceId)}`,
        { credentials: "same-origin" }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Could not create the result card.");
      }
      const blob = await response.blob();
      if (blob.type !== "image/png") {
        throw new Error("The result card was returned in an unsupported format.");
      }

      const file =
        preferredMethod === "native"
          ? new File([blob], shareData.fileName, { type: "image/png" })
          : null;
      const canShareFile =
        file && navigator.canShare({ files: [file] });

      if (canShareFile) {
        try {
          await navigator.share({
            files: [file],
            title: "My Legal Arena result",
            text: shareData.caption,
          });
          trackGoal("result_share_completed", {
            ...analytics,
            method: "native",
          });
          return;
        } catch (error) {
          if (error?.name === "AbortError") {
            trackGoal("result_share_cancelled", {
              ...analytics,
              method: "native",
            });
            return;
          }
        }
      }

      downloadResult(blob, shareData.fileName);
      trackGoal("result_share_downloaded", {
        ...analytics,
        method: "download",
      });
      toast.success("Result card downloaded. Attach it to WhatsApp, Facebook, or X.");
    } catch (error) {
      trackGoal("result_share_failed", {
        ...analytics,
        method: preferredMethod,
      });
      toast.error(error?.message || "Could not share this result.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={working || !sourceId}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/78 transition hover:border-white/28 hover:bg-white/[0.075] hover:text-white disabled:cursor-wait disabled:opacity-55 ${className}`}
      aria-label="Share this result as an image"
    >
      <ShareIcon className="h-4 w-4" aria-hidden="true" />
      {working ? "Preparing..." : "Share result"}
    </button>
  );
}
