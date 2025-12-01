"use client";

import { useState, useEffect } from "react";

export type ExportField = {
  key: string;
  label: string;
  essential?: boolean;
};

type ExportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onExport: (selectedFields: string[], exportAll: boolean) => void;
  entityName: string;
  fields: ExportField[];
  totalCount: number;
  filteredCount: number | null;
  isLoading?: boolean;
};

export function ExportModal({
  isOpen,
  onClose,
  onExport,
  entityName,
  fields,
  totalCount,
  filteredCount,
  isLoading = false
}: ExportModalProps) {
  const [exportAll, setExportAll] = useState(true);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Default: select all fields
      setSelectedFields(fields.map((f) => f.key));
      setExportAll(filteredCount === null || filteredCount === totalCount);
    }
  }, [isOpen, fields, totalCount, filteredCount]);

  const handleToggleField = (fieldKey: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldKey)
        ? prev.filter((key) => key !== fieldKey)
        : [...prev, fieldKey]
    );
  };

  const handleSelectPreset = (preset: "essential" | "all") => {
    if (preset === "essential") {
      setSelectedFields(fields.filter((f) => f.essential).map((f) => f.key));
    } else {
      setSelectedFields(fields.map((f) => f.key));
    }
  };

  const handleExport = () => {
    if (selectedFields.length === 0) {
      alert("Please select at least one field to export");
      return;
    }
    onExport(selectedFields, exportAll);
  };

  const recordCount = exportAll ? totalCount : (filteredCount ?? 0);
  const hasFilters = filteredCount !== null && filteredCount !== totalCount;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">
              Export {entityName} to CSV
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {/* Export Options */}
          {hasFilters && (
            <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-sm font-medium text-slate-900">
                What would you like to export?
              </p>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="exportScope"
                    checked={exportAll}
                    onChange={() => setExportAll(true)}
                    className="h-4 w-4 border-slate-300 text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-900">
                      Export all {totalCount} {entityName}
                    </span>
                  </div>
                </label>
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="exportScope"
                    checked={!exportAll}
                    onChange={() => setExportAll(false)}
                    className="h-4 w-4 border-slate-300 text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-900">
                      Export filtered results ({filteredCount} {entityName})
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Field Selection */}
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-900">
                Select fields to export
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSelectPreset("essential")}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Essential Only
                </button>
                <button
                  onClick={() => handleSelectPreset("all")}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  All Fields
                </button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
              <div className="divide-y divide-slate-200">
                {fields.map((field) => (
                  <label
                    key={field.key}
                    className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(field.key)}
                      onChange={() => handleToggleField(field.key)}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <div className="flex-1">
                      <span className="text-sm text-slate-900">{field.label}</span>
                      {field.essential && (
                        <span className="ml-2 text-xs text-slate-500">
                          (Essential)
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-900">
              Ready to export
            </p>
            <p className="mt-1 text-sm text-blue-800">
              Exporting {recordCount} {entityName} with {selectedFields.length}{" "}
              {selectedFields.length === 1 ? "field" : "fields"}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isLoading || selectedFields.length === 0}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover disabled:opacity-50"
            >
              {isLoading ? "Exporting..." : "Export CSV"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


