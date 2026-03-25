---
title: I'm a 24-year-old dropout building alone in Addis Ababa. I gave myself a chief of staff.
published: false
tags: devchallenge, notionchallenge, mcp, ai
---

*This is a submission for the [Notion MCP Challenge](https://dev.to/challenges/notion-2026-03-04)*

---

I maintain an open source AI agent SDK. I'm building a startup. I do both alone, from Addis Ababa, at 24, no team.

Every morning I open Notion and spend 15 minutes manually figuring out what's actually on fire. What's overdue. What's tied to which goal. I piece it together across five databases, hold it in working memory, then try to work.

That 15 minutes compounds. Every day. It's not a productivity problem — it's a tax on building alone.

People who have a chief of staff don't pay that tax. I can't afford one. So I built one.

---

## What I Built

**Chief of Staff** is an MCP App that reads your Notion workspace every morning and briefs you — then handles the work you tell it to.

You type: *"Give me my morning briefing."*

A live interactive dashboard appears inside your MCP client. Your real tasks. Your real goals. Your actual overdue items with how many days they've slipped. And at the bottom — action buttons that don't link to Notion. They tell Claude to go fix things:

- **⚡ Plan my week** → Claude generates a task breakdown and creates every task directly in your Notion database
- **📅 Reschedule overdue tasks** → Claude looks at everything overdue, picks sensible new dates based on priority, patches them all in Notion. The guilt pile disappears.
- **📋 Write weekly review** → Claude pulls your completed tasks, synthesizes what happened, and writes a full structured page into your workspace
- **🎯 Break down stalled goal** → Claude takes a goal sitting at 5% and generates 4-6 concrete sub-tasks with due dates, creates them all in Notion

The briefing is the interface. Notion is where the work actually lands.

**GitHub:** [https://github.com/Garinmckayl/chief-of-staff](https://github.com/Garinmckayl/chief-of-staff)

---

## The Idea

A few months before this challenge I published `@agntor/sdk` — a trust and payment rail for AI agents. Identity, escrow, reputation, settlement. The kind of infrastructure that has to work correctly or agents can't transact safely with each other. I track everything in Notion. I build in VS Code. I do it alone.

The problem I kept hitting wasn't technical. It was operational. I'd start the day not knowing whether to fix the payment bug, send the overdue investor email, or prep for the advisor call. All three were in Notion. None of them were surfaced. I'd make the wrong call and lose an hour.

I needed something that read my whole workspace, made sense of it, and then — this is the part that matters — actually handled the work I pointed it at.

Not a dashboard. A chief of staff.

---

## How I Used Notion MCP

Notion MCP is the reason the write path exists. Without it I'd need custom integrations per action. With it, Claude can read and write across the entire workspace through one protocol, and every agent tool is just a description of what needs to happen.

### The 8 MCP tools

| Tool | What it does |
|------|-------------|
| `chief_of_staff_briefing` | Renders the live interactive dashboard (MCP App) |
| `get_notion_briefing_data` | Reads your workspace — discovers task and goal databases dynamically |
| `complete_notion_task` | Marks a task done — detects whether Status is a select, native status, or checkbox |
| `create_notion_tasks` | Writes a Claude-generated task plan straight into your Notion database |
| `reschedule_overdue_tasks` | Updates due dates — Claude picks the dates and explains each one |
| `write_weekly_review` | Creates a structured weekly review page in your workspace |
| `break_down_goal` | Generates sub-tasks for a stalled goal and creates them in Notion |
| `get_completed_tasks` | Fetches done tasks from the past N days for the weekly review |

### The hard part: the agentic loop

The dashboard and the agent tools are two halves of the same system. The briefing shows the situation. The `AgentAction` buttons trigger Claude to fix it.

When you click "Reschedule overdue tasks," Claude gets a `run_agent` event, calls `get_notion_briefing_data` to see what's actually overdue, reasons about dates based on priority, and calls `reschedule_overdue_tasks` with the full update list. Notion gets patched. You touched nothing.

```typescript
mcpServer.tool(
  "reschedule_overdue_tasks",
  `Reschedule overdue tasks by updating their due dates in Notion.
  First call get_notion_briefing_data to get current overdue tasks.
  Decide sensible new due dates based on priority and today's date.
  Spread them out — don't dump everything on one day.`,
  {
    updates: z.array(z.object({
      taskId: z.string(),
      newDueDate: z.string(),
      reason: z.string(), // Claude explains its reasoning
    })),
  },
  async ({ updates }) => {
    const results = await rescheduleTasks(updates);
    return { content: [{ type: "text", text: JSON.stringify(results) }] };
  }
);
```

The `reason` field is intentional. Claude isn't just moving dates — it's explaining why. You can see the reasoning in the tool call output. That's what makes it feel like delegation rather than automation.

### The part that was actually hard

Two things I didn't expect to be problems:

**1. `completeTask` silently did nothing for weeks.** It was calling the Notion native `status` type, but most Notion databases use a `select` field for Status. The silent fallback was to archive the page. I fixed it by reading the page schema first and detecting the actual property type before writing.

**2. Goal databases kept appearing as task databases.** Any database with a `Status` column and a date field got classified as tasks. My Goals DB has both. Fixed by checking for a `progress`/`percent` field first — if it exists, it's a goal DB and gets excluded from task classification.

Neither of these was hard to fix. But both would silently break the demo if I hadn't caught them.

### Dynamic workspace discovery

No hardcoded database IDs. The system discovers your workspace by reading property shapes:

```typescript
// Goals have progress fields — exclude them from task DBs
if (hasProgress) {
  goalDbs.push({ id: db.id, name: title });
} else if (hasStatus || hasDue) {
  taskDbs.push({ id: db.id, name: title });
}
```

This means it works on any Notion workspace structure out of the box.

### The MCP App layer

The interactive dashboard uses `@json-render/mcp` — a library that lets you serve a React app as an MCP tool. When Claude calls `chief_of_staff_briefing` it returns a JSON spec that an iframe renders as a live shadcn/ui dashboard inside the chat.

The catalog defines every component Claude can generate:

```
FocusCard      — the single most important thing right now
TaskList       — grouped task rows with heading and count
TaskRow        — individual task with completion checkbox
GoalProgress   — progress bar with percentage
InsightBadge   — win / tip / warning / pattern pill
AgentAction    — the button that triggers real work
SectionHeader  — section divider
```

Claude fills this catalog with your real Notion data. The `AgentAction` component fires a `run_agent` event that Claude receives and routes to the right MCP tool. Visual layer and execution layer are the same system.

---

## Technical Stack

| Layer | What |
|-------|------|
| **MCP server** | `@modelcontextprotocol/sdk` — stdio + StreamableHTTP transports |
| **Generative UI** | `@json-render/mcp` + `@json-render/react` + `@json-render/shadcn` |
| **Notion writes** | Direct REST API with dynamic schema detection |
| **Bundler** | Vite + `vite-plugin-singlefile` (entire React app ships as one HTML string) |
| **Runtime** | Node.js + tsx |

**Run it in 60 seconds with GitHub Codespaces** — the repo includes `devcontainer.json` with everything pre-configured, port 3333 forwarded, `NOTION_API_KEY` as the only required secret.

```bash
git clone https://github.com/Garinmckayl/chief-of-staff
cd chief-of-staff && npm install && npm run build
NOTION_API_KEY=your_key npm run start:stdio
```

---

## Why This Matters

Most AI Notion integrations show you a prettier view of what you already have. That's a better calendar. This is different.

The real value is when seeing the problem and fixing the problem are one motion. When the agent doesn't hand you a summary and ask you to act on it — it acts. It writes the tasks. It moves the dates. It synthesizes the week. You direct it. It executes.

I built this for myself because I needed it. I'm a solo founder maintaining open source infrastructure, building a startup, doing both without a team, in a city where most of the tools the rest of the world assumes you have aren't available. Claude Desktop doesn't work in Ethiopia. I demo this in VS Code Copilot because that's what I actually have.

That constraint shaped the build. It works with what you have — one Notion workspace, one API key, one command.

This isn't productivity software. It's what happens when the person who builds infrastructure finally gets some infrastructure of their own.

---

*Built for the [Notion MCP Challenge](https://dev.to/challenges/notion-2026-03-04)*
*GitHub: [https://github.com/Garinmckayl/chief-of-staff](https://github.com/Garinmckayl/chief-of-staff)*
