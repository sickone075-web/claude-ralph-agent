import { Router, type Request, type Response } from "express";
import { startRalph, stopRalph, sendStdin, isRunning, getRalphStatus } from "../../src/lib/ralph-process";

export const ralphRouter = Router();

// GET /api/ralph/status
ralphRouter.get("/status", (_req: Request, res: Response) => {
  const status = getRalphStatus();
  res.json({ data: status, error: null });
});

// POST /api/ralph/start
ralphRouter.post("/start", async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const tool = body.tool === "claude" ? "claude" : "amp";
    const maxIterations =
      typeof body.maxIterations === "number" && body.maxIterations > 0
        ? body.maxIterations
        : 10;

    startRalph({ tool, maxIterations });

    res.json({
      data: { status: "running", tool, maxIterations },
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start Ralph";
    if (message === "Ralph is already running") {
      res.status(409).json({ data: null, error: message });
    } else {
      res.status(500).json({ data: null, error: message });
    }
  }
});

// POST /api/ralph/stop
ralphRouter.post("/stop", (_req: Request, res: Response) => {
  try {
    if (!isRunning()) {
      res.status(400).json({ data: null, error: "Ralph is not running" });
      return;
    }
    stopRalph();
    res.json({ data: { status: "stopped" }, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to stop Ralph";
    res.status(500).json({ data: null, error: message });
  }
});

// POST /api/ralph/stdin
ralphRouter.post("/stdin", (req: Request, res: Response) => {
  try {
    if (!isRunning()) {
      res.status(400).json({ data: null, error: "Ralph is not running" });
      return;
    }
    if (typeof req.body.input !== "string") {
      res.status(400).json({ data: null, error: "input is required and must be a string" });
      return;
    }
    sendStdin(req.body.input);
    res.json({ data: { sent: true }, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send input";
    res.status(500).json({ data: null, error: message });
  }
});
