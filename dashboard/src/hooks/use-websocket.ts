import { useEffect, useRef, useCallback } from "react";
import { useDashboardStore } from "@/lib/store";
import type { RalphStatus } from "@/lib/store";

function getWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

const MAX_RECONNECT_DELAY = 30_000;

interface WsMessage {
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

type EventHandler = (payload: Record<string, unknown>) => void;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const listenersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const mountedRef = useRef(true);

  const { setWsState } = useDashboardStore();

  const subscribe = useCallback((event: string, handler: EventHandler) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(handler);

    return () => {
      listenersRef.current.get(event)?.delete(handler);
    };
  }, []);

  const send = useCallback((type: string, payload: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type, payload, timestamp: new Date().toISOString() })
      );
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setWsState("connecting");
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      reconnectAttemptRef.current = 0;
      setWsState("connected");
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        const handlers = listenersRef.current.get(msg.type);
        if (handlers) {
          handlers.forEach((handler) => handler(msg.payload));
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setWsState("disconnected");
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
      const delay = Math.min(
        1000 * Math.pow(2, reconnectAttemptRef.current),
        MAX_RECONNECT_DELAY
      );
      reconnectAttemptRef.current++;
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    };

    ws.onerror = () => {
      // onclose will fire after onerror, triggering reconnect
    };
  }, [setWsState]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  return { subscribe, send };
}

export function useRalphStatus() {
  const { ralphStatus, iteration, totalIterations, startedAt } =
    useDashboardStore();

  return { status: ralphStatus, iteration, totalIterations, startedAt };
}

export function usePrd() {
  const { prd } = useDashboardStore();
  return prd;
}

export function useWebSocketEvents(ws: ReturnType<typeof useWebSocket>) {
  const { setRalphStatus, setIteration, setStartedAt, setPrd } =
    useDashboardStore();

  useEffect(() => {
    const unsubStatus = ws.subscribe(
      "ralph:status",
      (payload: Record<string, unknown>) => {
        const status = payload.status as RalphStatus;
        setRalphStatus(status);
        if (status === "running") {
          setStartedAt(new Date().toISOString());
        } else if (status === "idle" || status === "completed" || status === "error") {
          setStartedAt(null);
        }
      }
    );

    const unsubIteration = ws.subscribe(
      "ralph:iteration",
      (payload: Record<string, unknown>) => {
        setIteration(
          payload.current as number,
          payload.total as number
        );
      }
    );

    const unsubPrd = ws.subscribe("prd:updated", () => {
      // Refetch PRD from API when file changes
      fetch("/api/prd")
        .then((res) => res.json())
        .then((json) => {
          if (json.data) setPrd(json.data);
        })
        .catch(() => {
          // ignore fetch errors
        });
    });

    return () => {
      unsubStatus();
      unsubIteration();
      unsubPrd();
    };
  }, [ws, setRalphStatus, setIteration, setStartedAt, setPrd]);
}
