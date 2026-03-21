import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { shadcnComponentDefinitions } from "@json-render/shadcn/catalog";
import { z } from "zod";

/**
 * Chief of Staff catalog.
 *
 * Defines the UI vocabulary the AI can use to build your morning briefing.
 * All components are pulled from shadcn/ui so the dashboard looks polished
 * with zero custom CSS. We add a few Chief of Staff-specific components on top.
 */
export const catalog = defineCatalog(schema, {
  components: {
    // ── shadcn base ──────────────────────────────────────────────────────────
    ...shadcnComponentDefinitions,

    // ── Chief of Staff custom components ────────────────────────────────────

    /**
     * FocusCard: The single most important thing right now.
     * Big, prominent, impossible to miss.
     */
    FocusCard: {
      props: z.object({
        title: z.string().describe("The one thing to focus on right now"),
        why: z.string().describe("One sentence on why this matters today"),
        notionUrl: z.string().nullable().describe("Link to the Notion page"),
        urgency: z.enum(["critical", "high", "normal"]).nullable(),
      }),
      description:
        "The single most important task or focus area for today. Always include exactly one at the top of every briefing.",
    },

    /**
     * TaskRow: A single task with completion toggle.
     * Clicking the checkbox calls the complete_task action.
     */
    TaskRow: {
      props: z.object({
        id: z.string().describe("Notion page ID"),
        title: z.string(),
        status: z.string().nullable(),
        dueDate: z.string().nullable().describe("ISO date string"),
        isOverdue: z.boolean().nullable(),
        notionUrl: z.string().nullable(),
        priority: z.enum(["urgent", "high", "normal", "low"]).nullable(),
      }),
      description:
        "A single task row. Use inside a TaskList. Shows title, status, due date, and a complete button.",
    },

    /**
     * TaskList: Container for a group of TaskRows with a section heading.
     */
    TaskList: {
      props: z.object({
        heading: z.string().describe("Section heading e.g. 'Overdue', 'This Week'"),
        count: z.number().nullable(),
        emptyMessage: z.string().nullable().describe("Shown when there are no tasks"),
      }),
      slots: ["default"],
      description:
        "A labeled group of task rows. Use separate TaskLists for overdue, this week, and next week.",
    },

    /**
     * GoalProgress: Visual progress toward a goal.
     */
    GoalProgress: {
      props: z.object({
        title: z.string(),
        progress: z.number().describe("0-100 percent"),
        status: z.string().nullable(),
        notionUrl: z.string().nullable(),
      }),
      description: "Shows a goal with a progress bar. Use in the Goals section.",
    },

    /**
     * InsightBadge: A quick contextual insight from past Notion data.
     * Used to show patterns, warnings, or observations.
     */
    InsightBadge: {
      props: z.object({
        text: z.string().describe("Short insight, max 20 words"),
        type: z.enum(["warning", "tip", "pattern", "win"]).nullable(),
      }),
      description:
        "A small badge with a short insight. Use sparingly — max 3 per briefing.",
    },

    /**
     * SectionHeader: Bold divider between dashboard sections.
     */
    SectionHeader: {
      props: z.object({
        title: z.string(),
        subtitle: z.string().nullable(),
        emoji: z.string().nullable(),
      }),
      description: "Section divider with title and optional subtitle and emoji.",
    },

    /**
     * QuickAction: A button the user can click to take an action.
     */
    QuickAction: {
      props: z.object({
        label: z.string(),
        action: z.string().describe("Action name: open_notion | complete_task | snooze_task"),
        taskId: z.string().nullable(),
        url: z.string().nullable(),
      }),
      description: "A clickable action button. Use for quick one-click actions.",
    },

    /**
     * AgentAction: A prominent CTA button that triggers an agentic workflow.
     * Displayed at the bottom of the briefing as the "what should I do next" options.
     * Each button tells Claude to call a specific agentic MCP tool.
     */
    AgentAction: {
      props: z.object({
        label: z.string().describe("Button label, e.g. 'Clear my week' or 'Write weekly review'"),
        description: z.string().describe("One-line description of what the agent will do"),
        agentTool: z.enum([
          "create_notion_tasks",
          "reschedule_overdue_tasks",
          "write_weekly_review",
          "break_down_goal",
        ]).describe("The MCP tool Claude should call when this button is clicked"),
        emoji: z.string().nullable(),
        variant: z.enum(["primary", "secondary"]).nullable(),
      }),
      description:
        "A prominent agent action button. Always include 2-3 at the bottom of every briefing under a 'What should I do?' section. Each triggers Claude to run a real Notion agentic workflow.",
    },
  },

  actions: {
    /**
     * Mark a task as done in Notion.
     */
    complete_task: {
      params: z.object({
        taskId: z.string().describe("Notion page ID of the task"),
      }),
      description: "Mark a task as complete in Notion",
    },

    /**
     * Open a Notion page in the browser.
     */
    open_notion: {
      params: z.object({
        url: z.string().describe("Notion page URL"),
      }),
      description: "Open a Notion page",
    },

    /**
     * Trigger an agentic workflow — tells Claude to call the specified MCP tool.
     * The UI sends this action; Claude picks it up and executes the real work.
     */
    run_agent: {
      params: z.object({
        tool: z.string().describe("The MCP tool name to invoke"),
        context: z.string().nullable().describe("Optional context passed to the agent"),
      }),
      description: "Trigger a Notion agentic workflow from the dashboard",
    },
  },
});
