import { createContext, useContext, useEffect } from "react";
import { useWebSocket, useWebSocketEvents } from "@/hooks/use-websocket";
import { useDashboardStore } from "@/lib/store";

type EventHandler = (payload: Record<string, unknown>) => void;
type SubscribeFn = (event: string, handler: EventHandler) => () => void;

const WebSocketContext = createContext<{ subscribe: SubscribeFn } | null>(null);

export function useWsSubscribe(): SubscribeFn {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error("useWsSubscribe must be used within WebSocketProvider");
  return ctx.subscribe;
}

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

  return (
    <WebSocketContext.Provider value={{ subscribe: ws.subscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
}
