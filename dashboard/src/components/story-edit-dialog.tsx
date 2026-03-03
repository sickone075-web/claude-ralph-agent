import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, Circle, Plus, X } from "lucide-react";
import type { Story } from "@/lib/types";

interface StoryEditDialogProps {
  story: Story | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (story: Partial<Story>) => void;
}

export function StoryEditDialog({
  story,
  open,
  onOpenChange,
  onSave,
}: StoryEditDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [criteria, setCriteria] = useState<string[]>([]);
  const [passes, setPasses] = useState(false);

  useEffect(() => {
    if (story) {
      setTitle(story.title);
      setDescription(story.description);
      setNotes(story.notes);
      setCriteria([...story.acceptanceCriteria]);
      setPasses(story.passes);
    }
  }, [story]);

  function handleSave() {
    if (!story) return;
    onSave({
      id: story.id,
      title,
      description,
      notes,
      acceptanceCriteria: criteria.filter((c) => c.trim() !== ""),
      passes,
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

  if (!story) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="font-mono border-zinc-700 text-zinc-400"
            >
              {story.id}
            </Badge>
            <span className="bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">编辑故事</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-zinc-400">标题</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 bg-zinc-900 border-zinc-800 text-zinc-200 focus:ring-cyan-500/30 focus:border-cyan-500/50"
            />
          </div>

          <div>
            <Label className="text-zinc-400">描述</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 bg-zinc-900 border-zinc-800 text-zinc-200 focus:ring-cyan-500/30 focus:border-cyan-500/50"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-zinc-400">验收标准</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={addCriterion}
                className="text-zinc-400 hover:text-cyan-400 transition-colors duration-200"
              >
                <Plus className="h-3 w-3 mr-1" /> 添加
              </Button>
            </div>
            <div className="mt-1 space-y-2">
              {criteria.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={c}
                    onChange={(e) => updateCriterion(i, e.target.value)}
                    className="bg-zinc-900 border-zinc-800 text-zinc-200 text-sm focus:ring-cyan-500/30 focus:border-cyan-500/50"
                    placeholder={`条件 ${i + 1}`}
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
            <Label className="text-zinc-400">备注</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 bg-zinc-900 border-zinc-800 text-zinc-200 focus:ring-cyan-500/30 focus:border-cyan-500/50"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-zinc-400 flex items-center gap-2">
              {passes ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Circle className="h-4 w-4 text-zinc-600" />
              )}
              通过状态
            </Label>
            <Switch checked={passes} onCheckedChange={setPasses} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-zinc-800 text-zinc-400"
            >
              取消
            </Button>
            <Button onClick={handleSave} className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 transition-all duration-200">保存修改</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
