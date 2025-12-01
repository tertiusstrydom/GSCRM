"use client";

import { useEffect, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase";
import type { Tag } from "@/lib/types";
import { TagBadge } from "@/components/TagBadge";
import { getUserRole, canEdit, canDelete, type Role } from "@/lib/permissions";

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

export default function TagsSettingsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");
  const [userRole, setUserRole] = useState<Role>("viewer");

  useEffect(() => {
    const loadData = async () => {
      const supabase = createSupabaseClient();
      const role = await getUserRole();
      setUserRole(role);

      const { data, error: tagsError } = await supabase
        .from("tags")
        .select("*")
        .order("name", { ascending: true });

      if (tagsError) {
        setError(tagsError.message);
      } else {
        setTags(data || []);
      }
      setLoading(false);
    };

    void loadData();
  }, []);

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      alert("Tag name is required");
      return;
    }

    const supabase = createSupabaseClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      alert("You must be logged in");
      return;
    }

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
      alert("Failed to create tag: " + error.message);
    } else {
      setTags([...tags, data]);
      setNewTagName("");
      setNewTagColor("#6366f1");
    }
  };

  const handleUpdateTag = async (tag: Tag) => {
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from("tags")
      .update({
        name: tag.name,
        color: tag.color
      })
      .eq("id", tag.id);

    if (error) {
      alert("Failed to update tag: " + error.message);
    } else {
      setTags(tags.map((t) => (t.id === tag.id ? tag : t)));
      setEditingTag(null);
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!confirm("Delete this tag? It will be removed from all contacts and companies.")) {
      return;
    }

    const supabase = createSupabaseClient();
    const { error } = await supabase.from("tags").delete().eq("id", id);

    if (error) {
      alert("Failed to delete tag: " + error.message);
    } else {
      setTags(tags.filter((t) => t.id !== id));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tag Management</h1>
          <p className="mt-1 text-sm text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tag Management</h1>
        <p className="mt-1 text-sm text-slate-600">
          Create and manage tags to organize your contacts and companies.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {canEdit(userRole) && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Create New Tag</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Tag Name
              </label>
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="e.g., VIP, Prospect, Partner"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Color
              </label>
              <div className="mt-1 flex gap-2">
                {presetColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewTagColor(color)}
                    className={`h-8 w-8 rounded-full border-2 ${
                      newTagColor === color
                        ? "border-slate-800"
                        : "border-slate-300"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCreateTag}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover"
            >
              Create Tag
            </button>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">All Tags</h2>
        {tags.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No tags created yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {tags.map((tag) =>
              editingTag?.id === tag.id ? (
                <div
                  key={tag.id}
                  className="flex items-center gap-3 rounded border border-slate-200 bg-slate-50 p-3"
                >
                  <input
                    type="text"
                    value={editingTag.name}
                    onChange={(e) =>
                      setEditingTag({ ...editingTag, name: e.target.value })
                    }
                    className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                  <div className="flex gap-1">
                    {presetColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() =>
                          setEditingTag({ ...editingTag, color })
                        }
                        className={`h-6 w-6 rounded-full border-2 ${
                          editingTag.color === color
                            ? "border-slate-800"
                            : "border-slate-300"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUpdateTag(editingTag)}
                    className="rounded bg-primary px-2 py-1 text-xs font-medium text-white hover:bg-primary-hover"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTag(null)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div
                  key={tag.id}
                  className="flex items-center justify-between rounded border border-slate-200 p-3"
                >
                  <TagBadge tag={tag} size="md" />
                  {canEdit(userRole) && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingTag(tag)}
                        className="text-xs font-medium text-slate-700 hover:underline"
                      >
                        Edit
                      </button>
                      {canDelete(userRole) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteTag(tag.id)}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </section>
    </div>
  );
}


