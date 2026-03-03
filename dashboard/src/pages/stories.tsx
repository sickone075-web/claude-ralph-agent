import { useState, useCallback, useEffect } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  FileText,
  Server,
  Globe,
  Package,
  Database,
} from "lucide-react";
import { useDashboardStore } from "@/lib/store";
import type { Story, PRD } from "@/lib/types";
import type { RepoStatus } from "@/lib/types";

const typeIcons: Record<string, typeof Database> = {
  docs: FileText,
  backend: Server,
  frontend: Globe,
  app: Package,
  other: Database,
};

function getPriorityColor(priority: number): string {
  if (priority <= 3) return "border-l-red-500";
  if (priority <= 7) return "border-l-amber-500";
  return "border-l-zinc-500";
}

function getPriorityTag(priority: number): { label: string; className: string } {
  if (priority <= 3)
    return { label: "高", className: "bg-gradient-to-r from-red-500/20 to-red-400/10 text-red-400 border-red-500/20" };
  if (priority <= 7)
    return { label: "中", className: "bg-gradient-to-r from-amber-500/20 to-amber-400/10 text-amber-400 border-amber-500/20" };
  return { label: "低", className: "bg-gradient-to-r from-zinc-500/20 to-zinc-400/10 text-zinc-400 border-zinc-500/20" };
}

export default function StoriesPage() {
  const storePrd = useDashboardStore((s) => s.prd);
  const setStorePrd = useDashboardStore((s) => s.setPrd);

  const [repos, setRepos] = useState<RepoStatus[] | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [repoPrd, setRepoPrd] = useState<PRD | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Story | null>(null);

  // Fetch repos on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchRepos() {
      try {
        const res = await fetch("/api/repos");
        const json = await res.json();
        if (!cancelled && json.data) {
          // Only include repos that have stories (totalStories > 0 means prd.json exists)
          const reposWithPrd = (json.data as RepoStatus[]).filter((r) => r.totalStories > 0);
          if (reposWithPrd.length > 0) {
            setRepos(reposWithPrd);
            setSelectedRepo(reposWithPrd[0].name);
          }
        }
      } catch {
        // ignore — single repo mode
      }
    }
    fetchRepos();
    return () => { cancelled = true; };
  }, []);

  // Determine if multi-repo mode
  const isMultiRepo = repos !== null && repos.length > 0;

  // Current PRD: use repo-specific or store's
  const prd = isMultiRepo ? repoPrd : storePrd;
  const setPrd = isMultiRepo ? setRepoPrd : setStorePrd;

  // Build repo query param
  const repoParam = isMultiRepo && selectedRepo ? `?repo=${encodeURIComponent(selectedRepo)}` : "";

  // Fetch repo-specific PRD when repo changes
  useEffect(() => {
    if (!isMultiRepo || !selectedRepo) return;
    let cancelled = false;
    async function fetchRepoPrd() {
      try {
        const res = await fetch(`/api/prd?repo=${encodeURIComponent(selectedRepo!)}`);
        const json = await res.json();
        if (!cancelled && json.data) {
          setRepoPrd(json.data);
        }
      } catch {
        if (!cancelled) setRepoPrd(null);
      }
    }
    fetchRepoPrd();
    return () => { cancelled = true; };
  }, [isMultiRepo, selectedRepo]);

  const stories = prd?.userStories ?? [];
  const sortedStories = [...stories].sort((a, b) => a.priority - b.priority);

  const refreshPrd = useCallback(async () => {
    try {
      const res = await fetch(`/api/prd${repoParam}`);
      const json = await res.json();
      if (json.data) setPrd(json.data);
    } catch {
      // ignore
    }
  }, [setPrd, repoParam]);

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
        await fetch(`/api/prd/stories/${data.id}${repoParam}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } else {
        await fetch(`/api/prd/stories${repoParam}`, {
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
      await fetch(`/api/prd/stories/${story.id}${repoParam}`, {
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
      await fetch(`/api/prd/stories/${deleteTarget.id}${repoParam}`, {
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
        await fetch(`/api/prd/stories/reorder${repoParam}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reorderPayload),
        });
        await refreshPrd();
      } catch {
        // ignore
      }
    },
    [sortedStories, refreshPrd, repoParam]
  );

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-zinc-400" />
          <h2 className="text-xl font-semibold text-zinc-200">用户故事</h2>
          <Badge className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-0 text-xs">
            {stories.length}
          </Badge>
        </div>
        <Button onClick={handleNew} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          新建故事
        </Button>
      </div>

      {isMultiRepo && (
        <Tabs
          value={selectedRepo ?? undefined}
          onValueChange={setSelectedRepo}
          className="mb-4"
        >
          <TabsList variant="line">
            {repos.map((repo) => {
              const Icon = typeIcons[repo.type] ?? Database;
              return (
                <TabsTrigger key={repo.name} value={repo.name}>
                  <Icon className="h-3.5 w-3.5" />
                  {repo.name}
                  <span className="text-xs text-zinc-500 ml-1">
                    {repo.completedStories}/{repo.totalStories}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      )}

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
                        className={`card-glow rounded-lg border border-zinc-800 border-l-4 ${getPriorityColor(
                          story.priority
                        )} bg-zinc-900 p-4 transition-all ${
                          snapshot.isDragging
                            ? "shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/20"
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
                              <CheckCircle2 className="h-4 w-4 text-green-500 transition-all duration-200" />
                            ) : (
                              <Circle className="h-4 w-4 text-zinc-600 transition-all duration-200" />
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
        <div className="flex flex-col items-center justify-center text-center py-16">
          <div className="mb-4 text-cyan-500">
            <BookOpen className="h-16 w-16" strokeWidth={1.5} />
          </div>
          <p className="text-zinc-400 text-lg mb-1">暂无用户故事</p>
          <p className="text-zinc-500 text-sm">点击右上角的&ldquo;新建故事&rdquo;按钮开始创建</p>
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
              删除故事
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              确定要删除{" "}
              <span className="font-mono text-zinc-300">{deleteTarget?.id}</span>{" "}
              &ldquo;{deleteTarget?.title}&rdquo;吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-800 text-zinc-400">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700 transition-all duration-200"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
