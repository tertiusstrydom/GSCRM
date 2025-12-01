"use client";

import { useState, useEffect } from "react";
import { createSupabaseClient } from "@/lib/supabase";

export default function DuplicateSettingsPage() {
  const [settings, setSettings] = useState({
    blockExactEmailDuplicates: true,
    warnSimilarCompanyNames: true,
    fuzzyMatchSensitivity: 80,
    autoSuggestMerge: false
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Settings are stored in localStorage for now
  // In production, you'd store these in a database table
  useEffect(() => {
    const savedSettings = localStorage.getItem("duplicateSettings");
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error("Error loading duplicate settings:", e);
      }
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("duplicateSettings", JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Duplicate Prevention Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Configure how the system detects and prevents duplicate records.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="space-y-6">
          {/* Block Exact Email Duplicates */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-900">
                Block Exact Email Duplicates
              </label>
              <p className="mt-1 text-xs text-slate-500">
                Prevent creating contacts with the same email address.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={settings.blockExactEmailDuplicates}
                onChange={(e) =>
                  setSettings({ ...settings, blockExactEmailDuplicates: e.target.checked })
                }
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-2 peer-focus:ring-primary peer-focus:ring-offset-2"></div>
            </label>
          </div>

          {/* Warn Similar Company Names */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-900">
                Warn on Similar Company Names
              </label>
              <p className="mt-1 text-xs text-slate-500">
                Show warnings when creating companies with similar names (e.g., "ABC Corp" vs "ABC Corporation").
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={settings.warnSimilarCompanyNames}
                onChange={(e) =>
                  setSettings({ ...settings, warnSimilarCompanyNames: e.target.checked })
                }
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-2 peer-focus:ring-primary peer-focus:ring-offset-2"></div>
            </label>
          </div>

          {/* Fuzzy Match Sensitivity */}
          <div>
            <label className="block text-sm font-medium text-slate-900">
              Fuzzy Match Sensitivity: {settings.fuzzyMatchSensitivity}%
            </label>
            <p className="mt-1 mb-3 text-xs text-slate-500">
              Adjust how strict the similarity matching is. Higher values mean more strict (only very similar names match).
            </p>
            <input
              type="range"
              min="50"
              max="100"
              value={settings.fuzzyMatchSensitivity}
              onChange={(e) =>
                setSettings({ ...settings, fuzzyMatchSensitivity: parseInt(e.target.value) })
              }
              className="w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-slate-500">
              <span>Loose</span>
              <span>Strict</span>
            </div>
          </div>

          {/* Auto-Suggest Merge */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-900">
                Auto-Suggest Merge
              </label>
              <p className="mt-1 text-xs text-slate-500">
                Suggest merging records when exact matches are found within 24 hours.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={settings.autoSuggestMerge}
                onChange={(e) =>
                  setSettings({ ...settings, autoSuggestMerge: e.target.checked })
                }
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-2 peer-focus:ring-primary peer-focus:ring-offset-2"></div>
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover"
          >
            {saved ? "✓ Saved" : "Save Settings"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h3 className="text-sm font-medium text-blue-900">Tips</h3>
        <ul className="mt-2 list-disc list-inside space-y-1 text-xs text-blue-800">
          <li>Use "Find Duplicates" tool to clean up existing duplicates</li>
          <li>Adjust fuzzy match sensitivity based on your data quality</li>
          <li>Higher sensitivity (90%+) reduces false positives but may miss some duplicates</li>
        </ul>
      </div>
    </div>
  );
}

