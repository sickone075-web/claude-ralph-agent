
import { useState, useEffect, useCallback } from "react";
import { Settings, RotateCcw, Save, Send, Eye, EyeOff, FolderOpen, Plus, Trash2, ChevronDown, ChevronRight, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { SkeletonCard } from "@/components/skeleton-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface SettingsConfig {
  defaultTool: "claude" | "amp";
  defaultMaxIterations: number;
  timeoutMinutes: number;
  maxConsecutiveFailures: number;
  retryIntervalSeconds: number;
  webhookUrl: string;
  gitBashPath: string;
  terminalFontSize: number;
}

interface RepoConfig {
  path: string;
  type: "docs" | "backend" | "frontend" | "app" | "other";
  priority: number;
  checks?: string[];
}

interface ProjectConfig {
  name: string;
  path: string;
  repositories?: Record<string, RepoConfig>;
}

const DEFAULTS: SettingsConfig = {
  defaultTool: "claude",
  defaultMaxIterations: 10,
  timeoutMinutes: 30,
  maxConsecutiveFailures: 5,
  retryIntervalSeconds: 3600,
  webhookUrl: "",
  gitBashPath: "",
  terminalFontSize: 14,
};

const cardStyle = {
  borderLeft: '3px solid #C15F3C',
};

const inputClassName = "bg-white border-[#E0DDD5] focus:ring-[#C15F3C]/20 focus:border-[#C15F3C]/50";

