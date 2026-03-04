"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderOpen, Loader2, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ApiResponse } from "@/lib/types";
import { useDashboardStore } from "@/lib/store";

interface ProjectConfig {
  name: string;
  path: string;
  repositories?: Record<string, unknown>;
}

interface ProjectsData {
  projects: ProjectConfig[];
  activeProject: string;
}

export function ProjectSwitcher() {
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [activeProject, setActiveProject] = useState("");
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const setPrd = useDashboardStore((s) => s.setPrd);

  useEffect(() => {
    let cancelled = false;
    async function fetchProjects() {
      setLoading(true);
      try {
        const res = await fetch("/api/projects");
        const json: ApiResponse<ProjectsData> = await res.json();
        if (!cancelled && json.data) {
          setProjects(json.data.projects);
          setActiveProject(json.data.activeProject);
        }
      } catch {
        // silently ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchProjects();
    return () => { cancelled = true; };
  }, []);

  const handleSwitch = useCallback(
    async (name: string) => {
      if (name === activeProject) return;
      setSwitching(true);
      try {
        const res = await fetch("/api/projects/active", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const json: ApiResponse<{ activeProject: string }> = await res.json();
        if (json.data) {
          setActiveProject(json.data.activeProject);
          // Refresh PRD
          const prdRes = await fetch("/api/prd");
          if (prdRes.ok) {
            const prdData = await prdRes.json();
            if (prdData.data) setPrd(prdData.data);
          }
        }
      } catch {
        // silently ignore
      } finally {
        setSwitching(false);
      }
    },
    [activeProject, setPrd]
  );

  if (loading || projects.length === 0) return null;

  // Only show switcher if more than 1 project
  if (projects.length <= 1) {
    return (
      <span className="text-sm text-[#666666] font-medium">
        {activeProject}
      </span>
    );
  }

  return (
    <Select value={activeProject} onValueChange={handleSwitch} disabled={switching}>
      <SelectTrigger className="w-auto min-w-[140px] max-w-[240px] h-8 border-[#E0DDD5] bg-white text-[#1A1A18] rounded-lg hover:border-[#C15F3C]/30 transition-colors text-sm px-3 gap-1.5">
        <SelectValue>
          {switching ? (
            <span className="flex items-center gap-1.5 text-[#999999]">
              <Loader2 className="h-3 w-3 animate-spin" />
              切换中...
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5 text-[#C15F3C]" />
              <span className="truncate">{activeProject}</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-white border-[#E0DDD5] shadow-lg rounded-lg">
        <SelectGroup>
          <SelectLabel className="text-[#999999] text-xs uppercase tracking-wider">
            项目
          </SelectLabel>
          {projects.map((project) => (
            <SelectItem
              key={project.name}
              value={project.name}
              className="text-[#1A1A18] focus:bg-[#F5F5F0] focus:text-[#1A1A18]"
            >
              <span className="flex items-center gap-2">
                <FolderOpen
                  className="h-3.5 w-3.5 shrink-0"
                  style={{
                    color: project.name === activeProject ? "#C15F3C" : "#999999",
                  }}
                />
                <span className="truncate">{project.name}</span>
                {project.name === activeProject && (
                  <span className="text-[10px] text-[#C15F3C] font-medium shrink-0">
                    当前
                  </span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
