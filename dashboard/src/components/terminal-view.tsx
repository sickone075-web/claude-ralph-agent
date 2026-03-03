import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

export interface TerminalHandle {
  write: (data: string) => void;
  clear: () => void;
}

interface TerminalViewProps {
  onInput?: (data: string) => void;
  welcomeMessage?: string;
  onReady?: (handle: TerminalHandle) => void;
  readOnly?: boolean;
}

export default function TerminalViewWrapper(props: TerminalViewProps) {
  return <TerminalViewInner {...props} />;
}

const TerminalViewInner = forwardRef<TerminalHandle, TerminalViewProps>(
  function TerminalViewInner({ onInput, welcomeMessage, onReady, readOnly }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<XTerm | null>(null);

    useImperativeHandle(ref, () => ({
      write: (data: string) => termRef.current?.write(data),
      clear: () => termRef.current?.clear(),
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      const term = new XTerm({
        theme: {
          background: "#1a1a2e",
          foreground: "#e4e4e7",
          cursor: "#a78bfa",
          cursorAccent: "#1a1a2e",
          selectionBackground: "#3f3f46",
          black: "#18181b",
          red: "#ef4444",
          green: "#22c55e",
          yellow: "#eab308",
          blue: "#3b82f6",
          magenta: "#a855f7",
          cyan: "#06b6d4",
          white: "#e4e4e7",
          brightBlack: "#71717a",
          brightRed: "#f87171",
          brightGreen: "#4ade80",
          brightYellow: "#facc15",
          brightBlue: "#60a5fa",
          brightMagenta: "#c084fc",
          brightCyan: "#22d3ee",
          brightWhite: "#fafafa",
        },
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontSize: 14,
        lineHeight: 1.2,
        cursorBlink: !readOnly,
        cursorStyle: readOnly ? "underline" : "bar",
        scrollback: 10000,
        allowProposedApi: true,
        disableStdin: !!readOnly,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);

      term.open(containerRef.current);
      fitAddon.fit();

      termRef.current = term;

      if (welcomeMessage) {
        term.writeln(welcomeMessage);
      }

      if (onInput && !readOnly) {
        term.onData((data) => {
          onInput(data);
        });
      }

      // Notify parent that terminal is ready
      if (onReady) {
        onReady({
          write: (data: string) => term.write(data),
          clear: () => term.clear(),
        });
      }

      const handleResize = () => {
        fitAddon.fit();
      };
      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
        term.dispose();
        termRef.current = null;
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ backgroundColor: "#1a1a2e" }}
      />
    );
  }
);
