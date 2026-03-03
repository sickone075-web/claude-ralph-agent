import { Draggable } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import type { Story } from "@/lib/types";

function getPriorityColor(priority: number): string {
  if (priority <= 3) return "border-l-red-500";
  if (priority <= 7) return "border-l-amber-500";
  return "border-l-zinc-500";
}

function getPriorityLabel(priority: number): string {
  if (priority <= 3) return "高";
  if (priority <= 7) return "中";
  return "低";
}

interface KanbanCardProps {
  story: Story;
  index: number;
  isRunning?: boolean;
  onClick: () => void;
  readOnly?: boolean;
}

export function KanbanCard({
  story,
  index,
  isRunning,
  onClick,
  readOnly,
}: KanbanCardProps) {
  return (
    <Draggable
      draggableId={story.id}
      index={index}
      isDragDisabled={readOnly}
    >
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`card-glow rounded-lg border border-zinc-800 border-l-4 ${getPriorityColor(
            story.priority
          )} bg-zinc-900 p-3 cursor-pointer transition-all hover:bg-zinc-800/70 ${
            snapshot.isDragging ? "shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/30" : ""
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <Badge
              variant="outline"
              className="shrink-0 text-xs font-mono border-zinc-700 text-zinc-400"
            >
              {story.id}
            </Badge>
            {isRunning ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-green-500" />
            ) : story.passes ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-zinc-600" />
            )}
          </div>
          <p className="mt-2 text-sm text-zinc-200 line-clamp-2">
            {story.title}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-zinc-500">
              P{story.priority} &middot; {getPriorityLabel(story.priority)}
            </span>
          </div>
        </div>
      )}
    </Draggable>
  );
}
