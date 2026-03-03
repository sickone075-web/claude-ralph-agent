import { useState, useEffect, useCallback } from "react";
import { ChevronDown, Plus, FolderOpen, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useDashboardStore } from "@/lib/store";
import { toast } from "sonner";

interface ProjectInfo {
  name: string;
  path: string;
}

interface ProjectsData {
  projects: ProjectInfo[];
  activeProject: string;
}

export function ProjectSwitcher() {
  const [data, setData] = useState<ProjectsData | null>(null);
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPath, setNewPath] = useState("");

  const setPrd = useDashboardStore((s) => s.setPrd);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const json = await res.json();
      if (json.data) setData(json.data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleSwitch = async (name: string) => {
    if (name === data?.activeProject) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    try {
      const res = await fetch("/api/projects/active", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      // Refresh projects list
      await fetchProjects();
      // Refresh dashboard PRD data
      setPrd(null); // triggers skeleton
      const prdRes = await fetch("/api/prd");
      const prdJson = await prdRes.json();
      if (prdJson.data) setPrd(prdJson.data);
      toast.success(`已切换到项目「${name}」`);
    } catch {
      toast.error("切换项目失败");
    } finally {
      setSwitching(false);
      setOpen(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newPath.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), path: newPath.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "添加项目失败");
        return;
      }
      await fetchProjects();
      setDialogOpen(false);
      setNewName("");
      setNewPath("");
      toast.success(`项目「${newName.trim()}」已添加`);
    } catch {
      toast.error("添加项目失败");
    } finally {
      setAdding(false);
    }
  };

  // No projects state
  if (data && data.projects.length === 0) {
    return (
      <div className="px-4 pb-3">
        <button
          onClick={() => setDialogOpen(true)}
          className="w-full flex items-center gap-2 rounded-md border border-dashed border-zinc-700 px-3 py-2 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          点击添加你的第一个项目
        </button>
        <AddProjectDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          newName={newName}
          setNewName={setNewName}
          newPath={newPath}
          setNewPath={setNewPath}
          adding={adding}
          onAdd={handleAdd}
        />
      </div>
    );
  }

  if (!data) return null;

  const activeLabel =
    data.projects.find((p) => p.name === data.activeProject)?.name ??
    "选择项目";

  return (
    <div className="px-4 pb-3">
      {/* Dropdown trigger */}
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between gap-2 rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <span className="flex items-center gap-2 truncate">
            <FolderOpen className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
            <span className="truncate">{activeLabel}</span>
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-zinc-400 shrink-0 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Dropdown menu */}
        {open && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border border-zinc-800 bg-zinc-950 shadow-lg overflow-hidden">
            {switching && (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-cyan-500" />
              </div>
            )}
            {!switching && (
              <>
                <div className="max-h-48 overflow-y-auto py-1">
                  {data.projects.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => handleSwitch(p.name)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                    >
                      <span className="w-4 shrink-0">
                        {p.name === data.activeProject && (
                          <Check className="h-3.5 w-3.5 text-cyan-500" />
                        )}
                      </span>
                      <span className="truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-zinc-800">
                  <button
                    onClick={() => {
                      setOpen(false);
                      setDialogOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    添加项目
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Click outside to close */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      <AddProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        newName={newName}
        setNewName={setNewName}
        newPath={newPath}
        setNewPath={setNewPath}
        adding={adding}
        onAdd={handleAdd}
      />
    </div>
  );
}

function AddProjectDialog({
  open,
  onOpenChange,
  newName,
  setNewName,
  newPath,
  setNewPath,
  adding,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newName: string;
  setNewName: (v: string) => void;
  newPath: string;
  setNewPath: (v: string) => void;
  adding: boolean;
  onAdd: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">添加项目</DialogTitle>
          <DialogDescription className="text-zinc-400">
            输入项目名称和绝对路径来添加新项目。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-zinc-300">项目名称</Label>
            <Input
              className="bg-zinc-900 border-zinc-700 text-zinc-200"
              placeholder="my-project"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-300">项目路径</Label>
            <Input
              className="bg-zinc-900 border-zinc-700 text-zinc-200"
              placeholder="/home/user/projects/my-project"
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600"
            onClick={onAdd}
            disabled={adding || !newName.trim() || !newPath.trim()}
          >
            {adding && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            添加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