export default function SettingsPage() {
  const [config, setConfig] = useState<SettingsConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [showWebhookUrl, setShowWebhookUrl] = useState(false);
  const [isWindows, setIsWindows] = useState(false);

  // Project management state
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [activeProject, setActiveProject] = useState("");
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectPath, setNewProjectPath] = useState("");
  const [addingProject, setAddingProject] = useState(false);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [showAddRepo, setShowAddRepo] = useState<string | null>(null);
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoPath, setNewRepoPath] = useState("");
  const [newRepoType, setNewRepoType] = useState<RepoConfig["type"]>("other");

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      const json = await res.json();
      if (json.data) {
        setConfig(json.data);
      }
    } catch {
      // Use defaults on error
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const json = await res.json();
      if (json.data) {
        setProjects(json.data.projects);
        setActiveProject(json.data.activeProject);
      }
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchProjects();
    setIsWindows(navigator.platform?.startsWith("Win") || /Windows/i.test(navigator.userAgent));
  }, [fetchConfig, fetchProjects]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (json.error) {
        toast.error("保存设置失败", { description: json.error });
      } else {
        setConfig(json.data);
        toast.success("设置已保存");
      }
    } catch {
      toast.error("保存设置失败");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/config", { method: "DELETE" });
      const json = await res.json();
      if (json.data) {
        setConfig(json.data);
        toast.success("设置已恢复默认");
      }
    } catch {
      toast.error("恢复默认设置失败");
    } finally {
      setSaving(false);
    }
  };

  // --- Project management handlers ---
  const handleAddProject = async () => {
    if (!newProjectName.trim() || !newProjectPath.trim()) {
      toast.error("请输入项目名称和路径");
      return;
    }
    setAddingProject(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName.trim(), path: newProjectPath.trim() }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error("添加项目失败", { description: json.error });
      } else {
        setProjects(json.data.projects);
        setActiveProject(json.data.activeProject);
        setShowAddProject(false);
        setNewProjectName("");
        setNewProjectPath("");
        toast.success("项目已添加");
      }
    } catch {
      toast.error("添加项目失败");
    } finally {
      setAddingProject(false);
    }
  };

  const handleDeleteProject = async (name: string) => {
    if (name === activeProject && projects.length === 1) {
      toast.error("不能删除唯一的项目");
      return;
    }
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(name)}`, { method: "DELETE" });
      const json = await res.json();
      if (json.error) {
        toast.error("删除项目失败", { description: json.error });
      } else {
        setProjects(json.data.projects);
        setActiveProject(json.data.activeProject);
        toast.success("项目已删除");
      }
    } catch {
      toast.error("删除项目失败");
    }
  };

  const handleSwitchActiveProject = async (name: string) => {
    try {
      const res = await fetch("/api/projects/active", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (json.data) {
        setActiveProject(json.data.activeProject);
        toast.success(`已切换到项目: ${name}`);
      }
    } catch {
      toast.error("切换项目失败");
    }
  };

  const handleAddRepo = async (projectName: string) => {
    if (!newRepoName.trim() || !newRepoPath.trim()) {
      toast.error("请输入仓库名称和路径");
      return;
    }
    const project = projects.find((p) => p.name === projectName);
    if (!project) return;

    const repos = { ...(project.repositories ?? {}) };
    repos[newRepoName.trim()] = {
      path: newRepoPath.trim(),
      type: newRepoType,
      priority: Object.keys(repos).length + 1,
    };

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositories: repos }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error("添加仓库失败", { description: json.error });
      } else {
        setProjects(json.data.projects);
        setShowAddRepo(null);
        setNewRepoName("");
        setNewRepoPath("");
        setNewRepoType("other");
        toast.success("仓库已添加");
      }
    } catch {
      toast.error("添加仓库失败");
    }
  };

  const handleDeleteRepo = async (projectName: string, repoName: string) => {
    const project = projects.find((p) => p.name === projectName);
    if (!project?.repositories) return;

    const repos = { ...project.repositories };
    delete repos[repoName];

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositories: repos }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error("删除仓库失败", { description: json.error });
      } else {
        setProjects(json.data.projects);
        toast.success("仓库已删除");
      }
    } catch {
      toast.error("删除仓库失败");
    }
  };

  const handleTestWebhook = async () => {
    if (!config.webhookUrl) {
      toast.error("请先输入飞书 Webhook URL");
      return;
    }
    setTestingWebhook(true);
    try {
      const res = await fetch("/api/config/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: config.webhookUrl }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error("测试消息发送失败", { description: json.error });
      } else {
        toast.success("测试消息已发送，请检查飞书群");
      }
    } catch {
      toast.error("测试消息发送失败");
    } finally {
      setTestingWebhook(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="flex items-center gap-2 mb-6">
          <Settings className="h-5 w-5 text-[#B1ADA1]" />
          <h2 className="text-xl font-semibold text-[#1A1A18]">设置</h2>
        </div>
        <div className="space-y-6">
          <SkeletonCard className="h-48" />
          <SkeletonCard className="h-48" />
          <SkeletonCard className="h-48" />
          <SkeletonCard className="h-36" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-[#B1ADA1]" />
          <h2 className="text-xl font-semibold">设置</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={saving} className="transition-all duration-200">
            <RotateCcw className="h-4 w-4 mr-1" />
            恢复默认
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-[#C15F3C] hover:bg-[#A84F32] text-white border-0">
            <Save className="h-4 w-4 mr-1" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Project Management */}
        <Card className="p-4 bg-white border-[#E0DDD5]" style={cardStyle}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[#1A1A18]">项目管理</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddProject(true)}
              className="text-[#C15F3C] border-[#C15F3C]/30 hover:bg-[#FEF0E8]"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              添加项目
            </Button>
          </div>

          {projects.length === 0 ? (
            <p className="text-sm text-[#999999]">暂无项目，请添加一个项目</p>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => {
                const repoCount = project.repositories ? Object.keys(project.repositories).length : 0;
                const isActive = project.name === activeProject;
                const isExpanded = expandedProject === project.name;
                return (
                  <div
                    key={project.name}
                    className="rounded-lg border"
                    style={{
                      borderColor: isActive ? "#C15F3C" : "#E0DDD5",
                      backgroundColor: isActive ? "#FFFBF7" : "#FAFAF7",
                    }}
                  >
                    {/* Project header */}
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          onClick={() => setExpandedProject(isExpanded ? null : project.name)}
                          className="shrink-0 p-0.5 rounded hover:bg-[#F5F5F0]"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-[#999999]" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-[#999999]" />
                          )}
                        </button>
                        <FolderOpen className="h-4 w-4 shrink-0" style={{ color: isActive ? "#C15F3C" : "#999999" }} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[#1A1A18] truncate">{project.name}</span>
                            {isActive && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: "#FEF0E8", color: "#C15F3C" }}>
                                当前
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#999999] truncate">{project.path}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <span className="text-xs text-[#B1ADA1] mr-1">{repoCount} 仓库</span>
                        {!isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSwitchActiveProject(project.name)}
                            className="h-7 text-xs text-[#666666] hover:text-[#C15F3C]"
                          >
                            激活
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteProject(project.name)}
                          disabled={isActive && projects.length === 1}
                          className="h-7 text-xs text-[#999999] hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded: repository list */}
                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-[#E0DDD5]">
                        <div className="pt-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-[#999999] uppercase tracking-wider">仓库</span>
                            <button
                              onClick={() => {
                                setShowAddRepo(project.name);
                                setNewRepoName("");
                                setNewRepoPath("");
                                setNewRepoType("other");
                              }}
                              className="flex items-center gap-1 text-xs text-[#C15F3C] hover:underline"
                            >
                              <Plus className="h-3 w-3" />
                              添加仓库
                            </button>
                          </div>

                          {project.repositories && Object.entries(project.repositories).map(([repoName, repo]) => (
                            <div key={repoName} className="flex items-center justify-between p-2 bg-white rounded border border-[#E0DDD5]">
                              <div className="flex items-center gap-2 min-w-0">
                                <GitBranch className="h-3.5 w-3.5 text-[#B1ADA1] shrink-0" />
                                <span className="text-sm text-[#1A1A18] truncate">{repoName}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F5F5F0] text-[#666666] shrink-0">{repo.type}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                <span className="text-xs text-[#B1ADA1] truncate max-w-[120px]">{repo.path}</span>
                                <button
                                  onClick={() => handleDeleteRepo(project.name, repoName)}
                                  className="p-1 rounded hover:bg-[#FEF2F2]"
                                >
                                  <Trash2 className="h-3 w-3 text-[#999999] hover:text-red-500" />
                                </button>
                              </div>
                            </div>
                          ))}

                          {(!project.repositories || Object.keys(project.repositories).length === 0) && (
                            <p className="text-xs text-[#B1ADA1] py-2">暂无仓库配置</p>
                          )}

                          {/* Add repo inline form */}
                          {showAddRepo === project.name && (
                            <div className="p-3 bg-white rounded border border-[#E0DDD5] space-y-2">
                              <div className="flex gap-2">
                                <Input
                                  placeholder="仓库名称"
                                  value={newRepoName}
                                  onChange={(e) => setNewRepoName(e.target.value)}
                                  className={`${inputClassName} text-sm flex-1`}
                                />
                                <Select value={newRepoType} onValueChange={(v: RepoConfig["type"]) => setNewRepoType(v)}>
                                  <SelectTrigger className="bg-white border-[#E0DDD5] w-28 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="docs">docs</SelectItem>
                                    <SelectItem value="backend">backend</SelectItem>
                                    <SelectItem value="frontend">frontend</SelectItem>
                                    <SelectItem value="app">app</SelectItem>
                                    <SelectItem value="other">other</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <Input
                                placeholder="仓库路径"
                                value={newRepoPath}
                                onChange={(e) => setNewRepoPath(e.target.value)}
                                className={`${inputClassName} text-sm`}
                              />
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setShowAddRepo(null)} className="text-xs h-7">
                                  取消
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleAddRepo(project.name)}
                                  className="text-xs h-7 text-white"
                                  style={{ backgroundColor: "#C15F3C" }}
                                >
                                  添加
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Add Project Dialog */}
        <Dialog open={showAddProject} onOpenChange={setShowAddProject}>
          <DialogContent className="bg-white border-[#E0DDD5]">
            <DialogHeader>
              <DialogTitle className="text-[#1A1A18]">添加项目</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>项目名称</Label>
                <Input
                  placeholder="my-project"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className={inputClassName}
                />
              </div>
              <div className="space-y-2">
                <Label>项目路径</Label>
                <Input
                  placeholder="C:\workspace\my-project"
                  value={newProjectPath}
                  onChange={(e) => setNewProjectPath(e.target.value)}
                  className={inputClassName}
                />
                <p className="text-xs text-[#999999]">项目根目录的绝对路径</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddProject(false)} className="border-[#E0DDD5]">
                取消
              </Button>
              <Button
                onClick={handleAddProject}
                disabled={addingProject || !newProjectName.trim() || !newProjectPath.trim()}
                className="text-white"
                style={{ backgroundColor: "#C15F3C" }}
              >
                {addingProject ? "添加中..." : "添加"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Separator className="bg-[#E0DDD5]" />

        {/* Notification Configuration */}
        <Card className="p-4 bg-white border-[#E0DDD5]" style={cardStyle}>
          <h3 className="text-sm font-medium text-[#1A1A18] mb-4">通知配置</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhookUrl">飞书 Webhook URL</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="webhookUrl"
                    type={showWebhookUrl ? "text" : "password"}
                    value={config.webhookUrl}
                    onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
                    placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
                    className={`${inputClassName} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowWebhookUrl(!showWebhookUrl)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#999999] hover:text-[#666666] transition-colors"
                  >
                    {showWebhookUrl ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestWebhook}
                  disabled={testingWebhook || !config.webhookUrl}
                  className="shrink-0"
                >
                  <Send className="h-4 w-4 mr-1" />
                  {testingWebhook ? "发送中..." : "发送测试消息"}
                </Button>
              </div>
              <p className="text-xs text-[#999999]">飞书群机器人 Webhook 地址，用于接收 Ralph 运行通知</p>
            </div>
          </div>
        </Card>

        <Separator className="bg-[#E0DDD5]" />

        {/* Fault Tolerance Configuration */}
        <Card className="p-4 bg-white border-[#E0DDD5]" style={cardStyle}>
          <h3 className="text-sm font-medium text-[#1A1A18] mb-4">容错配置</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timeoutMinutes">超时时间（分钟）</Label>
              <Input
                id="timeoutMinutes"
                type="number"
                min={5}
                max={120}
                value={config.timeoutMinutes}
                onChange={(e) => setConfig({ ...config, timeoutMinutes: parseInt(e.target.value) || 30 })}
                className={`${inputClassName} w-32`}
              />
              <p className="text-xs text-[#999999]">单次 Ralph 运行的最大超时时间（5-120 分钟，默认：30）</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxConsecutiveFailures">连续失败上限</Label>
              <Input
                id="maxConsecutiveFailures"
                type="number"
                min={1}
                max={20}
                value={config.maxConsecutiveFailures}
                onChange={(e) => setConfig({ ...config, maxConsecutiveFailures: parseInt(e.target.value) || 5 })}
                className={`${inputClassName} w-32`}
              />
              <p className="text-xs text-[#999999]">连续失败多少次后暂停运行（1-20，默认：5）</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="retryIntervalSeconds">重试间隔（秒）</Label>
              <Input
                id="retryIntervalSeconds"
                type="number"
                min={60}
                max={7200}
                value={config.retryIntervalSeconds}
                onChange={(e) => setConfig({ ...config, retryIntervalSeconds: parseInt(e.target.value) || 3600 })}
                className={`${inputClassName} w-32`}
              />
              <p className="text-xs text-[#999999]">失败后重试的等待时间（60-7200 秒，默认：3600）</p>
            </div>
          </div>
        </Card>

        <Separator className="bg-[#E0DDD5]" />

        {/* Environment Configuration */}
        <Card className="p-4 bg-white border-[#E0DDD5]" style={cardStyle}>
          <h3 className="text-sm font-medium text-[#1A1A18] mb-4">环境配置</h3>
          <div className="space-y-4">
            {isWindows && (
              <div className="space-y-2">
                <Label htmlFor="gitBashPath">Git Bash 路径</Label>
                <Input
                  id="gitBashPath"
                  value={config.gitBashPath}
                  onChange={(e) => setConfig({ ...config, gitBashPath: e.target.value })}
                  placeholder="C:\Program Files\Git\bin\bash.exe"
                  className={inputClassName}
                />
                <p className="text-xs text-[#999999]">Windows 上 Git Bash 的完整路径</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="defaultTool">AI 工具</Label>
              <Select
                value={config.defaultTool}
                onValueChange={(value: "claude" | "amp") => setConfig({ ...config, defaultTool: value })}
              >
                <SelectTrigger id="defaultTool" className="bg-white border-[#E0DDD5] w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude">Claude</SelectItem>
                  <SelectItem value="amp">Amp</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-[#999999]">启动 Ralph 时使用的 AI 工具</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultMaxIterations">最大迭代次数</Label>
              <Input
                id="defaultMaxIterations"
                type="number"
                min={1}
                max={100}
                value={config.defaultMaxIterations}
                onChange={(e) => setConfig({ ...config, defaultMaxIterations: parseInt(e.target.value) || 10 })}
                className={`${inputClassName} w-32`}
              />
              <p className="text-xs text-[#999999]">每次 Ralph 运行的最大迭代次数（默认：10）</p>
            </div>
          </div>
        </Card>

        <Separator className="bg-[#E0DDD5]" />

        {/* Interface */}
        <Card className="p-4 bg-white border-[#E0DDD5]" style={cardStyle}>
          <h3 className="text-sm font-medium text-[#1A1A18] mb-4">界面</h3>
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="terminalFontSize">终端字体大小</Label>
                <span className="text-sm text-[#B1ADA1] font-mono">{config.terminalFontSize}px</span>
              </div>
              <Slider
                id="terminalFontSize"
                min={12}
                max={24}
                step={1}
                value={[config.terminalFontSize]}
                onValueChange={([value]) => setConfig({ ...config, terminalFontSize: value })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-[#999999]">
                <span>12px</span>
                <span>24px</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
