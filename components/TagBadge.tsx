"use client";

import type { Tag } from "@/lib/types";

type TagBadgeProps = {
  tag: Tag;
  onRemove?: () => void;
  size?: "sm" | "md" | "lg";
};

export function TagBadge({ tag, onRemove, size = "md" }: TagBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-xs px-2 py-1",
    lg: "text-sm px-2.5 py-1.5"
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses[size]}`}
      style={{
        backgroundColor: `${tag.color}20`,
        color: tag.color,
        border: `1px solid ${tag.color}40`
      }}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 rounded-full hover:bg-black/10"
          style={{ color: tag.color }}
        >
          ×
        </button>
      )}
    </span>
  );
}

