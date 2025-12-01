"use client";

import { useState } from "react";
import Link from "next/link";
import type { Deal, Contact } from "@/lib/types";
import { getContactFullName } from "@/lib/contact-utils";

type DealCardProps = {
  deal: Deal;
  contact?: Contact;
  activityCount?: number;
  onEdit: (deal: Deal) => void;
  onDelete: (id: string) => void;
  onLogActivity: (deal: Deal) => void;
  isDragging?: boolean;
};

export function DealCard({
  deal,
  contact,
  activityCount = 0,
  onEdit,
  onDelete,
  onLogActivity,
  isDragging = false
}: DealCardProps) {
  const [showActions, setShowActions] = useState(false);

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "$0";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const isOverdue = deal.close_date
    ? new Date(deal.close_date) < new Date() && deal.stage !== "closed_won" && deal.stage !== "closed_lost"
    : false;

  const getDaysUntilClose = () => {
    if (!deal.close_date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const closeDate = new Date(deal.close_date);
    closeDate.setHours(0, 0, 0, 0);
    const diffTime = closeDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntilClose = getDaysUntilClose();
  const isUrgent = daysUntilClose !== null && daysUntilClose >= 0 && daysUntilClose <= 7;

  return (
    <div
      className={`group relative rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-all hover:shadow-md ${
        isDragging ? "opacity-50 scale-95" : ""
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Priority/Age Badge */}
      {isOverdue && (
        <span className="absolute top-2 right-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
          Overdue
        </span>
      )}
      {isUrgent && !isOverdue && (
        <span className="absolute top-2 right-2 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
          Urgent
        </span>
      )}

      {/* Deal Title */}
      <h3 className="pr-16 text-sm font-semibold text-slate-900 line-clamp-2">
        {deal.title}
      </h3>

      {/* Amount - Prominent */}
      <div className="mt-2">
        <p className="text-lg font-bold text-slate-900">
          {formatCurrency(deal.amount)}
        </p>
      </div>

      {/* Contact/Company */}
      {contact && (
        <div className="mt-2 text-xs text-slate-600">
          <p className="truncate">{getContactFullName(contact)}</p>
          {contact.company && (
            <p className="truncate text-slate-500">{contact.company}</p>
          )}
        </div>
      )}

      {/* Close Date */}
      {deal.close_date && (
        <div className="mt-2 text-xs">
          <span className={`font-medium ${
            isOverdue ? "text-red-600" : isUrgent ? "text-orange-600" : "text-slate-600"
          }`}>
            {isOverdue
              ? "Overdue"
              : daysUntilClose === 0
              ? "Due today"
              : daysUntilClose === 1
              ? "Due tomorrow"
              : daysUntilClose !== null && daysUntilClose > 1
              ? `${daysUntilClose} days`
              : ""}
          </span>
          <span className="ml-1 text-slate-500">
            · {new Date(deal.close_date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric"
            })}
          </span>
        </div>
      )}

      {/* Activity Count */}
      {activityCount > 0 && (
        <div className="mt-2 text-[10px] text-slate-500">
          {activityCount} activit{activityCount === 1 ? "y" : "ies"}
        </div>
      )}

      {/* Actions - Show on Hover */}
      {showActions && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 rounded-b-lg bg-white/95 p-2 backdrop-blur-sm border-t border-slate-200">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLogActivity(deal);
            }}
            className="rounded px-2 py-1 text-[10px] font-medium text-blue-600 hover:bg-blue-50"
            title="Log Activity"
          >
            📝
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(deal);
            }}
            className="rounded px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-100"
            title="Edit"
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("Delete this deal?")) {
                onDelete(deal.id);
              }
            }}
            className="rounded px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50"
            title="Delete"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );
}

