import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { webhookUrl } = await request.json();

    if (!webhookUrl) {
      return NextResponse.json(
        { data: null, error: "Webhook URL 不能为空" } satisfies ApiResponse<null>,
        { status: 400 }
      );
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

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cardMessage),
    });

    const result = await res.json();

    if (result.code === 0 || result.StatusCode === 0) {
      return NextResponse.json(
        { data: { success: true }, error: null } satisfies ApiResponse<{ success: boolean }>
      );
    }

    return NextResponse.json(
      { data: null, error: `飞书返回错误: ${result.msg || result.Message || JSON.stringify(result)}` } satisfies ApiResponse<null>,
      { status: 400 }
    );
  } catch (e) {
    return NextResponse.json(
      { data: null, error: `发送失败: ${e instanceof Error ? e.message : String(e)}` } satisfies ApiResponse<null>,
      { status: 500 }
    );
  }
}
