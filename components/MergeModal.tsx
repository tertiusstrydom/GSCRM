"use client";

import { useState, useEffect } from "react";
import { createSupabaseClient } from "@/lib/supabase";
import type { Contact, Company } from "@/lib/types";
import { mergeContacts, mergeCompanies } from "@/lib/merge-utils";

type MergeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  entityType: "contact" | "company";
  primaryRecord: Contact | Company;
  duplicateRecord: Contact | Company;
  onMergeComplete?: () => void;
  onDeleted?: () => void;
};

type FieldChoice = {
  field: string;
  value: any;
  source: "primary" | "duplicate";
};

function getFieldValue(record: Contact | Company, field: string): any {
  return (record as any)[field] ?? null;
}

function chooseBestValue(
  primary: Contact | Company,
  duplicate: Contact | Company,
  field: string
): "primary" | "duplicate" {
  const primaryValue = getFieldValue(primary, field);
  const duplicateValue = getFieldValue(duplicate, field);

  // If primary has value and duplicate doesn't, choose primary
  if (primaryValue && !duplicateValue) return "primary";
  // If duplicate has value and primary doesn't, choose duplicate
  if (!primaryValue && duplicateValue) return "duplicate";
  // If both have values, prefer the more recent or more complete one
  // For now, prefer primary (it's usually the "most complete" record)
  return "primary";
}

export function MergeModal({
  isOpen,
  onClose,
  entityType,
  primaryRecord,
  duplicateRecord,
  onMergeComplete,
  onDeleted
}: MergeModalProps) {
  const [fieldChoices, setFieldChoices] = useState<Map<string, "primary" | "duplicate">>(new Map());
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize field choices with smart defaults
  useEffect(() => {
    if (!isOpen) return;

    const choices = new Map<string, "primary" | "duplicate">();
    const allFields = new Set([
      ...Object.keys(primaryRecord),
      ...Object.keys(duplicateRecord)
    ]);

    // Fields to exclude from merging (they'll be handled separately)
    const excludeFields = ["id", "user_id", "created_at", "is_merged"];

    for (const field of allFields) {
      if (excludeFields.includes(field)) continue;
      choices.set(field, chooseBestValue(primaryRecord, duplicateRecord, field));
    }

    setFieldChoices(choices);
    setError(null);
  }, [isOpen, primaryRecord, duplicateRecord]);

  const handleFieldChoice = (field: string, source: "primary" | "duplicate") => {
    setFieldChoices(new Map(fieldChoices.set(field, source)));
  };

  const handleMerge = async () => {
    if (!confirm(
      `Are you sure you want to merge these ${entityType}s? This action cannot be undone.`
    )) {
      return;
    }

    setMerging(true);
    setError(null);

    try {
      // Build merged data object
      const mergedData: any = {};
      for (const [field, source] of fieldChoices.entries()) {
        const sourceRecord = source === "primary" ? primaryRecord : duplicateRecord;
        mergedData[field] = getFieldValue(sourceRecord, field);
      }

      if (entityType === "contact") {
        await mergeContacts(primaryRecord.id, duplicateRecord.id, mergedData as Partial<Contact>);
      } else {
        await mergeCompanies(primaryRecord.id, duplicateRecord.id, mergedData as Partial<Company>);
      }

      if (onMergeComplete) onMergeComplete();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to merge records");
    } finally {
      setMerging(false);
    }
  };

  if (!isOpen) return null;

  const getFieldLabel = (field: string): string => {
    return field
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        
        <div className="relative z-10 w-full max-w-6xl rounded-lg bg-white shadow-xl">
          <div className="sticky top-0 border-b border-slate-200 bg-white px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Merge {entityType === "contact" ? "Contacts" : "Companies"}
              </h2>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-6">
            {error && (
              <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              {/* Primary Record */}
              <div>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Primary Record (Keeping)
                </h3>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <p className="font-medium">
                    {entityType === "contact"
                      ? (primaryRecord as Contact).name
                      : (primaryRecord as Company).name}
                  </p>
                </div>
              </div>

              {/* Duplicate Record */}
              <div>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Duplicate Record (Merging into primary)
                </h3>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <p className="font-medium">
                    {entityType === "contact"
                      ? (duplicateRecord as Contact).name
                      : (duplicateRecord as Company).name}
                  </p>
                </div>
              </div>
            </div>

            {/* Field Comparison */}
            <div className="mt-6 space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Choose which values to keep:
              </h3>
              
              {Array.from(fieldChoices.entries()).map(([field, selected]) => {
                const primaryValue = getFieldValue(primaryRecord, field);
                const duplicateValue = getFieldValue(duplicateRecord, field);
                
                // Skip if both are empty/null
                if (!primaryValue && !duplicateValue) return null;

                return (
                  <div key={field} className="rounded-md border border-slate-200 p-4">
                    <label className="block text-xs font-medium text-slate-700 mb-2">
                      {getFieldLabel(field)}
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={field}
                          checked={selected === "primary"}
                          onChange={() => handleFieldChoice(field, "primary")}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="text-sm text-slate-900">
                            {primaryValue ? String(primaryValue) : <span className="text-slate-400">(empty)</span>}
                          </div>
                        </div>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={field}
                          checked={selected === "duplicate"}
                          onChange={() => handleFieldChoice(field, "duplicate")}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="text-sm text-slate-900">
                            {duplicateValue ? String(duplicateValue) : <span className="text-slate-400">(empty)</span>}
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-4">
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                disabled={merging}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMerge}
                disabled={merging}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover disabled:opacity-50"
              >
                {merging ? (
                  <>
                    <div className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Merging...
                  </>
                ) : (
                  "Merge Records"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

