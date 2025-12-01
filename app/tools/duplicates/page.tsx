"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase";
import type { Contact, Company } from "@/lib/types";
import {
  groupDuplicateContacts,
  groupDuplicateCompanies,
  findFuzzyCompanyMatches,
  normalizeName
} from "@/lib/duplicate-utils";
import { DuplicateGroup } from "@/components/DuplicateGroup";

type TabType = "contacts" | "companies";

export default function FindDuplicatesPage() {
  const [activeTab, setActiveTab] = useState<TabType>("contacts");
  const [loading, setLoading] = useState(false);
  const [contactDuplicates, setContactDuplicates] = useState<Map<string, Contact[]>>(new Map());
  const [companyDuplicates, setCompanyDuplicates] = useState<Map<string, Company[]>>(new Map());
  const [fuzzyCompanyMatches, setFuzzyCompanyMatches] = useState<Array<{ companies: Company[]; similarity: number }>>([]);

  const scanForDuplicates = async () => {
    setLoading(true);
    try {
      if (activeTab === "contacts") {
        const duplicates = await groupDuplicateContacts();
        setContactDuplicates(duplicates);
      } else {
        const [duplicates, fuzzy] = await Promise.all([
          groupDuplicateCompanies(),
          findFuzzyCompanyMatches(0.8)
        ]);
        setCompanyDuplicates(duplicates);
        setFuzzyCompanyMatches(fuzzy);
      }
    } catch (error: any) {
      alert(`Error scanning for duplicates: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordDeleted = () => {
    // Reload duplicates after deletion
    void scanForDuplicates();
  };

  const handleRecordsMerged = () => {
    // Reload duplicates after merge
    void scanForDuplicates();
  };

  const totalContactDuplicates = Array.from(contactDuplicates.values()).reduce(
    (sum, group) => sum + group.length,
    0
  );
  const totalCompanyDuplicates = Array.from(companyDuplicates.values()).reduce(
    (sum, group) => sum + group.length,
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Find Duplicates</h1>
        <p className="mt-1 text-sm text-slate-600">
          Identify and merge duplicate contacts and companies in your CRM.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("contacts")}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === "contacts"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            Contact Duplicates
            {totalContactDuplicates > 0 && (
              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                {totalContactDuplicates}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("companies")}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === "companies"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            Company Duplicates
            {totalCompanyDuplicates > 0 && (
              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                {totalCompanyDuplicates}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Scan Button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Click "Scan for Duplicates" to identify potential duplicate records.
        </p>
        <button
          onClick={scanForDuplicates}
          disabled={loading}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Scanning...
            </>
          ) : (
            <>
              <svg
                className="mr-2 h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              Scan for Duplicates
            </>
          )}
        </button>
      </div>

      {/* Results */}
      {activeTab === "contacts" && (
        <div className="space-y-4">
          {contactDuplicates.size === 0 && !loading ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
              <svg
                className="mx-auto h-12 w-12 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="mt-4 text-sm font-medium text-slate-900">No duplicates found</h3>
              <p className="mt-2 text-sm text-slate-500">
                Click "Scan for Duplicates" to check for duplicate contacts.
              </p>
            </div>
          ) : (
            Array.from(contactDuplicates.entries()).map(([email, contacts]) => (
              <DuplicateGroup
                key={email}
                entityType="contact"
                records={contacts}
                matchKey={email}
                onDeleted={handleRecordDeleted}
                onMerged={handleRecordsMerged}
              />
            ))
          )}
        </div>
      )}

      {activeTab === "companies" && (
        <div className="space-y-4">
          {/* Exact Duplicates */}
          {companyDuplicates.size > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Exact Duplicates</h2>
              <div className="space-y-4">
                {Array.from(companyDuplicates.entries()).map(([name, companies]) => (
                  <DuplicateGroup
                    key={name}
                    entityType="company"
                    records={companies}
                    matchKey={name}
                    onDeleted={handleRecordDeleted}
                    onMerged={handleRecordsMerged}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Fuzzy Matches */}
          {fuzzyCompanyMatches.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Similar Companies</h2>
              <p className="mb-3 text-xs text-slate-500">
                These companies have similar names but may not be exact duplicates. Review carefully before merging.
              </p>
              <div className="space-y-4">
                {fuzzyCompanyMatches.map((match, index) => (
                  <DuplicateGroup
                    key={`fuzzy-${index}`}
                    entityType="company"
                    records={match.companies}
                    matchKey={`Similar (${Math.round(match.similarity * 100)}% match)`}
                    similarity={match.similarity}
                    onDeleted={handleRecordDeleted}
                    onMerged={handleRecordsMerged}
                  />
                ))}
              </div>
            </div>
          )}

          {companyDuplicates.size === 0 && fuzzyCompanyMatches.length === 0 && !loading && (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
              <svg
                className="mx-auto h-12 w-12 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="mt-4 text-sm font-medium text-slate-900">No duplicates found</h3>
              <p className="mt-2 text-sm text-slate-500">
                Click "Scan for Duplicates" to check for duplicate companies.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

