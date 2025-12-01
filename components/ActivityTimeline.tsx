"use client";

import { useState } from "react";
import Link from "next/link";
import type { Activity, ActivityType } from "@/lib/types";

type ActivityTimelineProps = {
  activities: Activity[];
  onRefresh?: () => void;
  showEntityLinks?: boolean;
};

const ACTIVITY_TYPE_CONFIG: Record<
  ActivityType,
  { icon: string; label: string; color: string; bgColor: string }
> = {
  note: {
    icon: "📝",
    label: "Note",
    color: "text-slate-700",
    bgColor: "bg-slate-100"
  },
  call: {
    icon: "📞",
    label: "Call",
    color: "text-blue-700",
    bgColor: "bg-blue-100"
  },
  email: {
    icon: "✉️",
    label: "Email",
    color: "text-indigo-700",
    bgColor: "bg-indigo-100"
  },
  meeting: {
    icon: "📅",
    label: "Meeting",
    color: "text-purple-700",
    bgColor: "bg-purple-100"
  },
  task_completed: {
    icon: "✅",
    label: "Task Completed",
    color: "text-emerald-700",
    bgColor: "bg-emerald-100"
  },
  other: {
    icon: "📌",
    label: "Other",
    color: "text-gray-700",
    bgColor: "bg-gray-100"
  }
};

const OUTCOME_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  successful: {
    label: "Successful",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50"
  },
  no_answer: {
    label: "No Answer",
    color: "text-yellow-700",
    bgColor: "bg-yellow-50"
  },
  follow_up_needed: {
    label: "Follow Up Needed",
    color: "text-blue-700",
    bgColor: "bg-blue-50"
  },
  not_interested: {
    label: "Not Interested",
    color: "text-red-700",
    bgColor: "bg-red-50"
  }
};

function formatRelativeTime(date: string): string {
  const now = new Date();
  const activityDate = new Date(date);
  const diffMs = now.getTime() - activityDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  // Check if same day
  if (
    activityDate.getDate() === now.getDate() &&
    activityDate.getMonth() === now.getMonth() &&
    activityDate.getFullYear() === now.getFullYear()
  ) {
    return `Today at ${activityDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit"
    })}`;
  }

  // Check if yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    activityDate.getDate() === yesterday.getDate() &&
    activityDate.getMonth() === yesterday.getMonth() &&
    activityDate.getFullYear() === yesterday.getFullYear()
  ) {
    return `Yesterday at ${activityDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit"
    })}`;
  }

  return activityDate.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: activityDate.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit"
  });
}

export function ActivityTimeline({
  activities,
  showEntityLinks = false
}: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
        <p className="text-sm text-slate-500">No activities yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <ActivityItem
          key={activity.id}
          activity={activity}
          showEntityLinks={showEntityLinks}
        />
      ))}
    </div>
  );
}

function ActivityItem({
  activity,
  showEntityLinks
}: {
  activity: Activity;
  showEntityLinks: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = ACTIVITY_TYPE_CONFIG[activity.type];
  const outcomeConfig = activity.outcome ? OUTCOME_CONFIG[activity.outcome] : null;
  const hasDescription = activity.description && activity.description.trim().length > 0;
  const descriptionLength = activity.description?.length || 0;
  const shouldTruncate = descriptionLength > 200;

  return (
    <div className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <div
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${config.bgColor}`}
      >
        <span className="text-lg">{config.icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-slate-900">{activity.title}</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.color} ${config.bgColor}`}
              >
                {config.label}
              </span>
              {outcomeConfig && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${outcomeConfig.color} ${outcomeConfig.bgColor}`}
                >
                  {outcomeConfig.label}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{formatRelativeTime(activity.activity_date)}</span>
              {activity.duration_minutes && (
                <>
                  <span>·</span>
                  <span>{activity.duration_minutes} min</span>
                </>
              )}
              {activity.created_by && (
                <>
                  <span>·</span>
                  <span>by {activity.created_by}</span>
                </>
              )}
              {showEntityLinks && (
                <>
                  {activity.contact_id && (
                    <>
                      <span>·</span>
                      <Link
                        href={`/contacts/${activity.contact_id}`}
                        className="text-primary hover:underline"
                      >
                        View Contact
                      </Link>
                    </>
                  )}
                  {activity.company_id && (
                    <>
                      <span>·</span>
                      <Link
                        href={`/companies/${activity.company_id}`}
                        className="text-primary hover:underline"
                      >
                        View Company
                      </Link>
                    </>
                  )}
                  {activity.deal_id && (
                    <>
                      <span>·</span>
                      <Link
                        href={`/deals#${activity.deal_id}`}
                        className="text-primary hover:underline"
                      >
                        View Deal
                      </Link>
                    </>
                  )}
                </>
              )}
            </div>
            {hasDescription && (
              <div className="mt-2">
                <div
                  className={`text-slate-700 whitespace-pre-wrap ${
                    expanded || !shouldTruncate ? "" : "line-clamp-2"
                  }`}
                >
                  {activity.description}
                </div>
                {shouldTruncate && (
                  <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    className="mt-1 text-xs font-medium text-primary hover:underline"
                  >
                    {expanded ? "Show less" : "Show more"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

