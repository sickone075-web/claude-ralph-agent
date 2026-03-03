import { NextResponse } from "next/server";
import { startRalph } from "@/lib/ralph-process";
import { getConfig } from "@/lib/config";
import type { ApiResponse } from "@/lib/types";

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is valid — use defaults
    }

    const config = getConfig();

    const tool: "claude" | "amp" =
      body.tool === "claude" || body.tool === "amp"
        ? body.tool
        : config.defaultTool;
    const maxIterations =
      typeof body.maxIterations === "number" && body.maxIterations > 0
        ? body.maxIterations
        : config.defaultMaxIterations;
    const timeout =
      typeof body.timeout === "number" && body.timeout > 0
        ? body.timeout
        : config.timeoutMinutes;
    const webhook =
      typeof body.webhook === "string" && body.webhook
        ? body.webhook
        : config.webhookUrl;

    startRalph({ tool, maxIterations, timeout, webhook });

    return NextResponse.json({
      data: { status: "running", tool, maxIterations, timeout, webhook },
      error: null,
    } satisfies ApiResponse<{ status: string; tool: string; maxIterations: number; timeout: number; webhook: string }>);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start Ralph";
    if (message === "Ralph is already running") {
      return NextResponse.json(
        { data: null, error: message } satisfies ApiResponse<null>,
        { status: 409 }
      );
    }
    return NextResponse.json(
      { data: null, error: message } satisfies ApiResponse<null>,
      { status: 500 }
    );
  }
}
