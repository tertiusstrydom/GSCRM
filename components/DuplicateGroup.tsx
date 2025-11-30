"use client";

import { useState } from "react";
import Link from "next/link";
import type { Contact, Company } from "@/lib/types";
import { MergeModal } from "./MergeModal";

type DuplicateGroupProps = {
  entityType: "contact" | "company";
  records: Contact[] | Company[];
  matchKey: string;
  similarity?: number;
  onDeleted?: () => void;
  onMerged?: () => void;
};

export function DuplicateGroup({
  entityType,
  records,
  matchKey,
  similarity,
  onDeleted,
  onMerged
}: DuplicateGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<{ primary: Contact | Company; duplicate: Contact | Company } | null>(null);

  const handleMerge = (primary: Contact | Company, duplicate: Contact | Company) => {
    setSelectedForMerge({ primary, duplicate });
    setMergeModalOpen(true);
  };

  const handleMergeComplete = () => {
    setMergeModalOpen(false);
    setSelectedForMerge(null);
    if (onMerged) onMerged();
  };

  if (records.length < 2) return null;

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-3 text-left hover:bg-slate-50"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {matchKey}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {records.length} duplicate{records.length > 1 ? "s" : ""} found
                {similarity && ` • ${Math.round(similarity * 100)}% similar`}
              </p>
            </div>
            <svg
              className={`h-5 w-5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </button>

        {expanded && (
          <div className="border-t border-slate-200 p-4">
            <div className="space-y-3">
              {records.map((record, index) => (
                <div
                  key={record.id}
                  className="rounded-md border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/${entityType}s/${record.id}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          {entityType === "contact"
                            ? (record as Contact).name
                            : (record as Company).name}
                        </Link>
                        {index === 0 && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                            Most Complete
                          </span>
                        )}
                      </div>
                      <div className="mt-1 space-y-1 text-xs text-slate-600">
                        {entityType === "contact" ? (
                          <>
                            {(record as Contact).email && (
                              <div>Email: {(record as Contact).email}</div>
                            )}
                            {(record as Contact).phone_number && (
                              <div>Phone: {(record as Contact).phone_number}</div>
                            )}
                            {((record as Contact).company || (record as Contact).company_id) && (
                              <div>
                                Company:{" "}
                                {(record as Contact).company ||
                                  "Linked company"}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            {(record as Company).website && (
                              <div>Website: {(record as Company).website}</div>
                            )}
                            {(record as Company).industry && (
                              <div>Industry: {(record as Company).industry}</div>
                            )}
                            {(record as Company).phone_number && (
                              <div>Phone: {(record as Company).phone_number}</div>
                            )}
                          </>
                        )}
                        <div>
                          Created:{" "}
                          {record.created_at
                            ? new Date(record.created_at).toLocaleDateString()
                            : "N/A"}
                        </div>
                      </div>
                    </div>
                    <div className="ml-4 flex gap-2">
                      {index > 0 && (
                        <button
                          onClick={() => handleMerge(records[0], record)}
                          className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-hover"
                        >
                          Merge
                        </button>
                      )}
                      <Link
                        href={`/${entityType}s/${record.id}`}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedForMerge && (
        <MergeModal
          isOpen={mergeModalOpen}
          onClose={() => {
            setMergeModalOpen(false);
            setSelectedForMerge(null);
          }}
          entityType={entityType}
          primaryRecord={selectedForMerge.primary}
          duplicateRecord={selectedForMerge.duplicate}
          onMergeComplete={handleMergeComplete}
          onDeleted={onDeleted}
        />
      )}
    </>
  );
}
