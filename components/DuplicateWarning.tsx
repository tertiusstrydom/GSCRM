"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DuplicateWarningProps = {
  show: boolean;
  message: string;
  duplicateRecord?: {
    id: string;
    name: string;
    entityType: "contact" | "company";
    companyName?: string;
  };
  onProceed?: () => void;
  onDismiss?: () => void;
  checking?: boolean;
};

export function DuplicateWarning({
  show,
  message,
  duplicateRecord,
  onProceed,
  onDismiss,
  checking = false
}: DuplicateWarningProps) {
  if (!show) return null;

  return (
    <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4 mb-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {checking ? (
            <div className="h-5 w-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg
              className="h-5 w-5 text-yellow-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            {checking ? "Checking for duplicates..." : "⚠️ Potential Duplicate Found"}
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>{message}</p>
            {duplicateRecord && (
              <p className="mt-1 font-medium">
                Existing record: {duplicateRecord.name}
                {duplicateRecord.companyName && ` at ${duplicateRecord.companyName}`}
              </p>
            )}
          </div>
          <div className="mt-3 flex gap-3">
            {duplicateRecord && (
              <Link
                href={`/${duplicateRecord.entityType}s/${duplicateRecord.id}`}
                className="text-sm font-medium text-yellow-800 underline hover:text-yellow-900"
              >
                View existing {duplicateRecord.entityType}
              </Link>
            )}
            {onProceed && (
              <button
                onClick={onProceed}
                className="text-sm font-medium text-yellow-800 underline hover:text-yellow-900"
              >
                Create anyway
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-sm font-medium text-yellow-800 underline hover:text-yellow-900"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
