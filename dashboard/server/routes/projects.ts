import { Router, type Request, type Response } from "express";
import fs from "fs";
import { getConfig, writeConfig } from "../../src/lib/config";
import type { ProjectConfig } from "../../src/lib/config";

export const projectsRouter = Router();

// GET /api/projects
projectsRouter.get("/", (_req: Request, res: Response) => {
  const config = getConfig();
  res.json({
    data: { projects: config.projects, activeProject: config.activeProject },
    error: null,
  });
});

// POST /api/projects
projectsRouter.post("/", (req: Request, res: Response) => {
  try {
    const { name, path: projectPath } = req.body as { name?: string; path?: string };

    if (!name || !projectPath) {
      res.status(400).json({ data: null, error: "name and path are required" });
      return;
    }

    if (!fs.existsSync(projectPath)) {
      res.status(400).json({ data: null, error: `Path does not exist: ${projectPath}` });
      return;
    }

    const config = getConfig();

    if (config.projects.some((p) => p.name === name)) {
      res.status(409).json({ data: null, error: `Project "${name}" already exists` });
      return;
    }

    config.projects.push({ name, path: projectPath });
    if (!config.activeProject) {
      config.activeProject = name;
    }
    writeConfig(config);

    res.json({
      data: { projects: config.projects, activeProject: config.activeProject },
      error: null,
    });
  } catch {
    res.status(500).json({ data: null, error: "Failed to add project" });
  }
});

// PUT /api/projects/active
projectsRouter.put("/active", (req: Request, res: Response) => {
  try {
    const { name } = req.body as { name?: string };

    if (!name) {
      res.status(400).json({ data: null, error: "name is required" });
      return;
    }

    const config = getConfig();

    if (!config.projects.some((p) => p.name === name)) {
      res.status(404).json({ data: null, error: `Project "${name}" not found` });
      return;
    }

    config.activeProject = name;
    writeConfig(config);

    res.json({ data: { activeProject: config.activeProject }, error: null });
  } catch {
    res.status(500).json({ data: null, error: "Failed to switch project" });
  }
});

// DELETE /api/projects/:name
projectsRouter.delete("/:name", (req: Request, res: Response) => {
  try {
    const name = decodeURIComponent(req.params.name);

    if (!name) {
      res.status(400).json({ data: null, error: "name is required" });
      return;
    }

    const config = getConfig();

    const idx = config.projects.findIndex((p) => p.name === name);
    if (idx === -1) {
      res.status(404).json({ data: null, error: `Project "${name}" not found` });
      return;
    }

    config.projects.splice(idx, 1);

    if (config.activeProject === name) {
      config.activeProject = config.projects.length > 0 ? config.projects[0].name : "";
    }

    writeConfig(config);

    res.json({
      data: { projects: config.projects, activeProject: config.activeProject },
      error: null,
    });
  } catch {
    res.status(500).json({ data: null, error: "Failed to delete project" });
  }
});
