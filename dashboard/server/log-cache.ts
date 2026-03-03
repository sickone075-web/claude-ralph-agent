import fs from "fs";
import { getActiveProjectPaths } from "../src/lib/config";

// In-memory log cache keyed by Story ID
const logCache = new Map<string, string[]>();

// All logs (not keyed by story)
const allLogs: string[] = [];

// Current Story ID being processed
let currentStoryId: string | null = null;

// Regex to detect Story ID from output text (e.g., "US-003" being picked up)
const STORY_ID_REGEX = /\b(US-\d+)\b/;

// Regex to detect progress header pattern: "## ... - US-XXX"
const PROGRESS_HEADER_REGEX = /^##\s+.+?\s+-\s+(US-\d+)/m;

/**
 * Parse progress.txt to determine the most recent Story ID
 */
export function parseCurrentStoryIdFromProgress(): string | null {
  try {
    const paths = getActiveProjectPaths();
    if (!paths) return null;

    const content = fs.readFileSync(paths.progressPath, "utf-8");
    const matches = [...content.matchAll(/^##\s+.+?\s+-\s+(US-\d+)/gm)];
    if (matches.length === 0) return null;

    // Return the last (most recent) entry's story ID
    return matches[matches.length - 1][1];
  } catch {
    return null;
  }
}

/**
 * Initialize the log cache, parsing progress.txt for current story context
 */
export function initLogCache(): void {
  currentStoryId = parseCurrentStoryIdFromProgress();
}

/**
 * Get the current Story ID being processed
 */
export function getCurrentStoryId(): string | null {
  return currentStoryId;
}

/**
 * Update current Story ID (called when we detect a new story being picked up)
 */
export function setCurrentStoryId(storyId: string | null): void {
  currentStoryId = storyId;
}

/**
 * Try to detect a Story ID change from output text.
 * Returns the detected storyId if a change is detected, null otherwise.
 */
export function detectStoryIdFromOutput(text: string): string | null {
  // Look for patterns like picking up a story: "US-XXX" in output
  const match = text.match(STORY_ID_REGEX);
  return match ? match[1] : null;
}

/**
 * Add a log line, associating it with the current Story ID
 */
export function addLogLine(text: string, storyId: string | null): void {
  allLogs.push(text);

  if (storyId) {
    if (!logCache.has(storyId)) {
      logCache.set(storyId, []);
    }
    logCache.get(storyId)!.push(text);
  }
}

/**
 * Get logs for a specific Story ID
 */
export function getLogsByStoryId(storyId: string): string[] {
  return logCache.get(storyId) ?? [];
}

/**
 * Get all logs
 */
export function getAllLogs(): string[] {
  return allLogs;
}

/**
 * Clear all cached logs (e.g., on process restart)
 */
export function clearLogCache(): void {
  logCache.clear();
  allLogs.length = 0;
  currentStoryId = null;
}
