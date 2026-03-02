"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { SkeletonCard } from "@/components/skeleton-card";

interface SettingsConfig {
  prdPath: string;
  progressPath: string;
  ralphScriptPath: string;
  defaultTool: "claude" | "amp";
  defaultMaxIterations: number;
  terminalFontSize: number;
}

const DEFAULTS: SettingsConfig = {
  prdPath: "../scripts/ralph/prd.json",
  progressPath: "../scripts/ralph/progress.txt",
  ralphScriptPath: "../scripts/ralph/ralph.sh",
  defaultTool: "claude",
  defaultMaxIterations: 10,
  terminalFontSize: 14,
};

export default function SettingsPage() {
  const [config, setConfig] = useState<SettingsConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

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

  if (loading) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="flex items-center gap-2 mb-6">
          <Settings className="h-5 w-5 text-zinc-400" />
          <h2 className="text-xl font-semibold">设置</h2>
        </div>
        <div className="space-y-6">
          <SkeletonCard className="h-64" />
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
          <Settings className="h-5 w-5 text-zinc-400" />
          <h2 className="text-xl font-semibold">设置</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={saving} className="transition-all duration-200">
            <RotateCcw className="h-4 w-4 mr-1" />
            恢复默认
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-0 card-glow">
            <Save className="h-4 w-4 mr-1" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Path Configuration */}
        <Card className="p-4 bg-zinc-900 border-zinc-800" style={{ borderLeft: '3px solid transparent', borderImage: 'linear-gradient(to bottom, #06B6D4, #3B82F6) 1', borderImageSlice: 1 }}>
          <h3 className="text-sm font-medium text-zinc-300 mb-4">路径配置</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ralphScriptPath">Ralph 脚本路径</Label>
              <Input
                id="ralphScriptPath"
                value={config.ralphScriptPath}
                onChange={(e) => setConfig({ ...config, ralphScriptPath: e.target.value })}
                placeholder="../scripts/ralph/ralph.sh"
                className="bg-zinc-950 border-zinc-700 focus:ring-cyan-500/30 focus:border-cyan-500/50"
              />
              <p className="text-xs text-zinc-500">ralph.sh 脚本的路径</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prdPath">PRD 文件路径</Label>
              <Input
                id="prdPath"
                value={config.prdPath}
                onChange={(e) => setConfig({ ...config, prdPath: e.target.value })}
                placeholder="../scripts/ralph/prd.json"
                className="bg-zinc-950 border-zinc-700 focus:ring-cyan-500/30 focus:border-cyan-500/50"
              />
              <p className="text-xs text-zinc-500">prd.json 文件的路径</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="progressPath">进度文件路径</Label>
              <Input
                id="progressPath"
                value={config.progressPath}
                onChange={(e) => setConfig({ ...config, progressPath: e.target.value })}
                placeholder="../scripts/ralph/progress.txt"
                className="bg-zinc-950 border-zinc-700 focus:ring-cyan-500/30 focus:border-cyan-500/50"
              />
              <p className="text-xs text-zinc-500">progress.txt 文件的路径</p>
            </div>
          </div>
        </Card>

        <Separator className="bg-zinc-800" />

        {/* Default Parameters */}
        <Card className="p-4 bg-zinc-900 border-zinc-800" style={{ borderLeft: '3px solid transparent', borderImage: 'linear-gradient(to bottom, #06B6D4, #3B82F6) 1', borderImageSlice: 1 }}>
          <h3 className="text-sm font-medium text-zinc-300 mb-4">默认参数</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="defaultTool">默认 AI 工具</Label>
              <Select
                value={config.defaultTool}
                onValueChange={(value: "claude" | "amp") => setConfig({ ...config, defaultTool: value })}
              >
                <SelectTrigger id="defaultTool" className="bg-zinc-950 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude">Claude</SelectItem>
                  <SelectItem value="amp">Amp</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-500">启动 Ralph 时使用的 AI 工具</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultMaxIterations">默认最大迭代次数</Label>
              <Input
                id="defaultMaxIterations"
                type="number"
                min={1}
                max={100}
                value={config.defaultMaxIterations}
                onChange={(e) => setConfig({ ...config, defaultMaxIterations: parseInt(e.target.value) || 10 })}
                className="bg-zinc-950 border-zinc-700 w-32 focus:ring-cyan-500/30 focus:border-cyan-500/50"
              />
              <p className="text-xs text-zinc-500">每次 Ralph 运行的最大迭代次数（默认：10）</p>
            </div>
          </div>
        </Card>

        <Separator className="bg-zinc-800" />

        {/* Interface */}
        <Card className="p-4 bg-zinc-900 border-zinc-800" style={{ borderLeft: '3px solid transparent', borderImage: 'linear-gradient(to bottom, #06B6D4, #3B82F6) 1', borderImageSlice: 1 }}>
          <h3 className="text-sm font-medium text-zinc-300 mb-4">界面</h3>
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="terminalFontSize">终端字体大小</Label>
                <span className="text-sm text-zinc-400 font-mono">{config.terminalFontSize}px</span>
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
              <div className="flex justify-between text-xs text-zinc-500">
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
