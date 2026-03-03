import { Router, type Request, type Response } from "express";
import { readPrd, writePrd, getNextStoryId } from "../../src/lib/prd-file";
import type { Story } from "../../src/lib/types";

export const prdRouter = Router();

// GET /api/prd
prdRouter.get("/", (req: Request, res: Response) => {
  try {
    const repo = (req.query.repo as string) || undefined;
    const prd = readPrd(repo);
    res.json({ data: prd, error: null });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      res.status(404).json({ data: null, error: "PRD file not found" });
      return;
    }
    res.status(500).json({ data: null, error: "Failed to read PRD file" });
  }
});

// PATCH /api/prd
prdRouter.patch("/", async (req: Request, res: Response) => {
  try {
    const repo = (req.query.repo as string) || undefined;
    const body = req.body;
    const prd = readPrd(repo);

    if (typeof body.project === "string") prd.project = body.project;
    if (typeof body.branchName === "string") prd.branchName = body.branchName;
    if (typeof body.description === "string") prd.description = body.description;

    await writePrd(prd, repo);
    res.json({ data: prd, error: null });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      res.status(404).json({ data: null, error: "PRD file not found" });
      return;
    }
    res.status(500).json({ data: null, error: "Failed to update PRD" });
  }
});

// GET /api/prd/stories
prdRouter.get("/stories", (req: Request, res: Response) => {
  try {
    const repo = (req.query.repo as string) || undefined;
    const prd = readPrd(repo);
    const stories: Story[] = prd.userStories ?? [];
    res.json({ data: stories, error: null });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      res.status(404).json({ data: null, error: "PRD file not found" });
      return;
    }
    res.status(500).json({ data: null, error: "Failed to read PRD file" });
  }
});

// POST /api/prd/stories
prdRouter.post("/stories", async (req: Request, res: Response) => {
  try {
    const repo = (req.query.repo as string) || undefined;
    const body = req.body;

    if (!body.title || typeof body.title !== "string" || body.title.trim() === "") {
      res.status(400).json({ data: null, error: "title is required" });
      return;
    }

    const prd = readPrd(repo);
    const newStory: Story = {
      id: getNextStoryId(prd.userStories),
      title: body.title.trim(),
      description: typeof body.description === "string" ? body.description : "",
      acceptanceCriteria: Array.isArray(body.acceptanceCriteria) ? body.acceptanceCriteria : [],
      priority: typeof body.priority === "number" ? body.priority : prd.userStories.length + 1,
      passes: false,
      notes: typeof body.notes === "string" ? body.notes : "",
    };

    prd.userStories.push(newStory);
    await writePrd(prd, repo);

    res.status(201).json({ data: newStory, error: null });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      res.status(404).json({ data: null, error: "PRD file not found" });
      return;
    }
    res.status(500).json({ data: null, error: "Failed to create story" });
  }
});

// PATCH /api/prd/stories/reorder
prdRouter.patch("/stories/reorder", async (req: Request, res: Response) => {
  try {
    const repo = (req.query.repo as string) || undefined;
    const body = req.body;

    if (!Array.isArray(body)) {
      res.status(400).json({ data: null, error: "Request body must be an array of { id, priority }" });
      return;
    }

    const prd = readPrd(repo);

    for (const item of body as Array<{ id: string; priority: number }>) {
      if (typeof item.id !== "string" || typeof item.priority !== "number") continue;
      const story = prd.userStories.find((s) => s.id === item.id);
      if (story) {
        story.priority = item.priority;
      }
    }

    await writePrd(prd, repo);
    res.json({ data: prd.userStories, error: null });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      res.status(404).json({ data: null, error: "PRD file not found" });
      return;
    }
    res.status(500).json({ data: null, error: "Failed to reorder stories" });
  }
});

// GET /api/prd/stories/:id
prdRouter.get("/stories/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const repo = (req.query.repo as string) || undefined;
    const prd = readPrd(repo);
    const stories: Story[] = prd.userStories ?? [];
    const story = stories.find((s) => s.id === id);

    if (!story) {
      res.status(404).json({ data: null, error: `Story '${id}' not found` });
      return;
    }

    res.json({ data: story, error: null });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      res.status(404).json({ data: null, error: "PRD file not found" });
      return;
    }
    res.status(500).json({ data: null, error: "Failed to read PRD file" });
  }
});

// PUT /api/prd/stories/:id
prdRouter.put("/stories/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const repo = (req.query.repo as string) || undefined;
    const body = req.body;
    const prd = readPrd(repo);
    const index = prd.userStories.findIndex((s) => s.id === id);

    if (index === -1) {
      res.status(404).json({ data: null, error: `Story '${id}' not found` });
      return;
    }

    const existing = prd.userStories[index];
    const updated: Story = {
      id: existing.id,
      title: typeof body.title === "string" ? body.title : existing.title,
      description: typeof body.description === "string" ? body.description : existing.description,
      acceptanceCriteria: Array.isArray(body.acceptanceCriteria) ? body.acceptanceCriteria : existing.acceptanceCriteria,
      priority: typeof body.priority === "number" ? body.priority : existing.priority,
      passes: typeof body.passes === "boolean" ? body.passes : existing.passes,
      notes: typeof body.notes === "string" ? body.notes : existing.notes,
    };

    prd.userStories[index] = updated;
    await writePrd(prd, repo);

    res.json({ data: updated, error: null });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      res.status(404).json({ data: null, error: "PRD file not found" });
      return;
    }
    res.status(500).json({ data: null, error: "Failed to update story" });
  }
});

// DELETE /api/prd/stories/:id
prdRouter.delete("/stories/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const repo = (req.query.repo as string) || undefined;
    const prd = readPrd(repo);
    const index = prd.userStories.findIndex((s) => s.id === id);

    if (index === -1) {
      res.status(404).json({ data: null, error: `Story '${id}' not found` });
      return;
    }

    const deleted = prd.userStories.splice(index, 1)[0];
    await writePrd(prd, repo);

    res.json({ data: deleted, error: null });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      res.status(404).json({ data: null, error: "PRD file not found" });
      return;
    }
    res.status(500).json({ data: null, error: "Failed to delete story" });
  }
});
