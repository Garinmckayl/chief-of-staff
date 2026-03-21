/**
 * Chief of Staff — MCP Server
 *
 * Registers a Notion-powered morning briefing tool that renders an interactive
 * dashboard inside Claude, ChatGPT, Cursor, and any MCP Apps-capable host.
 *
 * Usage:
 *   npm run build               # Build the iframe HTML
 *   npm run start:stdio         # Run via stdio (Claude Desktop, Cursor)
 *   npm run start               # Run via HTTP (web clients)
 *
 * Add to Claude Desktop (~/.config/Claude/claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "chief-of-staff": {
 *         "command": "node",
 *         "args": ["--import", "tsx/esm", "/path/to/chief-of-staff/server.ts", "--stdio"],
 *         "env": {
 *           "NOTION_API_KEY": "ntn_your_key_here"
 *         }
 *       }
 *     }
 *   }
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
import { fetchWorkspaceSnapshot, completeTask } from "./src/notion.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadHtml(): string {
  const htmlPath = path.join(__dirname, "dist", "index.html");
  if (!fs.existsSync(htmlPath)) {
    throw new Error(
      `Built HTML not found at ${htmlPath}. Run 'npm run build' first.`
    );
  }
  return fs.readFileSync(htmlPath, "utf-8");
}

async function createServer() {
  const html = loadHtml();

  // Create the base MCP app with the json-render catalog
  // This registers the render-ui tool whose description IS the catalog prompt
  const server = await createMcpApp({
    name: "Chief of Staff",
    version: "1.0.0",
    catalog,
    html,
    tool: {
      name: "chief_of_staff_briefing",
      title: "Chief of Staff Morning Briefing",
      description: `
Render an interactive morning briefing dashboard from the user's Notion workspace.

${catalog.prompt({
  customRules: [
    "Always start with exactly one FocusCard at the top — the single most important thing right now.",
    "Use SectionHeader to divide sections: Tasks, Goals, Insights.",
    "Overdue tasks MUST appear first in a red-themed TaskList.",
    "For each task, set isOverdue=true if the task is past due.",
    "Include 1-3 InsightBadge components with short observations about patterns (e.g. 'You have 3 overdue items this week').",
    "GoalProgress bars show progress 0-100. If progress data is unavailable, omit the Goals section.",
    "Keep the briefing scannable — prioritize ruthlessly. If there are 10 tasks, surface the 3 most critical.",
    "The tone is calm, direct, and supportive — like a trusted chief of staff, not a task master.",
    "Always include a QuickAction button to open the full Notion workspace.",
  ],
})}

Context: you will receive the user's Notion workspace data as JSON in your prompt. Use it to populate the dashboard.
`.trim(),
    },
  });

  // Register additional tools for task actions
  const mcpServer = server as unknown as McpServer;

  // Tool: fetch the morning briefing data
  mcpServer.tool(
    "get_notion_briefing_data",
    "Fetch live data from the user's Notion workspace to populate the Chief of Staff briefing",
    {},
    async () => {
      if (!process.env.NOTION_API_KEY) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "NOTION_API_KEY not set. Please add it to your MCP server environment.",
              }),
            },
          ],
        };
      }

      try {
        const snapshot = await fetchWorkspaceSnapshot();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(snapshot, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: err.message }),
            },
          ],
        };
      }
    }
  );

  // Tool: complete a task in Notion
  mcpServer.tool(
    "complete_notion_task",
    "Mark a Notion task as complete",
    { taskId: z.string().describe("The Notion page ID of the task to complete") },
    async ({ taskId }) => {
      try {
        await completeTask(taskId);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, taskId }) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: err.message }) }],
        };
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

    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

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
