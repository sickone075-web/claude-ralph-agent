import { Router, type Request, type Response } from "express";
import { getConfig, writeConfig, DEFAULTS } from "../../src/lib/config";
import type { DashboardConfig } from "../../src/lib/config";

export const configRouter = Router();

// GET /api/config
configRouter.get("/", (_req: Request, res: Response) => {
  try {
    const config = getConfig();
    res.json({ data: config, error: null });
  } catch {
    res.status(500).json({ data: null, error: "Failed to read config" });
  }
});

// POST /api/config
configRouter.post("/", (req: Request, res: Response) => {
  try {
    const config = writeConfig(req.body);
    res.json({ data: config, error: null });
  } catch {
    res.status(500).json({ data: null, error: "Failed to save config" });
  }
});

// DELETE /api/config
configRouter.delete("/", (_req: Request, res: Response) => {
  try {
    const config = writeConfig(DEFAULTS);
    res.json({ data: config, error: null });
  } catch {
    res.status(500).json({ data: null, error: "Failed to reset config" });
  }
});

// POST /api/config/test-webhook
configRouter.post("/test-webhook", async (req: Request, res: Response) => {
  try {
    const { webhookUrl } = req.body;

    if (!webhookUrl) {
      res.status(400).json({ data: null, error: "Webhook URL 不能为空" });
      return;
    }

    const cardMessage = {
      msg_type: "interactive",
      card: {
        header: {
          title: { tag: "plain_text", content: "🧪 Ralph 测试消息" },
          template: "blue",
        },
        elements: [
          {
            tag: "div",
            text: {
              tag: "lark_md",
              content: "✅ 飞书 Webhook 连接测试成功！\n\n此消息由 Ralph Web 控制台发送。",
            },
          },
        ],
      },
    };

    const fetchRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cardMessage),
    });

    const result = await fetchRes.json();

    if (result.code === 0 || result.StatusCode === 0) {
      res.json({ data: { success: true }, error: null });
    } else {
      res.status(400).json({
        data: null,
        error: `飞书返回错误: ${result.msg || result.Message || JSON.stringify(result)}`,
      });
    }
  } catch (e) {
    res.status(500).json({
      data: null,
      error: `发送失败: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
});
