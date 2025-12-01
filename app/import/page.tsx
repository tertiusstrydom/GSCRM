"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase";
import {
  CONTACT_FIELDS,
  COMPANY_FIELDS,
  type ContactField,
  type CompanyField,
  autoMapFields,
  isValidEmail,
  isValidUrl,
  generateSampleCSV,
  downloadCSV,
  type CSVRow
} from "@/lib/csv-utils";
import { splitFullName } from "@/lib/contact-utils";
import { CSVFileUpload } from "@/components/CSVFileUpload";
import { FieldMapping } from "@/components/FieldMapping";

type ImportType = "contacts" | "companies";

type ImportStep =
  | "upload"
  | "map"
  | "preview"
  | "importing"
  | "results";

type ImportResult = {
  success: number;
  skipped: number;
  errors: Array<{
    row: number;
    data: CSVRow;
    reason: string;
  }>;
};

function ImportPageContent() {
  const searchParams = useSearchParams();
  const [importType, setImportType] = useState<ImportType>("contacts");
  
  useEffect(() => {
    const typeParam = searchParams.get("type");
    if (typeParam === "contacts" || typeParam === "companies") {
      setImportType(typeParam);
    }
  }, [searchParams]);
  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importOptions, setImportOptions] = useState({
    skipMissingRequired: true,
    updateExisting: false,
    createCompanies: false
  });
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isImporting, setIsImporting] = useState(false);

  const availableFields =
    importType === "contacts" ? CONTACT_FIELDS : COMPANY_FIELDS;

  const handleFileSelected = async (selectedFile: File) => {
    setFile(selectedFile);

    // Parse CSV file
    try {
      const text = await selectedFile.text();
      const lines = text.split("\n").filter((line) => line.trim());
      
      if (lines.length < 2) {
        alert("CSV file must have at least a header row and one data row");
        return;
      }

      // Simple CSV parsing (handles quoted fields)
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          const nextChar = line[i + 1];

          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseCSVLine(lines[0]);
      const rows: CSVRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row: CSVRow = {};
        headers.forEach((header, index) => {
          row[header.trim()] = (values[index] || "").trim().replace(/^"|"$/g, "");
        });
        rows.push(row);
      }

      setCsvHeaders(headers.map((h) => h.trim().replace(/^"|"$/g, "")));
      setCsvData(rows);

      // Auto-map fields
      const autoMapping = autoMapFields(
        headers.map((h) => h.trim().replace(/^"|"$/g, "")),
        availableFields
      );
      setMapping(autoMapping);

      setStep("map");
    } catch (error: any) {
      alert(`Error parsing CSV: ${error.message}`);
    }
  };

  const handleMappingChange = (csvHeader: string, field: string) => {
    setMapping((prev) => ({
      ...prev,
      [csvHeader]: field
    }));
  };

  const handlePreview = () => {
    setStep("preview");
  };

  // Validate preview rows
  const validatePreviewRow = (row: CSVRow, rowIndex: number): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const rowData: any = {};

    // Map fields
    Object.keys(mapping).forEach((csvHeader) => {
      const field = mapping[csvHeader];
      if (!field) return;
      let value: any = row[csvHeader];
      if (value !== null && value !== undefined) {
        value = String(value).trim();
      }
      if (!value || value === "") {
        value = null;
      }
      rowData[field] = value || null;
    });

    // Handle legacy name field
    if (importType === "contacts" && rowData.name && !rowData.first_name) {
      const { first_name, last_name } = splitFullName(rowData.name);
      rowData.first_name = first_name;
      rowData.last_name = last_name || null;
      delete rowData.name;
    }

    // Check required fields
    const requiredFields = availableFields.filter((f) => f.required).map((f) => f.field);
    for (const requiredField of requiredFields) {
      const value = rowData[requiredField];
      if (!value || (typeof value === "string" && value.trim() === "")) {
        errors.push(`Missing required field: ${requiredField}`);
      }
    }

    // Validate email format if present
    if (rowData.email && !isValidEmail(rowData.email)) {
      errors.push("Invalid email format");
    }

    return { valid: errors.length === 0, errors };
  };

  const handleImport = async () => {
    setIsImporting(true);
    setStep("importing");
    setProgress({ current: 0, total: csvData.length });

    const result: ImportResult = {
      success: 0,
      skipped: 0,
      errors: []
    };

    const supabase = createSupabaseClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      alert("You must be logged in to import");
      setIsImporting(false);
      return;
    }

    // Get required fields
    const requiredFields = availableFields
      .filter((f) => f.required)
      .map((f) => f.field);

    // Prepare data for import
    const dataToImport: any[] = [];
    const errors: ImportResult["errors"] = [];

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const rowData: any = { user_id: user.id };
      let shouldSkip = false;
      let skipReason = "";

      // Map all fields FIRST
      Object.keys(mapping).forEach((csvHeader) => {
        const field = mapping[csvHeader];
        if (!field) return; // Skip unmapped columns

        let value: any = row[csvHeader];
        if (value !== null && value !== undefined) {
          value = String(value).trim();
        }
        if (!value || value === "") {
          value = null;
        }

        // Validate and transform values
        if (field === "email" && value && !isValidEmail(value)) {
          shouldSkip = true;
          skipReason = `Row ${i + 2}: Invalid email format`;
          return;
        }

        if (
          (field === "website" || field === "linkedin_url" || field === "company_website") &&
          value &&
          !isValidUrl(value)
        ) {
          value = value.startsWith("http") ? value : `https://${value}`;
        }

        // Convert numeric fields
        if (
          ["employee_count", "annual_revenue", "company_size", "company_headcount"].includes(
            field
          ) &&
          value
        ) {
          const num = Number(value.replace(/[^0-9.-]/g, ""));
          value = isNaN(num) ? null : num;
        }

        rowData[field] = value || null;
      });

      // Handle legacy "name" field - split into first_name and last_name
      if (importType === "contacts" && rowData.name && !rowData.first_name) {
        const { first_name, last_name } = splitFullName(rowData.name);
        rowData.first_name = first_name;
        rowData.last_name = last_name || null;
        // Remove the legacy name field
        delete rowData.name;
      }

      // Validate required fields AFTER mapping
      if (importOptions.skipMissingRequired) {
        for (const requiredField of requiredFields) {
          const value = rowData[requiredField];
          const isEmpty = !value || (typeof value === "string" && value.trim() === "");
          
          if (isEmpty) {
            shouldSkip = true;
            // Find which CSV column should map to this field
            const mappedColumn = Object.keys(mapping).find(h => mapping[h] === requiredField);
            const fieldLabel = availableFields.find(f => f.field === requiredField)?.label || requiredField;
            
            if (mappedColumn) {
              skipReason = `Row ${i + 2}: Missing required field '${fieldLabel}' (CSV column '${mappedColumn}' is empty or not mapped)`;
            } else {
              skipReason = `Row ${i + 2}: Missing required field '${fieldLabel}' (no CSV column mapped to this field)`;
            }
            
            console.log(`Validation failed for row ${i + 2}:`, {
              requiredField,
              fieldLabel,
              mappedColumn,
              value,
              rowData,
              mapping,
              csvRow: row
            });
            break;
          }
        }
      }

      if (shouldSkip) {
        result.skipped++;
        errors.push({
          row: i + 2,
          data: row,
          reason: skipReason || `Row ${i + 2}: Validation failed`
        });
        continue;
      }

      // Check for duplicates if updateExisting is false
      if (!importOptions.updateExisting) {
        if (importType === "contacts") {
          if (rowData.email) {
            const { data: existing } = await supabase
              .from("contacts")
              .select("id")
              .eq("email", rowData.email)
              .maybeSingle();
            if (existing) {
              result.skipped++;
              errors.push({
                row: i + 2,
                data: row,
                reason: "Duplicate email"
              });
              continue;
            }
          }
        } else {
          if (rowData.name) {
            const { data: existing } = await supabase
              .from("companies")
              .select("id")
              .eq("name", rowData.name)
              .maybeSingle();
            if (existing) {
              result.skipped++;
              errors.push({
                row: i + 2,
                data: row,
                reason: "Duplicate name"
              });
              continue;
            }
          }
        }
      }

      dataToImport.push(rowData);
      setProgress({ current: dataToImport.length, total: csvData.length });
    }

    // Batch import (100 rows at a time)
    const batchSize = 100;
    for (let i = 0; i < dataToImport.length; i += batchSize) {
      const batch = dataToImport.slice(i, i + batchSize);
      
      try {
        if (importOptions.updateExisting && importType === "contacts") {
          // Upsert by email
          const { error } = await supabase.from("contacts").upsert(batch, {
            onConflict: "email"
          });
          if (error) throw error;
        } else if (importOptions.updateExisting && importType === "companies") {
          // Upsert by name
          const { error } = await supabase.from("companies").upsert(batch, {
            onConflict: "name"
          });
          if (error) throw error;
        } else {
          const table = importType === "contacts" ? "contacts" : "companies";
          const { error } = await supabase.from(table).insert(batch);
          if (error) throw error;
        }
        result.success += batch.length;
      } catch (error: any) {
        // Add batch rows to errors
        batch.forEach((_, idx) => {
          const originalRowIndex = i + idx;
          errors.push({
            row: originalRowIndex + 2,
            data: csvData[originalRowIndex],
            reason: error.message || "Import failed"
          });
          result.skipped++;
          result.success--;
        });
      }

      setProgress({ current: Math.min(i + batchSize, dataToImport.length), total: csvData.length });
    }

    setImportResult(result);
    setStep("results");
    setIsImporting(false);
  };

  const handleDownloadSample = () => {
    const fields = importType === "contacts" ? CONTACT_FIELDS : COMPANY_FIELDS;
    const csv = generateSampleCSV(fields);
    const filename = `sample-${importType}-import.csv`;
    downloadCSV(csv, filename);
  };

  const handleDownloadErrors = () => {
    if (!importResult || importResult.errors.length === 0) return;

    const errorHeaders = csvHeaders;
    const errorRows = importResult.errors.map((error) => {
      return errorHeaders.map((header) => {
        const value = error.data[header] || "";
        return `"${String(value).replace(/"/g, '""')}"`;
      });
    });

    const csvContent = [
      errorHeaders.map((h) => `"${h.replace(/"/g, '""')}"`).join(","),
      ...errorRows.map((row) => row.join(","))
    ].join("\n");

    downloadCSV(csvContent, `import-errors-${Date.now()}.csv`);
  };

  const resetImport = () => {
    setFile(null);
    setCsvData([]);
    setCsvHeaders([]);
    setMapping({});
    setImportResult(null);
    setProgress({ current: 0, total: 0 });
    setStep("upload");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Import Data</h1>
          <p className="mt-1 text-sm text-slate-600">
            Import contacts or companies from a CSV file.
          </p>
        </div>
        <button
          onClick={handleDownloadSample}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Download Sample CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => {
            setImportType("contacts");
            resetImport();
          }}
          className={`px-4 py-2 text-sm font-medium ${
            importType === "contacts"
              ? "border-b-2 border-primary text-primary"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Import Contacts
        </button>
        <button
          type="button"
          onClick={() => {
            setImportType("companies");
            resetImport();
          }}
          className={`px-4 py-2 text-sm font-medium ${
            importType === "companies"
              ? "border-b-2 border-primary text-primary"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Import Companies
        </button>
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Step 1: Upload CSV File
          </h2>
          <CSVFileUpload onFileSelected={handleFileSelected} />
          {file && (
            <div className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-sm">
              <p className="font-medium text-slate-900">{file.name}</p>
              <p className="text-xs text-slate-500">
                {(file.size / 1024).toFixed(2)} KB
              </p>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Map Fields */}
      {step === "map" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Step 2: Map CSV Columns
              </h2>
              <button
                onClick={() => setStep("upload")}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                ← Back
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-600">
              Map your CSV columns to CRM fields. Required fields are marked with *.
            </p>
            <FieldMapping
              csvHeaders={csvHeaders}
              availableFields={availableFields}
              mapping={mapping}
              onMappingChange={handleMappingChange}
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setStep("upload")}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePreview}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover"
              >
                Preview Import
              </button>
            </div>
          </div>

          {/* Preview Table */}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">
              CSV Preview (first 5 rows)
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {csvHeaders.map((header) => (
                      <th
                        key={header}
                        className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700"
                      >
                        {header}
                        {mapping[header] && (
                          <span className="ml-1 text-primary">
                            → {availableFields.find((f) => f.field === mapping[header])?.label}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {csvData.slice(0, 5).map((row, idx) => (
                    <tr key={idx}>
                      {csvHeaders.map((header) => (
                        <td key={header} className="px-3 py-2 text-slate-900">
                          {row[header] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Total rows: {csvData.length}
            </p>
          </div>
        </div>
      )}

      {/* Step 3: Preview & Configure */}
      {step === "preview" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Step 3: Configure Import
              </h2>
              <button
                onClick={() => setStep("map")}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                ← Back
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="skipMissing"
                  checked={importOptions.skipMissingRequired}
                  onChange={(e) =>
                    setImportOptions({
                      ...importOptions,
                      skipMissingRequired: e.target.checked
                    })
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <label
                  htmlFor="skipMissing"
                  className="text-sm text-slate-700"
                >
                  <span className="font-medium">Skip rows with missing required fields</span>
                  <p className="mt-1 text-xs text-slate-500">
                    Rows without required fields will be skipped instead of causing import errors.
                  </p>
                </label>
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="updateExisting"
                  checked={importOptions.updateExisting}
                  onChange={(e) =>
                    setImportOptions({
                      ...importOptions,
                      updateExisting: e.target.checked
                    })
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <label
                  htmlFor="updateExisting"
                  className="text-sm text-slate-700"
                >
                  <span className="font-medium">
                    Update existing records if {importType === "contacts" ? "email" : "name"} matches
                  </span>
                  <p className="mt-1 text-xs text-slate-500">
                    Existing records will be updated instead of creating duplicates.
                  </p>
                </label>
              </div>

              {importType === "contacts" && (
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="createCompanies"
                    checked={importOptions.createCompanies}
                    onChange={(e) =>
                      setImportOptions({
                        ...importOptions,
                        createCompanies: e.target.checked
                      })
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <label
                    htmlFor="createCompanies"
                    className="text-sm text-slate-700"
                  >
                    <span className="font-medium">Create companies automatically if they don't exist</span>
                    <p className="mt-1 text-xs text-slate-500">
                      Companies will be created for contact records if they don't already exist.
                    </p>
                  </label>
                </div>
              )}
            </div>

            {/* Validation Summary */}
            {csvData.length > 0 && (() => {
              const previewRows = csvData.slice(0, 5);
              const validations = previewRows.map((row, idx) => validatePreviewRow(row, idx));
              const validCount = validations.filter((v) => v.valid).length;
              const invalidCount = validations.filter((v) => !v.valid).length;
              
              return (
                <div className="mt-6 space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold text-slate-900">Preview Validation (first 5 rows)</h3>
                    <div className="space-y-2">
                      {previewRows.map((row, idx) => {
                        const validation = validations[idx];
                        return (
                          <div
                            key={idx}
                            className={`rounded-md border px-3 py-2 text-xs ${
                              validation.valid
                                ? "border-green-200 bg-green-50"
                                : "border-red-200 bg-red-50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">
                                Row {idx + 2}: {validation.valid ? "✓ Valid" : "✗ Invalid"}
                              </span>
                            </div>
                            {validation.errors.length > 0 && (
                              <ul className="mt-1 list-disc pl-4 text-red-700">
                                {validation.errors.map((error, errIdx) => (
                                  <li key={errIdx}>{error}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-xs text-slate-600">
                      Preview: {validCount} valid, {invalidCount} invalid
                    </p>
                  </div>
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm font-medium text-blue-900">Ready to import</p>
                    <p className="mt-1 text-sm text-blue-800">
                      {csvData.length} {importType} will be imported
                      {importOptions.skipMissingRequired && " (rows with missing required fields will be skipped)"}
                    </p>
                  </div>
                </div>
              );
            })()}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setStep("map")}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover"
              >
                Start Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Importing */}
      {step === "importing" && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Importing {importType}...
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">
                Imported {progress.current} of {progress.total}
              </span>
              <span className="font-medium text-slate-900">
                {progress.total > 0
                  ? Math.round((progress.current / progress.total) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${
                    progress.total > 0
                      ? (progress.current / progress.total) * 100
                      : 0
                  }%`
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Results */}
      {step === "results" && importResult && (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Import Complete
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                  Successfully Imported
                </p>
                <p className="mt-2 text-2xl font-bold text-emerald-900">
                  {importResult.success}
                </p>
              </div>
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-yellow-700">
                  Skipped
                </p>
                <p className="mt-2 text-2xl font-bold text-yellow-900">
                  {importResult.skipped}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-700">
                  Total Processed
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {csvData.length}
                </p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Errors ({importResult.errors.length})
                  </h3>
                  <button
                    onClick={handleDownloadErrors}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Download Error Log
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Row</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Error Reason</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Data Preview</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {importResult.errors.map((error, idx) => (
                        <tr key={idx} className="hover:bg-red-50">
                          <td className="px-3 py-2 font-medium text-red-700">{error.row}</td>
                          <td className="px-3 py-2 text-red-700">{error.reason}</td>
                          <td className="px-3 py-2 text-slate-600">
                            <details className="cursor-pointer">
                              <summary className="text-xs text-slate-500 hover:text-slate-700">View data</summary>
                              <pre className="mt-2 max-h-32 overflow-auto rounded bg-slate-50 p-2 text-[10px]">
                                {JSON.stringify(error.data, null, 2)}
                              </pre>
                            </details>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">
                          Row
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">
                          Reason
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {importResult.errors.slice(0, 10).map((error, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 text-slate-900">
                            {error.row}
                          </td>
                          <td className="px-3 py-2 text-red-600">
                            {error.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importResult.errors.length > 10 && (
                    <p className="p-3 text-xs text-slate-500">
                      Showing first 10 errors. Download error log to see all.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={resetImport}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Import Another File
              </button>
              <Link
                href={importType === "contacts" ? "/contacts" : "/companies"}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover"
              >
                View {importType === "contacts" ? "Contacts" : "Companies"}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ImportPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    }>
      <ImportPageContent />
    </Suspense>
  );
}

