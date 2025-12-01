"use client";

import type { Deal, DealStage, Contact } from "@/lib/types";
import { KanbanColumn } from "./KanbanColumn";

const STAGES: { id: DealStage; label: string }[] = [
  { id: "lead", label: "Lead" },
  { id: "qualified", label: "Qualified" },
  { id: "proposal", label: "Proposal" },
  { id: "negotiation", label: "Negotiation" },
  { id: "closed_won", label: "Closed Won" },
  { id: "closed_lost", label: "Closed Lost" }
];

type KanbanBoardProps = {
  deals: Deal[];
  contacts: Contact[];
  dealActivities: Record<string, number>;
  onEdit: (deal: Deal) => void;
  onDelete: (id: string) => void;
  onLogActivity: (deal: Deal) => void;
  onAddDeal: (stage: DealStage) => void;
  onStageChange: (dealId: string, newStage: DealStage) => Promise<void>;
  draggingId: string | null;
  onDragStart: (dealId: string) => void;
  onDragEnd: () => void;
};

export function KanbanBoard({
  deals,
  contacts,
  dealActivities,
  onEdit,
  onDelete,
  onLogActivity,
  onAddDeal,
  onStageChange,
  draggingId,
  onDragStart,
  onDragEnd
}: KanbanBoardProps) {
  const dealsByStage = deals.reduce(
    (acc, deal) => {
      if (!acc[deal.stage]) acc[deal.stage] = [];
      acc[deal.stage].push(deal);
      return acc;
    },
    {} as Record<DealStage, Deal[]>
  );

  const handleDrop = async (stage: DealStage) => {
    if (!draggingId) return;
    const deal = deals.find((d) => d.id === draggingId);
    if (!deal || deal.stage === stage) {
      onDragEnd();
      return;
    }
    await onStageChange(draggingId, stage);
    onDragEnd();
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STAGES.map((stage) => (
        <KanbanColumn
          key={stage.id}
          stage={stage.id}
          label={stage.label}
          deals={dealsByStage[stage.id] || []}
          contacts={contacts}
          dealActivities={dealActivities}
          onEdit={onEdit}
          onDelete={onDelete}
          onLogActivity={onLogActivity}
          onAddDeal={onAddDeal}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDrop={handleDrop}
          draggingId={draggingId}
        />
      ))}
    </div>
  );
}

