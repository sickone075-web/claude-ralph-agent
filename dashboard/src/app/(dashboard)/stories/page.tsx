"use client";

import { useState, useCallback } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StorySheet } from "@/components/story-sheet";
import {
  BookOpen,
  Plus,
  CheckCircle2,
  Circle,
  GripVertical,
  Trash2,
} from "lucide-react";
import { useDashboardStore } from "@/lib/store";
import type { Story } from "@/lib/types";

function getPriorityColor(priority: number): string {
  if (priority <= 3) return "border-l-red-500";
  if (priority <= 7) return "border-l-amber-500";
  return "border-l-zinc-500";
}

function getPriorityTag(priority: number): { label: string; className: string } {
  if (priority <= 3)
    return { label: "High", className: "bg-red-500/10 text-red-400 border-red-500/20" };
  if (priority <= 7)
    return { label: "Medium", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
  return { label: "Low", className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" };
}

export default function StoriesPage() {
  const prd = useDashboardStore((s) => s.prd);
  const setPrd = useDashboardStore((s) => s.setPrd);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Story | null>(null);

  const stories = prd?.userStories ?? [];
  const sortedStories = [...stories].sort((a, b) => a.priority - b.priority);

  const refreshPrd = useCallback(async () => {
    try {
      const res = await fetch("/api/prd");
      const json = await res.json();
      if (json.data) setPrd(json.data);
    } catch {
      // ignore
    }
  }, [setPrd]);

  function handleNew() {
    setEditingStory(null);
    setSheetOpen(true);
  }

  function handleEdit(story: Story) {
    setEditingStory(story);
    setSheetOpen(true);
  }

  async function handleSave(data: Partial<Story> & { title: string }) {
    try {
      if (data.id) {
        await fetch(`/api/prd/stories/${data.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } else {
        await fetch("/api/prd/stories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }
      await refreshPrd();
    } catch {
      // ignore
    }
  }

  async function handleTogglePasses(story: Story) {
    try {
      await fetch(`/api/prd/stories/${story.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passes: !story.passes }),
      });
      await refreshPrd();
    } catch {
      // ignore
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/prd/stories/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setDeleteTarget(null);
      await refreshPrd();
    } catch {
      // ignore
    }
  }

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination) return;
      const srcIdx = result.source.index;
      const destIdx = result.destination.index;
      if (srcIdx === destIdx) return;

      const reordered = [...sortedStories];
      const [moved] = reordered.splice(srcIdx, 1);
      reordered.splice(destIdx, 0, moved);

      const reorderPayload = reordered.map((s, i) => ({
        id: s.id,
        priority: i + 1,
      }));

      try {
        await fetch("/api/prd/stories/reorder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reorderPayload),
        });
        await refreshPrd();
      } catch {
        // ignore
      }
    },
    [sortedStories, refreshPrd]
  );

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-zinc-400" />
          <h2 className="text-xl font-semibold text-zinc-200">User Stories</h2>
        </div>
        <Button onClick={handleNew} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          New Story
        </Button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="stories">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="space-y-2"
            >
              {sortedStories.map((story, index) => {
                const priorityTag = getPriorityTag(story.priority);
                return (
                  <Draggable
                    key={story.id}
                    draggableId={story.id}
                    index={index}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`rounded-lg border border-zinc-800 border-l-4 ${getPriorityColor(
                          story.priority
                        )} bg-zinc-900 p-4 transition-colors ${
                          snapshot.isDragging
                            ? "shadow-lg shadow-black/50 ring-1 ring-zinc-700"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            {...provided.dragHandleProps}
                            className="cursor-grab text-zinc-600 hover:text-zinc-400"
                          >
                            <GripVertical className="h-4 w-4" />
                          </div>

                          <Badge
                            variant="outline"
                            className="shrink-0 font-mono text-xs border-zinc-700 text-zinc-400"
                          >
                            {story.id}
                          </Badge>

                          <button
                            onClick={() => handleEdit(story)}
                            className="flex-1 text-left text-sm text-zinc-200 hover:text-white truncate"
                          >
                            {story.title}
                          </button>

                          <Badge
                            variant="outline"
                            className={`shrink-0 text-xs ${priorityTag.className}`}
                          >
                            {priorityTag.label}
                          </Badge>

                          <div
                            className="flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Switch
                              checked={story.passes}
                              onCheckedChange={() => handleTogglePasses(story)}
                              aria-label={`Toggle passes for ${story.id}`}
                            />
                            {story.passes ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <Circle className="h-4 w-4 text-zinc-600" />
                            )}
                          </div>

                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(story);
                            }}
                            className="shrink-0 text-zinc-600 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {sortedStories.length === 0 && (
        <div className="text-center text-zinc-500 py-12">
          No stories yet. Click &ldquo;New Story&rdquo; to create one.
        </div>
      )}

      <StorySheet
        story={editingStory}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSave={handleSave}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="bg-zinc-950 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-200">
              Delete Story
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Are you sure you want to delete{" "}
              <span className="font-mono text-zinc-300">{deleteTarget?.id}</span>{" "}
              &ldquo;{deleteTarget?.title}&rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-800 text-zinc-400">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
