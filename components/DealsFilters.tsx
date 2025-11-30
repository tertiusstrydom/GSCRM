"use client";

import type { Contact, DealStage } from "@/lib/types";

type DealsFiltersProps = {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterContact: string;
  setFilterContact: (contactId: string) => void;
  filterStage: DealStage | "all";
  setFilterStage: (stage: DealStage | "all") => void;
  sortBy: "amount" | "close_date" | "updated";
  setSortBy: (sort: "amount" | "close_date" | "updated") => void;
  contacts: Contact[];
  onClear: () => void;
};

export function DealsFilters({
  searchQuery,
  setSearchQuery,
  filterContact,
  setFilterContact,
  filterStage,
  setFilterStage,
  sortBy,
  setSortBy,
  contacts,
  onClear
}: DealsFiltersProps) {
  const hasFilters =
    searchQuery || filterContact !== "all" || filterStage !== "all";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Filters & Sort</h3>
        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Clear All
          </button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="block text-xs font-medium text-slate-700">Search</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search deals..."
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Contact</label>
          <select
            value={filterContact}
            onChange={(e) => setFilterContact(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="all">All Contacts</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Stage</label>
          <select
            value={filterStage}
            onChange={(e) =>
              setFilterStage(e.target.value as DealStage | "all")
            }
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="all">All Stages</option>
            <option value="lead">Lead</option>
            <option value="qualified">Qualified</option>
            <option value="proposal">Proposal</option>
            <option value="negotiation">Negotiation</option>
            <option value="closed_won">Closed Won</option>
            <option value="closed_lost">Closed Lost</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as "amount" | "close_date" | "updated")
            }
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="amount">Amount (High to Low)</option>
            <option value="close_date">Close Date</option>
            <option value="updated">Recently Updated</option>
          </select>
        </div>
      </div>
    </div>
  );
}
