"use client";

import type { LifecycleStage } from "@/lib/types";

type LifecycleStageBadgeProps = {
  stage: LifecycleStage | null;
  size?: "sm" | "md";
};

const stageColors: Record<LifecycleStage, { bg: string; text: string }> = {
  lead: { bg: "bg-slate-100", text: "text-slate-700" },
  marketing_qualified: { bg: "bg-blue-100", text: "text-blue-700" },
  sales_qualified: { bg: "bg-purple-100", text: "text-purple-700" },
  opportunity: { bg: "bg-amber-100", text: "text-amber-700" },
  customer: { bg: "bg-green-100", text: "text-green-700" },
  evangelist: { bg: "bg-emerald-100", text: "text-emerald-700" },
  other: { bg: "bg-gray-100", text: "text-gray-700" }
};

const stageLabels: Record<LifecycleStage, string> = {
  lead: "Lead",
  marketing_qualified: "Marketing Qualified",
  sales_qualified: "Sales Qualified",
  opportunity: "Opportunity",
  customer: "Customer",
  evangelist: "Evangelist",
  other: "Other"
};

export function LifecycleStageBadge({
  stage,
  size = "md"
}: LifecycleStageBadgeProps) {
  if (!stage) return null;

  const colors = stageColors[stage];
  const label = stageLabels[stage];
  const sizeClass = size === "sm" ? "text-xs px-1.5 py-0.5" : "text-xs px-2 py-1";

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${colors.bg} ${colors.text}`}
    >
      {label}
    </span>
  );
}

