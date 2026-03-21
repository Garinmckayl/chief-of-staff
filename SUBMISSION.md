---
title: Chief of Staff — I Gave Myself the One Thing Every Solo Founder Needs But Can't Afford
published: false
tags: devchallenge, notionchallenge, mcp, ai
---

*This is a submission for the [Notion MCP Challenge](https://dev.to/challenges/notion-2026-03-04)*

---

## The Tax Nobody Talks About

I'm 24. I dropped out. I'm building an AI startup from Addis Ababa, Ethiopia.

I don't have a team. I don't have a chief of staff, a project manager, or a head of ops. I have Notion — because that's where everything lives. My tasks, my goals, my decisions, my ideas at 2am. Every piece of my startup is in there somewhere.

But every morning, I do the same thing: I open Notion, and I spend 15-20 minutes manually reconstructing what's urgent. What's overdue. What the actual priority is today given everything else that's happening. What I said I was going to do this week. I open five different databases, piece it together in my head, and hold it all in working memory while I try to actually work.

That cognitive overhead is a tax. A real one. And it compounds — because when you're running on your own, every bit of mental energy you spend on operations is energy you're not spending on building.

I built Chief of Staff because I was tired of paying that tax.

---

## What I Built

**Chief of Staff is an MCP App that renders your entire Notion workspace as a live interactive morning briefing — directly inside Claude.**

You type one sentence: *"Give me my morning briefing."*

What happens next is unlike anything else I've seen in a hackathon entry: a full dashboard materializes inside the Claude chat window. Not a text summary. Not a bullet list. An actual interactive UI — with your real tasks, your real goals, your real overdue items — rendered as clickable, actionable cards. You can check off a task and it marks it done in Notion instantly. You can click any item and open it directly in Notion. All without leaving Claude.

This is what `@json-render/mcp` makes possible — and nobody had built this use case yet.

---

## The Demo

**GitHub:** [https://github.com/Garinmckayl/chief-of-staff](https://github.com/Garinmckayl/chief-of-staff)

<!-- Add your demo video here -->

### What you see when you type "Give me my morning briefing"

**1. Focus Card** — The single most important thing right now. Not a list. The one thing. With one sentence on why it matters today.

**2. Overdue tasks** — In red. Surfaced first. No hiding from them.

**3. This week's tasks** — Ranked, with due dates and status pulled live from your Notion databases.

**4. Goal progress** — Visual progress bars showing where each goal stands, pulled from whatever Notion database you track goals in.

**5. Insight badges** — Short observations. *"You have 4 overdue items — most from last week."* *"3 of your 5 goals haven't been touched this week."*

**6. One-click actions** — Check off a task right in the dashboard. It marks done in Notion immediately via MCP.

The whole thing takes about 4 seconds from typing the prompt to a fully populated interactive dashboard. Every piece of data is live from your Notion workspace — not a mock, not hardcoded sample data.

---

## How I Used Notion MCP

Chief of Staff uses Notion MCP in a way that feels genuinely new.

Most tools that integrate with Notion use it as a destination — they write notes, they save summaries, they dump data. Chief of Staff uses Notion as a **live operating system**. It reads your workspace structure dynamically, adapts to however you've organized things, and surfaces what matters in a UI that lives inside your AI tool.

### Two MCP tools power the whole thing

**`get_notion_briefing_data`** — Queries your Notion workspace live. It doesn't require a specific database structure. It searches for databases that look like task lists (have Status or Due Date properties) and databases that look like goal trackers (have Progress properties). It adapts to how *you* already use Notion, not how I think you should use it.

```typescript
// Finds your task databases dynamically — no hardcoded IDs
const searchData = await notionFetch("/search", {
  filter: { property: "object", value: "database" },
  page_size: 20,
});

// Identifies task-like databases by their property structure
const hasStatus = propNames.some(p => p === "status" || p.includes("status"));
const hasDue = propNames.some(p => p.includes("due") || p.includes("deadline"));
```

**`complete_notion_task`** — When you click a checkbox in the dashboard, this fires. It marks the task done in Notion using whatever status system you have — tries `Status: Done`, falls back to a `Done` checkbox, falls back to archiving the page.

```typescript
// Tries every status pattern — works with any Notion setup
await notionPatch(`/pages/${taskId}`, {
  properties: { Status: { status: { name: "Done" } } },
});
```

### The MCP App layer

The third piece is `@json-render/mcp` — a library that lets you register an interactive React app as an MCP tool. When Claude calls `chief_of_staff_briefing`, instead of returning text, it returns a spec that renders a live shadcn/ui dashboard inside the chat window.

```typescript
const server = await createMcpApp({
  name: "Chief of Staff",
  version: "1.0.0",
  catalog,   // defines what components Claude can generate
  html,      // the self-contained React app bundled by Vite
});
```

The catalog tells Claude exactly what components exist — `FocusCard`, `TaskList`, `TaskRow`, `GoalProgress`, `InsightBadge` — and Claude generates a JSON spec that the iframe renders as a real UI. The AI is generating the layout on every call, populated with your live Notion data. It's generative UI, not a hardcoded template.

This is the combination that makes Chief of Staff feel like something from the future: Notion as the live data source, MCP as the transport, `@json-render/mcp` as the rendering layer, all meeting inside Claude.

---

## Technical Stack

| Layer | What |
|-------|------|
| **MCP server** | `@modelcontextprotocol/sdk` — stdio + HTTP transports |
| **Generative UI** | `@json-render/mcp` + `@json-render/shadcn` |
| **UI components** | shadcn/ui rendered inside Claude's chat window |
| **Notion data** | Notion REST API — dynamic workspace discovery |
| **Bundler** | Vite + `vite-plugin-singlefile` (single self-contained HTML) |
| **Runtime** | Node.js + tsx for TypeScript execution |

### Running it

```bash
# Clone and install
git clone https://github.com/Garinmckayl/chief-of-staff
cd chief-of-staff && npm install

# Build the iframe React app
npm run build

# Run via stdio (Claude Desktop / VS Code Copilot)
NOTION_API_KEY=your_key npm run start:stdio

# Or run via HTTP (claude.ai web, remote clients)
NOTION_API_KEY=your_key npm run start
```

**Claude Desktop config:**
```json
{
  "mcpServers": {
    "chief-of-staff": {
      "command": "node",
      "args": ["--import", "tsx/esm", "/path/to/chief-of-staff/server.ts", "--stdio"],
      "env": { "NOTION_API_KEY": "your_key_here" }
    }
  }
}
```

Works in VS Code Copilot too via `.vscode/mcp.json` — the repo includes a `devcontainer.json` so you can test it instantly in GitHub Codespaces with zero local setup.

---

## Why This Matters Beyond the Hackathon

Every solo founder, every freelancer, every person running their life out of Notion instead of a full ops team — they're all paying this tax. The morning reconstruction. The mental overhead of figuring out what actually matters today before you can actually start working.

We talk a lot about AI agents that will do work for you. But before you can delegate work, you need to know what the work is. That clarity — knowing the one thing, knowing what's overdue, knowing where your goals stand — that's what a chief of staff does for a CEO. It's the $200,000/year hire that most people can never afford.

Notion is already where the information lives. MCP is the bridge that lets an AI reach in and read it. `@json-render/mcp` is what turns that read into something you can act on without switching contexts.

Chief of Staff is what happens when you put those three things together and ask: *what's the most useful thing I could build for someone running everything alone?*

---

*Built for the Notion MCP Challenge.*
*GitHub: [https://github.com/Garinmckayl/chief-of-staff](https://github.com/Garinmckayl/chief-of-staff)*
