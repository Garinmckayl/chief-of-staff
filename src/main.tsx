import "./globals.css";
import { Component, type ReactNode, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { JSONUIProvider, Renderer, defineRegistry } from "@json-render/react";
import { shadcnComponents } from "@json-render/shadcn";
import { useJsonRenderApp } from "@json-render/mcp/app";
import type { Spec } from "@json-render/core";
import { catalog } from "./catalog";

// ─── Custom component implementations ────────────────────────────────────────

const { registry } = defineRegistry(catalog, {
  components: {
    ...shadcnComponents,

    FocusCard: ({ props, emit }: any) => {
      const urgencyColor = {
        critical: "#dc2626",
        high: "#f97316",
        normal: "#22c55e",
      }[props.urgency as string] ?? "#22c55e";

      return (
        <div style={{
          borderLeft: `4px solid ${urgencyColor}`,
          background: "var(--color-background-secondary, #18181b)",
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>🎯</span>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: urgencyColor }}>
              Focus Now
            </span>
          </div>
          <p style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text-primary, #fff)", margin: "0 0 6px", wordBreak: "break-word" }}>
            {props.title}
          </p>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary, #a1a1aa)", margin: "0 0 12px", wordBreak: "break-word" }}>
            {props.why}
          </p>
          {props.notionUrl && (
            <button
              onClick={() => emit("press", { action: "open_notion", url: props.notionUrl })}
              style={{
                fontSize: 12,
                color: urgencyColor,
                background: "transparent",
                border: `1px solid ${urgencyColor}40`,
                borderRadius: 6,
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              Open in Notion →
            </button>
          )}
        </div>
      );
    },

    TaskList: ({ props, children }: any) => (
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary, #fff)" }}>
            {props.heading}
          </span>
          {props.count !== null && props.count > 0 && (
            <span style={{
              fontSize: 11,
              background: "var(--color-background-secondary, #27272a)",
              color: "var(--color-text-secondary, #a1a1aa)",
              borderRadius: 10,
              padding: "1px 7px",
              fontWeight: 600,
            }}>
              {props.count}
            </span>
          )}
        </div>
        {children && children.length > 0 ? children : (
          <p style={{ fontSize: 13, color: "var(--color-text-tertiary, #71717a)", fontStyle: "italic", margin: 0 }}>
            {props.emptyMessage || "Nothing here"}
          </p>
        )}
      </div>
    ),

    TaskRow: ({ props, emit }: any) => {
      const [done, setDone] = useState(false);
      const handleComplete = useCallback(() => {
        setDone(true);
        emit("press", { action: "complete_task", taskId: props.id });
      }, [props.id, emit]);

      if (done) return null;

      const overdue = props.isOverdue;
      return (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px",
          borderRadius: 8,
          marginBottom: 4,
          background: overdue
            ? "rgba(220,38,38,0.08)"
            : "var(--color-background-secondary, #18181b)",
          border: `1px solid ${overdue ? "rgba(220,38,38,0.25)" : "var(--color-border, #27272a)"}`,
        }}>
          <button
            onClick={handleComplete}
            style={{
              width: 18,
              height: 18,
              minWidth: 18,
              borderRadius: 4,
              border: `2px solid ${overdue ? "#dc2626" : "var(--color-border, #3f3f46)"}`,
              background: "transparent",
              cursor: "pointer",
              flexShrink: 0,
            }}
            aria-label="Complete task"
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--color-text-primary, #fff)",
              margin: 0,
              wordBreak: "break-word",
            }}>
              {props.title}
            </p>
            {(props.dueDate || props.status) && (
              <p style={{ fontSize: 11, color: overdue ? "#dc2626" : "var(--color-text-tertiary, #71717a)", margin: "2px 0 0" }}>
                {overdue ? "⚠ Overdue" : props.dueDate ? `Due ${props.dueDate}` : ""}{props.status ? ` · ${props.status}` : ""}
              </p>
            )}
          </div>
          {props.notionUrl && (
            <button
              onClick={() => emit("press", { action: "open_notion", url: props.notionUrl })}
              style={{
                fontSize: 11,
                color: "var(--color-text-tertiary, #71717a)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "2px 4px",
                flexShrink: 0,
              }}
            >
              ↗
            </button>
          )}
        </div>
      );
    },

    GoalProgress: ({ props, emit }: any) => {
      const pct = Math.min(100, Math.max(0, props.progress || 0));
      const color = pct >= 80 ? "#22c55e" : pct >= 40 ? "#f97316" : "#a1a1aa";
      return (
        <div style={{
          padding: "10px 14px",
          borderRadius: 8,
          background: "var(--color-background-secondary, #18181b)",
          border: "1px solid var(--color-border, #27272a)",
          marginBottom: 8,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary, #fff)", wordBreak: "break-word", flex: 1 }}>
              {props.title}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>
              {pct}%
            </span>
          </div>
          <div style={{ height: 4, background: "var(--color-background-tertiary, #27272a)", borderRadius: 2 }}>
            <div style={{ height: 4, width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.5s ease" }} />
          </div>
          {props.notionUrl && (
            <button
              onClick={() => emit("press", { action: "open_notion", url: props.notionUrl })}
              style={{ fontSize: 11, color: "var(--color-text-tertiary, #71717a)", background: "transparent", border: "none", cursor: "pointer", marginTop: 6, padding: 0 }}
            >
              View in Notion →
            </button>
          )}
        </div>
      );
    },

    InsightBadge: ({ props }: any) => {
      const typeStyle = {
        warning: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", color: "#fbbf24", icon: "⚠" },
        tip: { bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.3)", color: "#60a5fa", icon: "💡" },
        pattern: { bg: "rgba(168,85,247,0.1)", border: "rgba(168,85,247,0.3)", color: "#c084fc", icon: "📊" },
        win: { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.3)", color: "#4ade80", icon: "🏆" },
      }[props.type as string] ?? { bg: "rgba(161,161,170,0.1)", border: "rgba(161,161,170,0.2)", color: "#a1a1aa", icon: "•" };

      return (
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderRadius: 20,
          background: typeStyle.bg,
          border: `1px solid ${typeStyle.border}`,
          marginBottom: 6,
          marginRight: 6,
        }}>
          <span style={{ fontSize: 12 }}>{typeStyle.icon}</span>
          <span style={{ fontSize: 12, color: typeStyle.color, wordBreak: "break-word" }}>{props.text}</span>
        </div>
      );
    },

    SectionHeader: ({ props }: any) => (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20, marginBottom: 12 }}>
        {props.emoji && <span style={{ fontSize: 16 }}>{props.emoji}</span>}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary, #fff)", margin: 0, wordBreak: "break-word" }}>
            {props.title}
          </h2>
          {props.subtitle && (
            <p style={{ fontSize: 12, color: "var(--color-text-secondary, #a1a1aa)", margin: "2px 0 0", wordBreak: "break-word" }}>
              {props.subtitle}
            </p>
          )}
        </div>
      </div>
    ),

    QuickAction: ({ props, emit }: any) => (
      <button
        onClick={() => emit("press", { action: props.action, taskId: props.taskId, url: props.url })}
        style={{
          padding: "8px 16px",
          borderRadius: 8,
          background: "var(--color-background-secondary, #27272a)",
          border: "1px solid var(--color-border, #3f3f46)",
          color: "var(--color-text-primary, #fff)",
          fontSize: 13,
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        {props.label}
      </button>
    ),

    AgentAction: ({ props, emit }: any) => {
      const [running, setRunning] = useState(false);
      const [done, setDone] = useState(false);

      const isPrimary = props.variant === "primary";

      return (
        <button
          disabled={running || done}
          onClick={() => {
            setRunning(true);
            emit("press", { tool: props.agentTool, context: props.description });
            setTimeout(() => { setRunning(false); setDone(true); }, 1500);
          }}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            width: "100%",
            padding: "12px 16px",
            borderRadius: 10,
            background: done
              ? "rgba(34,197,94,0.08)"
              : isPrimary
              ? "rgba(99,102,241,0.12)"
              : "var(--color-background-secondary, #18181b)",
            border: `1px solid ${done ? "rgba(34,197,94,0.3)" : isPrimary ? "rgba(99,102,241,0.4)" : "var(--color-border, #27272a)"}`,
            color: "var(--color-text-primary, #fff)",
            fontSize: 13,
            cursor: done || running ? "default" : "pointer",
            fontWeight: 500,
            textAlign: "left",
            marginBottom: 8,
            opacity: running ? 0.7 : 1,
            transition: "all 0.2s",
          }}
        >
          <span style={{ fontSize: 18, flexShrink: 0 }}>
            {done ? "✅" : running ? "⏳" : (props.emoji || "⚡")}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 600, color: done ? "#4ade80" : isPrimary ? "#a5b4fc" : "var(--color-text-primary, #fff)", wordBreak: "break-word" }}>
              {done ? "Done — check Notion" : running ? "Working…" : props.label}
            </p>
            {!done && !running && (
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--color-text-secondary, #a1a1aa)", fontWeight: 400, wordBreak: "break-word" }}>
                {props.description}
              </p>
            )}
          </div>
        </button>
      );
    },
  },
  actions: {
    complete_task: async (params) => {
      console.log("complete_task", params?.taskId);
    },
    open_notion: async (params) => {
      if (params?.url) window.open(params.url, "_blank", "noopener");
    },
    run_agent: async (params) => {
      console.log("run_agent", params?.tool, params?.context);
    },
  },
});

