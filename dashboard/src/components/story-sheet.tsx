"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import type { Story } from "@/lib/types";

interface StorySheetProps {
  story: Story | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Partial<Story> & { title: string }) => void;
}

function priorityToLabel(priority: number): string {
  if (priority <= 3) return "high";
  if (priority <= 7) return "medium";
  return "low";
}

function labelToPriority(label: string, existingPriority?: number): number {
  switch (label) {
    case "high":
      return existingPriority && existingPriority <= 3 ? existingPriority : 1;
    case "medium":
      return existingPriority && existingPriority >= 4 && existingPriority <= 7
        ? existingPriority
        : 5;
    case "low":
      return existingPriority && existingPriority >= 8 ? existingPriority : 10;
    default:
      return 5;
  }
}

export function StorySheet({ story, open, onOpenChange, onSave }: StorySheetProps) {
  const isEdit = !!story;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [criteria, setCriteria] = useState<string[]>([""]);
  const [priorityLabel, setPriorityLabel] = useState("medium");

  useEffect(() => {
    if (story) {
      setTitle(story.title);
      setDescription(story.description);
      setNotes(story.notes);
      setCriteria(story.acceptanceCriteria.length > 0 ? [...story.acceptanceCriteria] : [""]);
      setPriorityLabel(priorityToLabel(story.priority));
    } else {
      setTitle("");
      setDescription("");
      setNotes("");
      setCriteria([""]);
      setPriorityLabel("medium");
    }
  }, [story, open]);

  function handleSave() {
    if (!title.trim()) return;
    const filteredCriteria = criteria.filter((c) => c.trim() !== "");
    onSave({
      ...(story ? { id: story.id } : {}),
      title: title.trim(),
      description,
      notes,
      acceptanceCriteria: filteredCriteria,
      priority: labelToPriority(priorityLabel, story?.priority),
    });
    onOpenChange(false);
  }

  function addCriterion() {
    setCriteria([...criteria, ""]);
  }

  function removeCriterion(index: number) {
    setCriteria(criteria.filter((_, i) => i !== index));
  }

  function updateCriterion(index: number, value: string) {
    const updated = [...criteria];
    updated[index] = value;
    setCriteria(updated);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg bg-zinc-950 border-zinc-800 overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-zinc-200">
            {isEdit ? `Edit ${story.id}` : "New Story"}
          </SheetTitle>
          <SheetDescription className="text-zinc-500">
            {isEdit ? "Update the story details below." : "Fill in the details for the new story."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          <div>
            <Label className="text-zinc-400">Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Story title"
              className="mt-1 bg-zinc-900 border-zinc-800 text-zinc-200"
            />
          </div>

          <div>
            <Label className="text-zinc-400">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="As a user, I want..."
              className="mt-1 bg-zinc-900 border-zinc-800 text-zinc-200"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-zinc-400">Acceptance Criteria</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={addCriterion}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            <div className="mt-1 space-y-2">
              {criteria.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={c}
                    onChange={(e) => updateCriterion(i, e.target.value)}
                    className="bg-zinc-900 border-zinc-800 text-zinc-200 text-sm"
                    placeholder={`Criterion ${i + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCriterion(i)}
                    className="shrink-0 text-zinc-500 hover:text-red-400"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-zinc-400">Priority</Label>
            <Select value={priorityLabel} onValueChange={setPriorityLabel}>
              <SelectTrigger className="mt-1 bg-zinc-900 border-zinc-800 text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-zinc-400">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Additional notes..."
              className="mt-1 bg-zinc-900 border-zinc-800 text-zinc-200"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-zinc-800 text-zinc-400"
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!title.trim()}>
              {isEdit ? "Save Changes" : "Create Story"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
