"use client";

import { useState, useEffect, useCallback } from "react";
import type { Story, StoryStatus } from "@/lib/types";
import { useDashboardStore } from "@/lib/store";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  X,
  Check,
  Circle,
  FileText,
  ScrollText,
  GitCommitHorizontal,
  Clock,
  Pencil,
  Plus,
  Loader2,
} from "lucide-react";
import { StoryLogTab } from "./story-log-tab";
import { StoryGitTab } from "./story-git-tab";

// --- Helpers ---

function getStatusLabel(story: Story): { label: string; color: string; bg: string } {
  const status = story.status ?? (story.passes ? "completed" : "pending");
  switch (status) {
    case "completed":
      return { label: "已完成", color: "#22C55E", bg: "#ECFDF5" };
    case "running":
      return { label: "执行中", color: "#C15F3C", bg: "#FEF0E8" };
    case "failed":
      return { label: "失败", color: "#EF4444", bg: "#FEF2F2" };
    default:
      return { label: "待执行", color: "#B1ADA1", bg: "#F5F5F0" };
  }
}

function getPriorityLabel(priority: number): string {
  if (priority <= 2) return "高优先级";
  if (priority <= 5) return "中优先级";
  return "低优先级";
}

// --- Props ---

interface StoryDetailPanelProps {
  story: Story | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly?: boolean;
}

