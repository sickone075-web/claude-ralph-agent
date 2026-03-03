"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings, RotateCcw, Save, Send, Eye, EyeOff } from "lucide-react";
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
  defaultTool: "claude" | "amp";
  defaultMaxIterations: number;
  timeoutMinutes: number;
  maxConsecutiveFailures: number;
  retryIntervalSeconds: number;
  webhookUrl: string;
  gitBashPath: string;
  terminalFontSize: number;
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
  borderLeft: '3px solid transparent',
  borderImage: 'linear-gradient(to bottom, #06B6D4, #3B82F6) 1',
  borderImageSlice: 1,
};

const inputClassName = "bg-zinc-950 border-zinc-700 focus:ring-cyan-500/30 focus:border-cyan-500/50";

export default function SettingsPage() {
  const [config, setConfig] = useState<SettingsConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [showWebhookUrl, setShowWebhookUrl] = useState(false);
  const [isWindows, setIsWindows] = useState(false);

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
    // Detect Windows by checking navigator.platform or userAgent
    setIsWindows(navigator.platform?.startsWith("Win") || /Windows/i.test(navigator.userAgent));
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
          <Settings className="h-5 w-5 text-zinc-400" />
          <h2 className="text-xl font-semibold">设置</h2>
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
        {/* Notification Configuration */}
        <Card className="p-4 bg-zinc-900 border-zinc-800" style={cardStyle}>
          <h3 className="text-sm font-medium text-zinc-300 mb-4">通知配置</h3>
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
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
              <p className="text-xs text-zinc-500">飞书群机器人 Webhook 地址，用于接收 Ralph 运行通知</p>
            </div>
          </div>
        </Card>

        <Separator className="bg-zinc-800" />

        {/* Fault Tolerance Configuration */}
        <Card className="p-4 bg-zinc-900 border-zinc-800" style={cardStyle}>
          <h3 className="text-sm font-medium text-zinc-300 mb-4">容错配置</h3>
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
              <p className="text-xs text-zinc-500">单次 Ralph 运行的最大超时时间（5-120 分钟，默认：30）</p>
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
              <p className="text-xs text-zinc-500">连续失败多少次后暂停运行（1-20，默认：5）</p>
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
              <p className="text-xs text-zinc-500">失败后重试的等待时间（60-7200 秒，默认：3600）</p>
            </div>
          </div>
        </Card>

        <Separator className="bg-zinc-800" />

        {/* Environment Configuration */}
        <Card className="p-4 bg-zinc-900 border-zinc-800" style={cardStyle}>
          <h3 className="text-sm font-medium text-zinc-300 mb-4">环境配置</h3>
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
                <p className="text-xs text-zinc-500">Windows 上 Git Bash 的完整路径</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="defaultTool">AI 工具</Label>
              <Select
                value={config.defaultTool}
                onValueChange={(value: "claude" | "amp") => setConfig({ ...config, defaultTool: value })}
              >
                <SelectTrigger id="defaultTool" className="bg-zinc-950 border-zinc-700 w-48">
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
              <p className="text-xs text-zinc-500">每次 Ralph 运行的最大迭代次数（默认：10）</p>
            </div>
          </div>
        </Card>

        <Separator className="bg-zinc-800" />

        {/* Interface */}
        <Card className="p-4 bg-zinc-900 border-zinc-800" style={cardStyle}>
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
