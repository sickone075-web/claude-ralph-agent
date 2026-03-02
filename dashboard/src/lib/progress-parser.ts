import type { ProgressRecord } from "@/lib/types";

export function parseProgressLog(content: string): ProgressRecord[] {
  const records: ProgressRecord[] = [];

  // Split by --- separator
  const sections = content.split(/\n---\s*\n/);

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    // Match ## Date - Story ID header
    const headerMatch = trimmed.match(/^##\s+(.+?)\s+-\s+(US-\d+)/m);
    if (!headerMatch) continue;

    const date = headerMatch[1].trim();
    const storyId = headerMatch[2].trim();

    // Extract lines after header
    const lines = trimmed.split("\n").slice(1);

    const summary: string[] = [];
    const filesChanged: string[] = [];
    const learnings: string[] = [];
    let currentSection: "summary" | "files" | "learnings" = "summary";

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      if (/\*\*learnings/i.test(trimmedLine)) {
        currentSection = "learnings";
        continue;
      }

      if (/files changed/i.test(trimmedLine)) {
        // Extract file list from "Files changed: file1, file2" or "- Files changed: `f1`, `f2`"
        const filesMatch = trimmedLine.match(/files changed:\s*(.+)/i);
        if (filesMatch) {
          const fileStr = filesMatch[1];
          const extracted = fileStr.match(/`([^`]+)`/g);
          if (extracted) {
            filesChanged.push(...extracted.map((f) => f.replace(/`/g, "")));
          } else {
            filesChanged.push(...fileStr.split(",").map((f) => f.trim()).filter(Boolean));
          }
        }
        currentSection = "summary";
        continue;
      }

      if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) {
        const bulletContent = trimmedLine.replace(/^[-*]\s+/, "");
        if (currentSection === "learnings") {
          learnings.push(bulletContent);
        } else {
          summary.push(bulletContent);
        }
      }
    }

    records.push({
      date,
      storyId,
      summary: summary.join("; "),
      filesChanged,
      learnings,
    });
  }

  return records;
}
