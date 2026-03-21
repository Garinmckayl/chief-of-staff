---
title: Chief of Staff — I Built an Agent That Actually Does the Work, Not Just Shows It
published: false
tags: devchallenge, notionchallenge, mcp, ai
---

*This is a submission for the [Notion MCP Challenge](https://dev.to/challenges/notion-2026-03-04)*

---

## The Real Problem

I'm 24. Dropped out. Building an AI startup from Addis Ababa, Ethiopia.

I don't have a team. No chief of staff, no ops person, no project manager. I have Notion — because that's where everything lives. My tasks, goals, decisions, half-finished ideas at 2am. Every piece of my startup is in there.

But every morning I do the same thing: open Notion, spend 15-20 minutes manually reconstructing what's urgent. What's overdue. What the actual priority is. I open five databases, piece it together in my head, and hold it in working memory while I try to actually work.

That's the tax. And it compounds — every bit of mental energy spent on ops is energy not spent building.

Most people's answer to this is "use an AI dashboard." I've seen them. They show you a pretty summary. Then you still have to go back to Notion, manually create the tasks, manually reschedule the overdue ones, manually write the weekly review. The AI showed you the problem. You still do all the work.

That's not a chief of staff. That's a more expensive calendar view.

I built something different.

---

## What I Built

**Chief of Staff is an MCP App that doesn't just show you what's in Notion — it acts on it.**

You type: *"Give me my morning briefing."*

A live interactive dashboard materializes inside Claude — your real tasks, real goals, real overdue items. But at the bottom of every briefing are action buttons. Not links to Notion. Not "here's what you should do." Buttons that, when clicked, tell Claude to go do the work:

- **⚡ Plan my week** → Claude generates a full task breakdown based on your goals and creates all the tasks directly in your Notion database. You review. Done.
- **📅 Reschedule overdue tasks** → Claude looks at everything overdue, decides sensible new dates based on priority, and updates them all in Notion. Spreads the work out. No more guilt pile.
- **📋 Write weekly review** → Claude pulls everything you completed in the past 7 days, synthesizes what went well, what slipped, what carries forward, and writes a full structured page into your Notion workspace.
- **🎯 Break down stalled goal** → Claude takes a goal that's been sitting with no progress and generates 4-6 concrete sub-tasks with due dates, creating them all in Notion.

The briefing is the interface. Notion is where the work actually lands.

---

## Demo

**GitHub:** [https://github.com/Garinmckayl/chief-of-staff](https://github.com/Garinmckayl/chief-of-staff)

<!-- Add demo video here -->

---

## How I Used Notion MCP

Notion MCP is the reason this works at all. Without it, you'd have to build separate API integrations for every Notion action. With it, Claude can read and write your entire workspace through a single protocol — and the agent tools are just natural language descriptions of what needs to happen.

### The 8 MCP tools

| Tool | What it does |
|------|-------------|
| `chief_of_staff_briefing` | Renders the interactive dashboard (MCP App) |
| `get_notion_briefing_data` | Reads your workspace snapshot — finds task and goal databases dynamically |
| `complete_notion_task` | Marks a single task done |
| `create_notion_tasks` | Claude writes a generated task plan straight into your Notion database |
| `reschedule_overdue_tasks` | Updates due dates on overdue tasks — Claude picks the dates |
| `write_weekly_review` | Creates a full structured weekly review page in Notion |
| `break_down_goal` | Generates sub-tasks for a stalled goal and creates them in Notion |
| `get_completed_tasks` | Fetches done tasks from the past N days for the weekly review |

### The agentic loop

The key insight is that the dashboard and the agent tools are two parts of the same system. The briefing tells you the situation. The `AgentAction` buttons trigger Claude to fix it.

When you click "Reschedule overdue tasks," Claude gets a `run_agent` event with `tool: "reschedule_overdue_tasks"`. It then calls `get_notion_briefing_data` to see what's overdue, reasons about sensible new dates (urgent things get earliest slots, low priority can slide two weeks), and calls `reschedule_overdue_tasks` with the full update list. Notion gets patched. Done. You didn't touch a single page.

```typescript
// Claude generates dates — the tool just executes
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
      reason: z.string(),  // Claude explains its reasoning
    })),
  },
  async ({ updates }) => {
    const results = await rescheduleTasks(updates);
    return { content: [{ type: "text", text: JSON.stringify(results) }] };
  }
);
```

The `reason` field matters. Claude isn't just moving dates — it's explaining why. You can see the reasoning in the tool call output. That's what makes this feel like an actual chief of staff, not a script.

### Dynamic workspace discovery

The system works with any Notion workspace structure — no hardcoded database IDs. It discovers your databases by their property shapes:

```typescript
// Finds task databases by what they contain
const hasStatus = propNames.some(p => p === "status" || p.includes("status"));
const hasDue = propNames.some(p => p.includes("due") || p.includes("deadline"));
if (hasStatus || hasDue) taskDbs.push({ id: db.id, name: title });
```

When writing tasks back, it reads the target database's actual schema and maps to whatever properties exist — so it works whether your task database uses a Status column, a Done checkbox, or a Priority select.

### The MCP App layer

The interactive dashboard uses `@json-render/mcp` — a library that lets you serve a full React app as an MCP tool. When Claude calls `chief_of_staff_briefing`, instead of returning text it returns a JSON spec that an iframe renders as a live shadcn/ui dashboard inside the chat. The catalog defines every component Claude can generate — `FocusCard`, `TaskList`, `TaskRow`, `GoalProgress`, `InsightBadge`, `AgentAction` — and Claude fills it with your real data.

The `AgentAction` component is the bridge: a button in the visual UI that fires a `run_agent` event, which Claude receives and routes to the right MCP tool. The visual layer and the execution layer are the same system.

---

## Technical Stack

| Layer | What |
|-------|------|
| **MCP server** | `@modelcontextprotocol/sdk` — stdio + HTTP transports |
| **Generative UI** | `@json-render/mcp` + `@json-render/shadcn` |
| **Notion writes** | Direct REST API (dynamic schema detection) |
| **Bundler** | Vite + `vite-plugin-singlefile` |
| **Runtime** | Node.js + tsx |

**Run it:**
```bash
git clone https://github.com/Garinmckayl/chief-of-staff
cd chief-of-staff && npm install && npm run build
NOTION_API_KEY=your_key npm run start:stdio
```

Or test instantly with GitHub Codespaces — the repo includes `devcontainer.json` with everything pre-configured.

---

## Why the Agentic Part Matters

An AI that shows you a prettier view of what you already have isn't worth much. The real value is when the AI can act — when seeing the problem and fixing the problem are one motion.

Every solo founder, every freelancer, every person running their life out of Notion instead of a full ops team has the same problem: too much to hold in your head, not enough hours to process it all. A chief of staff doesn't just brief the CEO. They handle the things that don't need the CEO's judgment — the rescheduling, the status pages, the weekly synthesis. That's what this does.

Notion MCP is what makes the write path real. The agent isn't generating text and asking you to copy-paste it into Notion. It's writing directly into your workspace, in the right databases, with the right schema. The distinction matters: one is a better search, the other is actual delegation.

---

*Built for the Notion MCP Challenge.*
*GitHub: [https://github.com/Garinmckayl/chief-of-staff](https://github.com/Garinmckayl/chief-of-staff)*
