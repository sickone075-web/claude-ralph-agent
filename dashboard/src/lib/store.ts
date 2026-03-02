import { create } from "zustand";
import type { PRD } from "./types";

export type RalphStatus = "idle" | "running" | "completed" | "error";
export type WebSocketState = "connecting" | "connected" | "disconnected";

interface DashboardStore {
  // Ralph status
  ralphStatus: RalphStatus;
  iteration: number;
  totalIterations: number;
  startedAt: string | null;
  setRalphStatus: (status: RalphStatus) => void;
  setIteration: (current: number, total: number) => void;
  setStartedAt: (startedAt: string | null) => void;

  // PRD data
  prd: PRD | null;
  setPrd: (prd: PRD | null) => void;

  // WebSocket connection state
  wsState: WebSocketState;
  setWsState: (state: WebSocketState) => void;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  // Ralph status
  ralphStatus: "idle",
  iteration: 0,
  totalIterations: 0,
  startedAt: null,
  setRalphStatus: (ralphStatus) => set({ ralphStatus }),
  setIteration: (iteration, totalIterations) =>
    set({ iteration, totalIterations }),
  setStartedAt: (startedAt) => set({ startedAt }),

  // PRD data
  prd: null,
  setPrd: (prd) => set({ prd }),

  // WebSocket connection state
  wsState: "disconnected",
  setWsState: (wsState) => set({ wsState }),
}));
