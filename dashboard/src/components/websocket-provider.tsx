import { useEffect } from "react";
import { useWebSocket, useWebSocketEvents } from "@/hooks/use-websocket";
import { useDashboardStore } from "@/lib/store";

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const ws = useWebSocket();
  useWebSocketEvents(ws);

  const { setPrd, setRalphStatus, setIteration, setStartedAt } =
    useDashboardStore();

  // Fetch initial data on mount
  useEffect(() => {
    fetch("/api/prd")
      .then((res) => res.json())
      .then((json) => {
        if (json.data) setPrd(json.data);
      })
      .catch(() => {});

    fetch("/api/ralph/status")
      .then((res) => res.json())
      .then((json) => {
        if (json.data) {
          setRalphStatus(json.data.status);
          setIteration(json.data.iteration ?? 0, json.data.totalIterations ?? 0);
          setStartedAt(json.data.startedAt ?? null);
        }
      })
      .catch(() => {});
  }, [setPrd, setRalphStatus, setIteration, setStartedAt]);

  return <>{children}</>;
}
