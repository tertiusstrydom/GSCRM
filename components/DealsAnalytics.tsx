"use client";

import type { Deal } from "@/lib/types";

type DealsAnalyticsProps = {
  deals: Deal[];
  loading?: boolean;
};

export function DealsAnalytics({ deals, loading = false }: DealsAnalyticsProps) {
  const openDeals = deals.filter(
    (d) => d.stage !== "closed_won" && d.stage !== "closed_lost"
  );
  const closedWon = deals.filter((d) => d.stage === "closed_won");
  const closedLost = deals.filter((d) => d.stage === "closed_lost");

  const pipelineTotal = openDeals.reduce(
    (sum, deal) => sum + (Number(deal.amount) || 0),
    0
  );
  const closedWonValue = closedWon.reduce(
    (sum, deal) => sum + (Number(deal.amount) || 0),
    0
  );
  const closedLostValue = closedLost.reduce(
    (sum, deal) => sum + (Number(deal.amount) || 0),
    0
  );

  const totalClosed = closedWon.length + closedLost.length;
  const winRate =
    totalClosed > 0 ? ((closedWon.length / totalClosed) * 100).toFixed(1) : "0";

  const averageDealSize =
    deals.length > 0
      ? deals.reduce((sum, deal) => sum + (Number(deal.amount) || 0), 0) /
        deals.length
      : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3"
          >
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200"></div>
            <div className="mt-2 h-6 w-32 animate-pulse rounded bg-slate-200"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Pipeline Total
        </p>
        <p className="mt-2 text-xl font-semibold text-slate-900">
          {formatCurrency(pipelineTotal)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {openDeals.length} open deal{openDeals.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Win Rate
        </p>
        <p className="mt-2 text-xl font-semibold text-emerald-600">{winRate}%</p>
        <p className="mt-1 text-xs text-slate-500">
          {closedWon.length} won · {closedLost.length} lost
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Avg Deal Size
        </p>
        <p className="mt-2 text-xl font-semibold text-slate-900">
          {formatCurrency(averageDealSize)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Across all {deals.length} deal{deals.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Closed Won Value
        </p>
        <p className="mt-2 text-xl font-semibold text-emerald-600">
          {formatCurrency(closedWonValue)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {closedWon.length} deal{closedWon.length !== 1 ? "s" : ""} closed
        </p>
      </div>
    </div>
  );
}
