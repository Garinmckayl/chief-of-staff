/**
 * Chief of Staff — MCP Server
 *
 * An MCP App that turns your Notion workspace into a live, interactive
 * morning briefing inside Claude — with agentic actions that actually
 * execute real work back into Notion.
 *
 * Tools registered:
 *   chief_of_staff_briefing    — renders the interactive dashboard (MCP App)
 *   get_notion_briefing_data   — fetches live Notion workspace snapshot
 *   complete_notion_task       — marks a single task done
 *   create_notion_tasks        — Claude generates tasks and writes them to Notion
 *   reschedule_overdue_tasks   — rewrites due dates on overdue tasks
 *   write_weekly_review        — creates a rich weekly review page in Notion
 *   break_down_goal            — breaks a stalled goal into sub-tasks in Notion
 *
 * Usage:
 *   npm run build               # Build the iframe HTML
 *   npm run start:stdio         # Run via stdio (Claude Desktop, Cursor)
 *   npm run start               # Run via HTTP (web clients, Codespaces)
 */

import { createMcpApp } from "@json-render/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalog } from "./src/catalog.js";
import {
  fetchWorkspaceSnapshot,
  fetchCompletedTasks,
  completeTask,
  createTasks,
  rescheduleTasks,
  createWeeklyReview,
  breakDownGoal,
} from "./src/notion.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadHtml(): string {
  const htmlPath = path.join(__dirname, "dist", "index.html");
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`Built HTML not found at ${htmlPath}. Run 'npm run build' first.`);
  }
  return fs.readFileSync(htmlPath, "utf-8");
}

// ─── Task schema (reused across tools) ───────────────────────────────────────

const TaskSchema = z.object({
  title: z.string().describe("Task title"),
  dueDate: z.string().optional().describe("ISO date e.g. '2026-03-28'"),
  priority: z.enum(["urgent", "high", "normal", "low"]).optional(),
  notes: z.string().optional().describe("Optional body content for the task page"),
});

// ─── Server factory ───────────────────────────────────────────────────────────