// ─── Error boundary ───────────────────────────────────────────────────────────

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, color: "#dc2626", fontFamily: "monospace", fontSize: 13 }}>
          Error: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Force full width on top-level Cards ─────────────────────────────────────

function forceFullWidth(spec: Spec): Spec {
  if (!spec.elements) return spec;
  const elements = { ...spec.elements };
  for (const [key, el] of Object.entries(elements)) {
    if ((el as any).type === "Card" && (el as any).props) {
      (elements as any)[key] = { ...el, props: { ...(el as any).props, maxWidth: "full", centered: false } };
    }
  }
  return { ...spec, elements };
}

// ─── MCP App view ─────────────────────────────────────────────────────────────

function McpAppView() {
  const { spec: rawSpec, connecting, error } = useJsonRenderApp({
    name: "chief-of-staff",
    version: "1.0.0",
  });

  const spec = rawSpec ? forceFullWidth(rawSpec) : null;

  if (error) {
    return (
      <div style={{ padding: 16, color: "#dc2626", fontFamily: "monospace", fontSize: 13 }}>
        Error: {error.message}
      </div>
    );
  }

  if (!spec) {
    return (
      <div style={{ padding: 32, color: "#71717a", fontFamily: "sans-serif", fontSize: 14, textAlign: "center" }}>
        <p style={{ fontSize: 20, marginBottom: 8 }}>🧑‍💼</p>
        <p>{connecting ? "Connecting…" : "Chief of Staff is ready."}</p>
        <p style={{ fontSize: 12, marginTop: 4 }}>Ask Claude: <em>"Give me my morning briefing"</em></p>
      </div>
    );
  }

  return (
    <JSONUIProvider
      registry={registry}
      initialState={spec.state ?? {}}
    >
      <div
        className="w-full"
        style={{ padding: 16, fontFamily: "sans-serif" }}
      >
        <Renderer spec={spec} registry={registry} />
      </div>
    </JSONUIProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <McpAppView />
  </ErrorBoundary>
);
