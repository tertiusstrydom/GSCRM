"use client";

import { useState, useEffect, useRef } from "react";
import { createSupabaseClient } from "@/lib/supabase";
import type { Tag } from "@/lib/types";
import { TagBadge } from "./TagBadge";

type TagSelectorProps = {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  placeholder?: string;
};

export function TagSelector({
  selectedTagIds,
  onChange,
  placeholder = "Select tags..."
}: TagSelectorProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const presetColors = [
    "#6366f1", // indigo
    "#ef4444", // red
    "#10b981", // green
    "#f59e0b", // amber
    "#3b82f6", // blue
    "#8b5cf6", // purple
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#f97316", // orange
    "#84cc16" // lime
  ];

  useEffect(() => {
    const loadTags = async () => {
      const supabase = createSupabaseClient();
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        console.error("Error loading tags:", error);
      } else {
        setTags(data || []);
      }
      setLoading(false);
    };

    void loadTags();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setShowCreateForm(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    const supabase = createSupabaseClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("tags")
      .insert({
        name: newTagName.trim(),
        color: newTagColor,
        user_id: user.id
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating tag:", error);
      alert("Failed to create tag: " + error.message);
    } else {
      setTags([...tags, data]);
      onChange([...selectedTagIds, data.id]);
      setNewTagName("");
      setShowCreateForm(false);
    }
  };

  const selectedTags = tags.filter((tag) => selectedTagIds.includes(tag.id));
  const availableTags = tags.filter((tag) => !selectedTagIds.includes(tag.id));

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <div className="flex flex-wrap gap-1">
          {selectedTags.length > 0 ? (
            selectedTags.map((tag) => (
              <TagBadge key={tag.id} tag={tag} size="sm" />
            ))
          ) : (
            <span className="text-slate-500">{placeholder}</span>
          )}
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="max-h-60 overflow-y-auto p-2">
            {loading ? (
              <div className="p-2 text-sm text-slate-500">Loading tags...</div>
            ) : (
              <>
                {availableTags.length > 0 && (
                  <div className="space-y-1">
                    {availableTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleToggleTag(tag.id)}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100"
                      >
                        <TagBadge tag={tag} size="sm" />
                      </button>
                    ))}
                  </div>
                )}

                {!showCreateForm ? (
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(true)}
                    className="mt-2 w-full rounded border border-dashed border-slate-300 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    + Create new tag
                  </button>
                ) : (
                  <div className="mt-2 space-y-2 rounded border border-slate-200 bg-slate-50 p-2">
                    <input
                      type="text"
                      placeholder="Tag name"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">Color:</span>
                      <div className="flex gap-1">
                        {presetColors.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setNewTagColor(color)}
                            className={`h-6 w-6 rounded-full border-2 ${
                              newTagColor === color
                                ? "border-slate-800"
                                : "border-slate-300"
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCreateTag}
                        className="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-white hover:bg-primary-hover"
                      >
                        Create
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateForm(false);
                          setNewTagName("");
                        }}
                        className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