async function createServer() {
  const html = loadHtml();

  const server = await createMcpApp({
    name: "Chief of Staff",
    version: "1.0.0",
    catalog,
    html,
    tool: {
      name: "chief_of_staff_briefing",
      title: "Chief of Staff Morning Briefing",
      description: `
Render an interactive morning briefing dashboard. You MUST call this tool after get_notion_briefing_data — use the snapshot data to build the spec argument.

CRITICAL: You must call this tool with a complete spec to render the UI. Do NOT respond with plain text — always call this tool.

CRITICAL FOR TASKS: Every task that appears in a TaskList MUST have its own TaskRow element defined in the elements map AND listed in the TaskList's children array. If you reference "task-1" in children, you MUST output an element with key "task-1". Missing child elements are invisible. Generate one TaskRow per task — do not skip them.

Example of correct TaskList structure:
  TaskList element: { "type": "TaskList", "props": { "heading": "Overdue", "count": 2 }, "children": ["task-overdue-1", "task-overdue-2"] }
  MUST also have: { "type": "TaskRow", "props": { "id": "<notion-id>", "title": "Fix payment bug", "isOverdue": true, "dueDate": "2026-03-17", "priority": "high", "status": "Not started", "notionUrl": null } }
  AND: { "type": "TaskRow", "props": { "id": "<notion-id>", "title": "Send investor email", "isOverdue": true, "dueDate": "2026-03-16", "priority": "high", "status": "In progress", "notionUrl": null } }

${catalog.prompt({
  customRules: [
    "Always start with exactly one FocusCard — the single most important thing right now.",
    "Use SectionHeader to divide: Focus, Tasks, Goals, Take Action.",
    "Overdue tasks MUST appear first in a red-themed TaskList with isOverdue=true on each TaskRow.",
    "For EVERY task in the snapshot data, output a TaskRow element AND include it in the TaskList children array. Never reference a child key without defining that element.",
    "Include 1-3 InsightBadge components with sharp observations.",
    "GoalProgress bars show progress 0-100. Omit Goals section if no data.",
    "Tone: calm, direct, like a trusted chief of staff.",
    "ALWAYS include a 'Take Action' SectionHeader at the bottom followed by 2-3 AgentAction buttons.",
    "AgentAction buttons should reflect what actually needs doing. Examples:",
    "  - If there are overdue tasks: AgentAction with agentTool='reschedule_overdue_tasks', label='Reschedule overdue tasks', emoji='📅'",
    "  - If it's Friday or there are many done tasks: AgentAction with agentTool='write_weekly_review', label='Write weekly review', emoji='📋'",
    "  - If a goal has no tasks: AgentAction with agentTool='break_down_goal', label='Break down stalled goal', emoji='🎯'",
    "  - Always include: AgentAction with agentTool='create_notion_tasks', label='Plan my week', emoji='⚡', variant='primary'",
  ],
})}
`.trim(),
    },
  });

  const mcpServer = server as unknown as McpServer;

  // ── Tool: fetch briefing data ───────────────────────────────────────────────
  mcpServer.tool(
    "get_notion_briefing_data",
    "Fetch live data from the user's Notion workspace. ALWAYS call chief_of_staff_briefing immediately after this tool to render the interactive dashboard UI with the data returned.",
    {},
    async () => {
      if (!process.env.NOTION_API_KEY) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "NOTION_API_KEY not set" }) }] };
      }
      try {
        const snapshot = await fetchWorkspaceSnapshot();
        return { content: [{ type: "text" as const, text: JSON.stringify(snapshot, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: err.message }) }] };
      }
    }
  );

  // ── Tool: complete a task ───────────────────────────────────────────────────
  mcpServer.tool(
    "complete_notion_task",
    "Mark a Notion task as complete",
    { taskId: z.string().describe("Notion page ID") },
    async ({ taskId }) => {
      try {
        await completeTask(taskId);
        return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, taskId }) }] };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: err.message }) }] };
      }
    }
  );

  // ── Tool: create tasks ──────────────────────────────────────────────────────
  mcpServer.tool(
    "create_notion_tasks",
    `Create one or more tasks directly in the user's Notion task database.
Use this when the user asks you to plan their week, create a project plan, or break work into tasks.
You decide the task titles, due dates, and priorities based on the conversation context.
Always create meaningful, specific tasks — not vague placeholders.`,
    {
      tasks: z.array(TaskSchema).describe("The tasks to create"),
      planTitle: z.string().optional().describe("Optional name for this batch of tasks e.g. 'Launch plan for v2'"),
    },
    async ({ tasks, planTitle }) => {
      try {
        const created = await createTasks(tasks);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              planTitle,
              created,
              message: `Created ${created.length} task${created.length !== 1 ? "s" : ""} in Notion.`,
            }),
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: err.message }) }] };
      }
    }
  );

  // ── Tool: reschedule overdue tasks ──────────────────────────────────────────
  mcpServer.tool(
    "reschedule_overdue_tasks",
    `Reschedule overdue tasks by updating their due dates in Notion.
First call get_notion_briefing_data to get the current overdue tasks.
Then decide sensible new due dates based on priority and today's date.
Spread them out — don't dump everything on one day.
Urgent tasks get the earliest dates. Low priority items can slide further.`,
    {
      updates: z.array(z.object({
        taskId: z.string().describe("Notion page ID of the task"),
        newDueDate: z.string().describe("New ISO due date e.g. '2026-03-26'"),
        reason: z.string().describe("Why you picked this date"),
      })).describe("Tasks to reschedule with their new due dates"),
    },
    async ({ updates }) => {
      try {
        const results = await rescheduleTasks(updates);
        const succeeded = results.filter((r) => r.success).length;
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              rescheduled: succeeded,
              total: updates.length,
              results,
              message: `Rescheduled ${succeeded}/${updates.length} overdue tasks in Notion.`,
            }),
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: err.message }) }] };
      }
    }
  );

  // ── Tool: write weekly review ───────────────────────────────────────────────
  mcpServer.tool(
    "write_weekly_review",
    `Generate a weekly review and write it as a rich page in Notion.
First call get_notion_briefing_data to get context.
Then fetch completed tasks and synthesize:
- What got done (wins)
- What slipped and why
- What carries to next week
- A short honest reflection

Write it like a real chief of staff would brief a founder — direct, no fluff.`,
    {
      weekOf: z.string().describe("Week date e.g. 'March 17–21, 2026'"),
      wins: z.array(z.string()).describe("Things that were completed or went well"),
      slipped: z.array(z.string()).describe("Things that were supposed to happen but didn't"),
      carries: z.array(z.string()).describe("Priorities carrying into next week"),
      reflection: z.string().describe("2-3 sentence honest reflection on the week"),
      completedTaskIds: z.array(z.string()).optional().describe("Notion page IDs of completed tasks"),
    },
    async ({ weekOf, wins, slipped, carries, reflection, completedTaskIds }) => {
      try {
        const url = await createWeeklyReview({
          weekOf,
          wins,
          slipped,
          carries,
          reflection,
          completedTaskIds: completedTaskIds ?? [],
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              url,
              message: `Weekly review created in Notion: ${url}`,
            }),
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: err.message }) }] };
      }
    }
  );

  // ── Tool: break down goal ───────────────────────────────────────────────────
  mcpServer.tool(
    "break_down_goal",
    `Break a stalled or vague goal into concrete sub-tasks and create them in Notion.
Use this when the user has a goal with no progress or no attached tasks.
Generate 3-6 specific, actionable sub-tasks that would meaningfully move the goal forward.
Each task should be completable in 1-2 days max.
Set realistic due dates spread over the next 2 weeks.`,
    {
      goalTitle: z.string().describe("The goal being broken down"),
      goalContext: z.string().optional().describe("Any additional context about the goal"),
      subtasks: z.array(TaskSchema).describe("The concrete sub-tasks to create in Notion"),
    },
    async ({ goalTitle, subtasks }) => {
      try {
        const created = await breakDownGoal(goalTitle, subtasks);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              goalTitle,
              created,
              message: `Created ${created.length} sub-tasks for "${goalTitle}" in Notion.`,
            }),
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: err.message }) }] };
      }
    }
  );

  // ── Tool: fetch completed tasks (used by weekly review) ────────────────────
  mcpServer.tool(
    "get_completed_tasks",
    "Fetch tasks completed in the past N days from Notion — used to populate the weekly review",
    { days: z.number().optional().describe("How many days back to look (default 7)") },
    async ({ days }) => {
      try {
        const tasks = await fetchCompletedTasks(days ?? 7);
        return { content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: err.message }) }] };
      }
    }
  );

  return server;
}

// ─── Transport ────────────────────────────────────────────────────────────────

async function startStdio() {
  const server = await createServer();
  await server.connect(new StdioServerTransport());
}

async function startHttp() {
  const { default: express } = await import("express");
  const port = parseInt(process.env.PORT ?? "3333", 10);
  const app = express();
  app.use(express.json());

  app.all("/mcp", async (req: any, res: any) => {
    const server = await createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP error:", error);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
      }
    }
  });

  app.listen(port, () => {
    console.error(`Chief of Staff MCP server running at http://localhost:${port}/mcp`);
  });
}

if (process.argv.includes("--stdio")) {
  startStdio().catch((e) => { console.error(e); process.exit(1); });
} else {
  startHttp().catch((e) => { console.error(e); process.exit(1); });
}
