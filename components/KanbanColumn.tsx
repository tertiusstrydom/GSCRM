"use client";

import type { Deal, DealStage, Contact } from "@/lib/types";
import { DealCard } from "./DealCard";

type KanbanColumnProps = {
  stage: DealStage;
  label: string;
  deals: Deal[];
  contacts: Contact[];
  dealActivities: Record<string, number>;
  color: string;
  onEdit: (deal: Deal) => void;
  onDelete: (id: string) => void;
  onLogActivity: (deal: Deal) => void;
  onAddDeal?: (stage: DealStage) => void;
  onDragStart: (dealId: string) => void;
  onDragEnd: () => void;
  onDrop: (stage: DealStage) => void;
  draggingId: string | null;
};

const STAGE_COLORS: Record<DealStage, { bg: string; border: string; text: string }> = {
  lead: {
    bg: "bg-slate-50",
    border: "border-slate-300",
    text: "text-slate-700"
  },
  qualified: {
    bg: "bg-blue-50",
    border: "border-blue-300",
    text: "text-blue-700"
  },
  proposal: {
    bg: "bg-purple-50",
    border: "border-purple-300",
    text: "text-purple-700"
  },
  negotiation: {
    bg: "bg-orange-50",
    border: "border-orange-300",
    text: "text-orange-700"
  },
  closed_won: {
    bg: "bg-emerald-50",
    border: "border-emerald-300",
    text: "text-emerald-700"
  },
  closed_lost: {
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-700"
  }
};

export function KanbanColumn({
  stage,
  label,
  deals,
  contacts,
  dealActivities,
  onEdit,
  onDelete,
  onLogActivity,
  onAddDeal,
  onDragStart,
  onDragEnd,
  onDrop,
  draggingId
}: KanbanColumnProps) {
  const colors = STAGE_COLORS[stage];
  const totalValue = deals.reduce((sum, deal) => sum + (Number(deal.amount) || 0), 0);
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("ring-2", "ring-primary", "ring-opacity-50");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("ring-2", "ring-primary", "ring-opacity-50");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove("ring-2", "ring-primary", "ring-opacity-50");
    onDrop(stage);
  };

  return (
    <div
      className={`flex h-full w-72 flex-shrink-0 flex-col rounded-lg border-2 ${colors.border} ${colors.bg}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column Header */}
      <div className={`flex items-center justify-between border-b-2 ${colors.border} px-4 py-3`}>
        <div>
          <h3 className={`text-sm font-semibold uppercase tracking-wide ${colors.text}`}>
            {label}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
            <span>{deals.length} deal{deals.length !== 1 ? "s" : ""}</span>
            {deals.length > 0 && (
              <>
                <span>·</span>
                <span className="font-medium">{formatCurrency(totalValue)}</span>
              </>
            )}
          </div>
        </div>
        {onAddDeal && (
          <button
            type="button"
            onClick={() => onAddDeal(stage)}
            className={`rounded-full p-1.5 ${colors.text} hover:bg-white/50`}
            title={`Add deal to ${label}`}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Scrollable Deal Cards */}
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {deals.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-300 text-center">
            <p className="text-xs text-slate-400">No deals</p>
            {onAddDeal && (
              <button
                type="button"
                onClick={() => onAddDeal(stage)}
                className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                + Add deal
              </button>
            )}
          </div>
        ) : (
          deals.map((deal) => {
            const contact = contacts.find((c) => c.id === deal.contact_id);
            return (
              <div
                key={deal.id}
                draggable
                onDragStart={() => onDragStart(deal.id)}
                onDragEnd={onDragEnd}
                className="cursor-move"
              >
                <DealCard
                  deal={deal}
                  contact={contact}
                  activityCount={dealActivities[deal.id] || 0}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onLogActivity={onLogActivity}
                  isDragging={draggingId === deal.id}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