export function StoryDetailPanel({
  story,
  open,
  onOpenChange,
  readOnly = false,
}: StoryDetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editCriteria, setEditCriteria] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const setPrd = useDashboardStore((s) => s.setPrd);

  // Reset edit state when story changes or panel closes
  useEffect(() => {
    setIsEditing(false);
    if (story) {
      setEditTitle(story.title);
      setEditDescription(story.description);
      setEditNotes(story.notes);
      setEditCriteria([...story.acceptanceCriteria]);
    }
  }, [story, open]);

  const enterEditMode = useCallback(() => {
    if (!story) return;
    setEditTitle(story.title);
    setEditDescription(story.description);
    setEditNotes(story.notes);
    setEditCriteria([...story.acceptanceCriteria]);
    setIsEditing(true);
  }, [story]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    if (story) {
      setEditTitle(story.title);
      setEditDescription(story.description);
      setEditNotes(story.notes);
      setEditCriteria([...story.acceptanceCriteria]);
    }
  }, [story]);

  const handleSave = useCallback(async () => {
    if (!story) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/prd/stories/${story.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          notes: editNotes,
          acceptanceCriteria: editCriteria.filter((c) => c.trim() !== ""),
        }),
      });
      if (res.ok) {
        // Refresh PRD in store
        const prdRes = await fetch("/api/prd");
        if (prdRes.ok) {
          const prdData = await prdRes.json();
          if (prdData.data) setPrd(prdData.data);
        }
        setIsEditing(false);
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }, [story, editTitle, editDescription, editNotes, editCriteria, setPrd]);

  const addCriterion = useCallback(() => {
    setEditCriteria((prev) => [...prev, ""]);
  }, []);

  const removeCriterion = useCallback((index: number) => {
    setEditCriteria((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateCriterion = useCallback((index: number, value: string) => {
    setEditCriteria((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  }, []);

  if (!story) return null;

  const statusInfo = getStatusLabel(story);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[560px] sm:max-w-[560px] overflow-y-auto bg-white p-0"
        style={{
          borderLeft: "1px solid #E0DDD5",
          boxShadow: "-8px 0 24px rgba(0,0,0,0.04)",
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {/* Story ID */}
              <span
                className="font-mono text-[13px] font-bold"
                style={{ color: "#C15F3C", fontFamily: "'JetBrains Mono', monospace" }}
              >
                {story.id}
              </span>
              {/* Status Badge */}
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: statusInfo.bg,
                  color: statusInfo.color,
                }}
              >
                {statusInfo.label}
              </span>
            </div>
            {/* Close button */}
            <button
              onClick={() => onOpenChange(false)}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-[#F5F5F0]"
            >
              <X className="h-4 w-4" style={{ color: "#999999" }} />
            </button>
          </div>
          {/* Title */}
          <h2
            className="text-[20px] font-semibold leading-tight"
            style={{
              color: "#1A1A18",
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 600,
            }}
          >
            {story.title}
          </h2>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="details" className="flex flex-col flex-1">
          <TabsList
            variant="line"
            className="w-full justify-start px-6 gap-0 border-b"
            style={{ borderColor: "#E0DDD5" }}
          >
            <TabsTrigger
              value="details"
              className="tab-trigger-claude flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-none border-none"
            >
              <FileText className="h-4 w-4" />
              详情
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className="tab-trigger-claude flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-none border-none"
            >
              <ScrollText className="h-4 w-4" />
              日志
            </TabsTrigger>
            <TabsTrigger
              value="git"
              className="tab-trigger-claude flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-none border-none"
            >
              <GitCommitHorizontal className="h-4 w-4" />
              Git
            </TabsTrigger>
            <TabsTrigger
              value="timeline"
              className="tab-trigger-claude flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-none border-none"
            >
              <Clock className="h-4 w-4" />
              时间线
            </TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="px-6 py-5 flex-1 overflow-y-auto">
            <div className="space-y-6">
              {/* Edit button */}
              {!readOnly && !isEditing && (
                <div className="flex justify-end">
                  <button
                    onClick={enterEditMode}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                    style={{
                      backgroundColor: "#F5F5F0",
                      color: "#666666",
                      borderRadius: "8px",
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                    编辑
                  </button>
                </div>
              )}

              {/* Description */}
              <section>
                <label
                  className="block text-[11px] font-semibold uppercase tracking-[1px] mb-2"
                  style={{ color: "#999999", fontFamily: "'Inter', sans-serif" }}
                >
                  描述
                </label>
                {isEditing ? (
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                    className="bg-[#FAFAF7] border-[#E0DDD5] text-[#1A1A18] text-[13px]"
                  />
                ) : (
                  <p
                    className="text-[13px] leading-relaxed"
                    style={{ color: "#1A1A18", fontFamily: "'Inter', sans-serif" }}
                  >
                    {story.description || "暂无描述"}
                  </p>
                )}
              </section>

              {/* Acceptance Criteria */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <label
                    className="text-[11px] font-semibold uppercase tracking-[1px]"
                    style={{ color: "#999999", fontFamily: "'Inter', sans-serif" }}
                  >
                    验收标准
                  </label>
                  {isEditing && (
                    <button
                      onClick={addCriterion}
                      className="flex items-center gap-1 text-xs"
                      style={{ color: "#C15F3C" }}
                    >
                      <Plus className="h-3 w-3" />
                      添加
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    {editCriteria.map((c, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={c}
                          onChange={(e) => updateCriterion(i, e.target.value)}
                          className="bg-[#FAFAF7] border-[#E0DDD5] text-[#1A1A18] text-[13px]"
                          placeholder={`条件 ${i + 1}`}
                        />
                        <button
                          onClick={() => removeCriterion(i)}
                          className="shrink-0 p-1 rounded hover:bg-[#FEF2F2]"
                        >
                          <X className="h-3 w-3" style={{ color: "#EF4444" }} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {story.acceptanceCriteria.map((criterion, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <div className="mt-0.5 flex-shrink-0">
                          {story.passes ? (
                            <div
                              className="flex items-center justify-center w-5 h-5 rounded"
                              style={{ backgroundColor: "#ECFDF5" }}
                            >
                              <Check className="h-3 w-3" style={{ color: "#22C55E" }} />
                            </div>
                          ) : (
                            <div
                              className="flex items-center justify-center w-5 h-5 rounded"
                              style={{ border: "1.5px solid #E0DDD5" }}
                            />
                          )}
                        </div>
                        <span
                          className="text-[13px] leading-relaxed"
                          style={{
                            color: story.passes ? "#1A1A18" : "#666666",
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          {criterion}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Priority */}
              <section>
                <label
                  className="block text-[11px] font-semibold uppercase tracking-[1px] mb-2"
                  style={{ color: "#999999", fontFamily: "'Inter', sans-serif" }}
                >
                  优先级
                </label>
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: "#FEF0E8", color: "#C15F3C" }}
                >
                  P{story.priority} — {getPriorityLabel(story.priority)}
                </span>
              </section>

              {/* Notes */}
              {(story.notes || isEditing) && (
                <section>
                  <label
                    className="block text-[11px] font-semibold uppercase tracking-[1px] mb-2"
                    style={{ color: "#999999", fontFamily: "'Inter', sans-serif" }}
                  >
                    备注
                  </label>
                  {isEditing ? (
                    <Textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={2}
                      className="bg-[#FAFAF7] border-[#E0DDD5] text-[#1A1A18] text-[13px]"
                    />
                  ) : (
                    <p
                      className="text-[13px] leading-relaxed"
                      style={{ color: "#666666", fontFamily: "'Inter', sans-serif" }}
                    >
                      {story.notes}
                    </p>
                  )}
                </section>
              )}

              {/* Edit mode: Title */}
              {isEditing && (
                <section>
                  <label
                    className="block text-[11px] font-semibold uppercase tracking-[1px] mb-2"
                    style={{ color: "#999999", fontFamily: "'Inter', sans-serif" }}
                  >
                    标题
                  </label>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="bg-[#FAFAF7] border-[#E0DDD5] text-[#1A1A18] text-[13px]"
                  />
                </section>
              )}

              {/* Save / Cancel buttons */}
              {isEditing && (
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelEdit}
                    className="border-[#E0DDD5] text-[#666666] hover:bg-[#F5F5F0]"
                  >
                    取消
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving}
                    className="text-white"
                    style={{ backgroundColor: "#C15F3C" }}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      "保存修改"
                    )}
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="px-6 py-5 flex-1 overflow-hidden">
            <StoryLogTab story={story} />
          </TabsContent>

          {/* Git Tab */}
          <TabsContent value="git" className="px-6 py-5 flex-1 overflow-y-auto">
            <StoryGitTab story={story} />
          </TabsContent>

          {/* Timeline Tab - Placeholder */}
          <TabsContent value="timeline" className="px-6 py-5">
            <div className="flex flex-col items-center justify-center py-16">
              <Clock className="h-10 w-10 mb-3" style={{ color: "#B1ADA1" }} />
              <p className="text-sm" style={{ color: "#B1ADA1" }}>
                状态时间线将在后续版本中实现
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
