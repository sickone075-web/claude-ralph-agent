import { useCallback, useState } from "react";
import {
  DragDropContext,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { KanbanCard } from "@/components/kanban-card";
import { StoryEditDialog } from "@/components/story-edit-dialog";
import type { Story } from "@/lib/types";

interface KanbanBoardProps {
  stories: Story[];
  currentStoryId?: string | null;
  ralphRunning?: boolean;
  onUpdateStory?: (story: Partial<Story>) => void;
  readOnly?: boolean;
}

function categorizeStories(
  stories: Story[],
  currentStoryId?: string | null
): { pending: Story[]; inProgress: Story[]; completed: Story[] } {
  const pending: Story[] = [];
  const inProgress: Story[] = [];
  const completed: Story[] = [];

  for (const story of stories) {
    if (story.passes) {
      completed.push(story);
    } else if (currentStoryId && story.id === currentStoryId) {
      inProgress.push(story);
    } else {
      pending.push(story);
    }
  }

  return { pending, inProgress, completed };
}

const columnConfig = [
  { id: "pending", title: "待处理", color: "text-amber-500", dot: "bg-amber-500" },
  { id: "inProgress", title: "进行中", color: "text-cyan-500", dot: "bg-cyan-500" },
  { id: "completed", title: "已完成", color: "text-green-500", dot: "bg-green-500" },
] as const;

export function KanbanBoard({
  stories,
  currentStoryId,
  ralphRunning,
  onUpdateStory,
  readOnly,
}: KanbanBoardProps) {
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { pending, inProgress, completed } = categorizeStories(
    stories,
    currentStoryId
  );

  const columns: Record<string, Story[]> = {
    pending,
    inProgress,
    completed,
  };

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (readOnly || !onUpdateStory) return;
      const { draggableId, destination } = result;
      if (!destination) return;

      const destColumn = destination.droppableId;
      if (destColumn === "completed") {
        onUpdateStory({ id: draggableId, passes: true });
      } else if (destColumn === "pending" || destColumn === "inProgress") {
        onUpdateStory({ id: draggableId, passes: false });
      }
    },
    [readOnly, onUpdateStory]
  );

  function handleCardClick(story: Story) {
    if (readOnly) return;
    setEditingStory(story);
    setDialogOpen(true);
  }

  function handleSave(updated: Partial<Story>) {
    onUpdateStory?.(updated);
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {columnConfig.map((col) => (
            <div key={col.id} className="flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <div className={`h-2 w-2 rounded-full ${col.dot}`} />
                <h3 className={`text-sm font-medium ${col.color}`}>
                  {col.title}
                </h3>
                <span className="text-xs text-zinc-500 ml-auto">
                  {columns[col.id].length}
                </span>
              </div>
              <Droppable droppableId={col.id} isDropDisabled={readOnly}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 rounded-lg border border-zinc-800/50 p-2 min-h-[120px] space-y-2 transition-colors ${
                      snapshot.isDraggingOver ? "bg-cyan-500/5 border-cyan-500/20" : "bg-zinc-900/30"
                    }`}
                  >
                    {columns[col.id].map((story, index) => (
                      <KanbanCard
                        key={story.id}
                        story={story}
                        index={index}
                        isRunning={
                          col.id === "inProgress" && ralphRunning
                        }
                        onClick={() => handleCardClick(story)}
                        readOnly={readOnly}
                      />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      <StoryEditDialog
        story={editingStory}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
      />
    </>
  );
}
