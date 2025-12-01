"use client";

import type { ContactField, CompanyField } from "@/lib/csv-utils";

type FieldMappingProps = {
  csvHeaders: string[];
  availableFields: Array<{
    field: ContactField | CompanyField;
    label: string;
    required: boolean;
  }>;
  mapping: Record<string, string>;
  onMappingChange: (csvHeader: string, field: string) => void;
};

export function FieldMapping({
  csvHeaders,
  availableFields,
  mapping,
  onMappingChange
}: FieldMappingProps) {
  const getFieldLabel = (fieldName: string) => {
    return (
      availableFields.find((f) => f.field === fieldName)?.label || fieldName
    );
  };

  const getMappedField = (csvHeader: string) => {
    return mapping[csvHeader] || "";
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="grid grid-cols-2 gap-4 text-xs font-semibold uppercase tracking-wide text-slate-700">
            <div>CSV Column</div>
            <div>Map to CRM Field</div>
          </div>
        </div>
        <div className="divide-y divide-slate-200">
          {csvHeaders.map((header) => {
            const mappedField = getMappedField(header);
            return (
              <div key={header} className="grid grid-cols-2 gap-4 px-4 py-3">
                <div className="flex items-center">
                  <span className="text-sm text-slate-900">{header}</span>
                </div>
                <div>
                  <select
                    value={mappedField}
                    onChange={(e) => onMappingChange(header, e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="">-- Skip column --</option>
                    {availableFields.map((field) => (
                      <option key={field.field} value={field.field}>
                        {field.label}
                        {field.required && " *"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <p className="font-medium">Tip:</p>
        <p className="mt-1 text-xs">
          Fields marked with * are required. Unmapped columns will be skipped during import.
        </p>
      </div>
    </div>
  );
}

