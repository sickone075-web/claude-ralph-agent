export interface Story {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: number;
  passes: boolean;
  notes: string;
}

export interface PRD {
  project: string;
  branchName: string;
  description: string;
  userStories: Story[];
}

export interface ProgressRecord {
  date: string;
  storyId: string;
  summary: string;
  filesChanged: string[];
  learnings: string[];
}

export interface GitCommit {
  hash: string;
  message: string;
  date: string;
  author: string;
}

export interface ProgressLogData {
  codebasePatterns: string[];
  records: ProgressRecord[];
}

export interface ArchiveItem {
  folder: string;
  date: string;
  featureName: string;
  totalStories: number;
  completedStories: number;
}

export interface ArchiveDetail {
  folder: string;
  prd: PRD | null;
  progress: ProgressLogData | null;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}
