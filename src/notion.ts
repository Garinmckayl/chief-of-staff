/**
 * Notion data layer for Chief of Staff.
 *
 * Uses the Notion REST API directly (fetch + 2022-06-28 version) to avoid
 * SDK version compatibility issues. All reads are direct fetch calls.
 * Task completion uses PATCH /v1/pages.
 */

export interface Task {
  id: string;
  title: string;
  status: string | null;
  dueDate: string | null;
  isOverdue: boolean;
  priority: "urgent" | "high" | "normal" | "low" | null;
  url: string;
  databaseName: string;
}

export interface Goal {
  id: string;
  title: string;
  progress: number;
  status: string | null;
  url: string;
}

export interface WorkspaceSnapshot {
  overdueTasks: Task[];
  todayTasks: Task[];
  weekTasks: Task[];
  goals: Goal[];
  fetchedAt: string;
}

const API = "https://api.notion.com/v1";
const VERSION = "2022-06-28";

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    "Notion-Version": VERSION,
    "Content-Type": "application/json",
  };
}

async function notionFetch(path: string, body?: object): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Notion ${path}: ${res.status}`);
  return res.json();
}

async function notionPatch(path: string, body: object): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Notion PATCH ${path}: ${res.status}`);
  return res.json();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractTitle(page: any): string {
  const props = page.properties ?? {};
  for (const key of Object.keys(props)) {
    const prop = props[key];
    if (prop.type === "title" && prop.title?.length > 0) {
      return prop.title.map((t: any) => t.plain_text).join("").trim() || "Untitled";
    }
  }
  return "Untitled";
}

function extractStatus(page: any): string | null {
  const props = page.properties ?? {};
  for (const key of Object.keys(props)) {
    const prop = props[key];
    if (prop.type === "status") return prop.status?.name || null;
    if (prop.type === "select" && key.toLowerCase().includes("status"))
      return prop.select?.name || null;
  }
  return null;
}

function extractDueDate(page: any): string | null {
  const props = page.properties ?? {};
  for (const key of Object.keys(props)) {
    const prop = props[key];
    if (prop.type !== "date") continue;
    const k = key.toLowerCase();
    if (k.includes("due") || k.includes("date") || k.includes("deadline"))
      return prop.date?.start || null;
  }
  return null;
}

function extractProgress(page: any): number {
  const props = page.properties ?? {};
  for (const key of Object.keys(props)) {
    const prop = props[key];
    const k = key.toLowerCase();
    if (prop.type === "number" && (k.includes("progress") || k.includes("percent"))) {
      const val = prop.number;
      if (typeof val === "number") return val > 1 ? Math.min(100, val) : Math.round(val * 100);
    }
    if (prop.type === "formula" && typeof prop.formula?.number === "number") {
      const val = prop.formula.number;
      return val > 1 ? Math.min(100, val) : Math.round(val * 100);
    }
  }
  return 0;
}

function isTaskDone(status: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return ["done", "complete", "completed", "closed", "finished"].includes(s);
}

function parsePriority(page: any): "urgent" | "high" | "normal" | "low" | null {
  const props = page.properties ?? {};
  for (const key of Object.keys(props)) {
    const prop = props[key];
    if (!key.toLowerCase().includes("priority")) continue;
    const name = (prop.select?.name || prop.status?.name || "").toLowerCase();
    if (name.includes("urgent")) return "urgent";
    if (name.includes("high")) return "high";
    if (name.includes("low")) return "low";
    return "normal";
  }
  return null;
}

function pageToTask(page: any, dbName: string): Task {
  const dueDate = extractDueDate(page);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = dueDate ? new Date(dueDate) < today : false;

  return {
    id: page.id,
    title: extractTitle(page),
    status: extractStatus(page),
    dueDate,
    isOverdue,
    priority: parsePriority(page),
    url: page.url,
    databaseName: dbName,
  };
}

// ─── Main fetch ───────────────────────────────────────────────────────────────

export async function fetchWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split("T")[0];

  // Search for all databases
  const searchData = await notionFetch("/search", {
    filter: { property: "object", value: "database" },
    page_size: 20,
  });

  const taskDbs: { id: string; name: string }[] = [];
  const goalDbs: { id: string; name: string }[] = [];

  for (const db of searchData.results ?? []) {
    const props = db.properties ?? {};
    const propNames = Object.keys(props).map((k: string) => k.toLowerCase());
    const title = (db.title as any[])?.[0]?.plain_text || "Untitled";

    const hasStatus = propNames.some((p) => p === "status" || p.includes("status"));
    const hasDue = propNames.some((p) => p.includes("due") || p.includes("deadline") || p.includes("date"));
    const hasProgress = propNames.some((p) => p.includes("progress") || p.includes("percent"));

    // A DB with a progress/percent field is a goal DB — don't treat it as tasks
    if (hasProgress) {
      goalDbs.push({ id: db.id, name: title });
    } else if (hasStatus || hasDue) {
      taskDbs.push({ id: db.id, name: title });
    }
  }

  // Query task databases
  const allTasks: Task[] = [];
  for (const db of taskDbs.slice(0, 5)) {
    try {
      const data = await notionFetch(`/databases/${db.id}/query`, { page_size: 30 });
      for (const page of data.results ?? []) {
        const task = pageToTask(page, db.name);
        if (!isTaskDone(task.status)) allTasks.push(task);
      }
    } catch {
      // Skip inaccessible databases
    }
  }

  // Query goal databases
  const goals: Goal[] = [];
  for (const db of goalDbs.slice(0, 3)) {
    try {
      const data = await notionFetch(`/databases/${db.id}/query`, { page_size: 10 });
      for (const page of data.results ?? []) {
        goals.push({
          id: page.id,
          title: extractTitle(page),
          progress: extractProgress(page),
          status: extractStatus(page),
          url: page.url,
        });
      }
    } catch {
      // Skip
    }
  }

  const overdueTasks = allTasks.filter((t) => t.isOverdue);
  const todayTasks = allTasks.filter((t) => !t.isOverdue && t.dueDate === todayStr);
  const weekTasks = allTasks.filter(
    (t) => !t.isOverdue && t.dueDate !== todayStr && t.dueDate && t.dueDate <= weekEndStr
  );

  return {
    overdueTasks: overdueTasks.slice(0, 8),
    todayTasks: todayTasks.slice(0, 8),
    weekTasks: weekTasks.slice(0, 8),
    goals: goals.slice(0, 5),
    fetchedAt: now.toISOString(),
  };
}

export async function completeTask(taskId: string): Promise<void> {
  // Read the page first to find the correct Status property type
  let page: any;
  try {
    page = await notionFetch(`/pages/${taskId}`);
  } catch {
    return;
  }

  const props = page.properties ?? {};
  // Find the status key and its type
  for (const key of Object.keys(props)) {
    const prop = props[key];
    const k = key.toLowerCase();
    if (prop.type === "status") {
      // Notion native status type
      try {
        await notionPatch(`/pages/${taskId}`, {
          properties: { [key]: { status: { name: "Done" } } },
        });
        return;
      } catch { /* try next */ }
    }
    if (prop.type === "select" && k.includes("status")) {
      // select field — try common done names
      for (const doneName of ["Done", "Complete", "Completed", "Closed"]) {
        try {
          await notionPatch(`/pages/${taskId}`, {
            properties: { [key]: { select: { name: doneName } } },
          });
          return;
        } catch { /* try next */ }
      }
    }
    if (prop.type === "checkbox" && (k === "done" || k.includes("complet"))) {
      try {
        await notionPatch(`/pages/${taskId}`, {
          properties: { [key]: { checkbox: true } },
        });
        return;
      } catch { /* try next */ }
    }
  }
  // Last resort: archive
  await notionPatch(`/pages/${taskId}`, { archived: true });
}

// ─── Agentic write operations ─────────────────────────────────────────────────

export interface NewTask {
  title: string;
  dueDate?: string;   // ISO date e.g. "2026-03-25"
  priority?: string;  // "urgent" | "high" | "normal" | "low"
  notes?: string;
}

export interface CreatedTask {
  id: string;
  title: string;
  url: string;
}

/**
 * Create multiple tasks in the first available task database.
 * Returns the created pages so the dashboard can render them immediately.
 */
export async function createTasks(tasks: NewTask[]): Promise<CreatedTask[]> {
  // Find the best task database to write into
  const searchData = await notionFetch("/search", {
    filter: { property: "object", value: "database" },
    page_size: 20,
  });

  let targetDb: { id: string; props: Record<string, any> } | null = null;

  for (const db of searchData.results ?? []) {
    const props = db.properties ?? {};
    const propNames = Object.keys(props).map((k: string) => k.toLowerCase());
    const hasStatus = propNames.some((p) => p === "status" || p.includes("status"));
    const hasDue = propNames.some((p) => p.includes("due") || p.includes("date"));
    if (hasStatus || hasDue) {
      targetDb = { id: db.id, props };
      break;
    }
  }

  if (!targetDb) throw new Error("No task database found in your Notion workspace.");

  const dbProps = targetDb.props;
  const created: CreatedTask[] = [];

  for (const task of tasks) {
    // Build properties that match what actually exists in this database
    const properties: Record<string, any> = {};

    // Title (always present)
    const titleKey = Object.keys(dbProps).find((k) => dbProps[k].type === "title") ?? "Name";
    properties[titleKey] = { title: [{ text: { content: task.title } }] };

    // Status
    const statusKey = Object.keys(dbProps).find((k) => dbProps[k].type === "status");
    if (statusKey) {
      properties[statusKey] = { status: { name: "In Progress" } };
    }

    // Due date
    if (task.dueDate) {
      const dateKey = Object.keys(dbProps).find((k) => {
        const kl = k.toLowerCase();
        return dbProps[k].type === "date" && (kl.includes("due") || kl.includes("date") || kl.includes("deadline"));
      });
      if (dateKey) {
        properties[dateKey] = { date: { start: task.dueDate } };
      }
    }

    // Priority
    if (task.priority) {
      const priorityKey = Object.keys(dbProps).find((k) =>
        k.toLowerCase().includes("priority") && (dbProps[k].type === "select" || dbProps[k].type === "status")
      );
      if (priorityKey && dbProps[priorityKey].type === "select") {
        properties[priorityKey] = { select: { name: task.priority.charAt(0).toUpperCase() + task.priority.slice(1) } };
      }
    }

    const children: any[] = [];
    if (task.notes) {
      children.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: task.notes } }] },
      });
    }
    children.push({
      object: "block",
      type: "callout",
      callout: {
        rich_text: [{ type: "text", text: { content: "Created by Chief of Staff agent" } }],
        icon: { type: "emoji", emoji: "🤖" },
        color: "gray_background",
      },
    });

    const page = await notionFetch("/pages", {
      parent: { database_id: targetDb.id },
      properties,
      children,
    });

    created.push({ id: page.id, title: task.title, url: page.url });
  }

  return created;
}

/**
 * Reschedule overdue tasks by pushing their due dates forward.
 * Claude decides the new dates based on priority and workload context.
 */
export async function rescheduleTasks(
  updates: { taskId: string; newDueDate: string; reason: string }[]
): Promise<{ taskId: string; newDueDate: string; success: boolean }[]> {
  const results = [];

  for (const update of updates) {
    try {
      // First get the page to find the right date property key
      const page = await notionFetch(`/pages/${update.taskId}`);
      const props = page.properties ?? {};
      const dateKey = Object.keys(props).find((k) => {
        const kl = k.toLowerCase();
        return props[k].type === "date" && (kl.includes("due") || kl.includes("date") || kl.includes("deadline"));
      });

      if (!dateKey) {
        results.push({ taskId: update.taskId, newDueDate: update.newDueDate, success: false });
        continue;
      }

      await notionPatch(`/pages/${update.taskId}`, {
        properties: { [dateKey]: { date: { start: update.newDueDate } } },
      });

      results.push({ taskId: update.taskId, newDueDate: update.newDueDate, success: true });
    } catch {
      results.push({ taskId: update.taskId, newDueDate: update.newDueDate, success: false });
    }
  }

  return results;
}

/**
 * Fetch tasks completed in the past N days (for weekly review).
 */
export async function fetchCompletedTasks(days = 7): Promise<Task[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split("T")[0];

  const searchData = await notionFetch("/search", {
    filter: { property: "object", value: "database" },
    page_size: 20,
  });

  const completed: Task[] = [];

  for (const db of (searchData.results ?? []).slice(0, 5)) {
    const props = db.properties ?? {};
    const propNames = Object.keys(props).map((k: string) => k.toLowerCase());
    const title = (db.title as any[])?.[0]?.plain_text || "Untitled";
    const hasStatus = propNames.some((p) => p === "status" || p.includes("status"));
    if (!hasStatus) continue;

    try {
      const data = await notionFetch(`/databases/${db.id}/query`, {
        page_size: 50,
        filter: {
          or: [
            { property: "Status", status: { equals: "Done" } },
            { property: "Status", status: { equals: "Complete" } },
            { property: "Status", status: { equals: "Completed" } },
          ],
        },
      });

      for (const page of data.results ?? []) {
        const lastEdited = (page.last_edited_time as string)?.split("T")[0];
        if (lastEdited && lastEdited >= sinceStr) {
          completed.push(pageToTask(page, title));
        }
      }
    } catch {
      // Skip databases that don't support this filter
    }
  }

  return completed;
}

/**
 * Create a weekly review page in Notion.
 * Returns the URL of the created page.
 */
export async function createWeeklyReview(review: {
  weekOf: string;
  wins: string[];
  slipped: string[];
  carries: string[];
  reflection: string;
  completedTaskIds: string[];
}): Promise<string> {
  // Find a page to put the review in (workspace root)
  const blocks: any[] = [
    {
      object: "block", type: "callout",
      callout: {
        rich_text: [{ type: "text", text: { content: `Week of ${review.weekOf} · Generated by Chief of Staff` } }],
        icon: { type: "emoji", emoji: "🤖" },
        color: "blue_background",
      },
    },
    { object: "block", type: "divider", divider: {} },
    {
      object: "block", type: "heading_2",
      heading_2: { rich_text: [{ type: "text", text: { content: "🏆 Wins" } }] },
    },
    ...review.wins.map((w) => ({
      object: "block", type: "bulleted_list_item",
      bulleted_list_item: { rich_text: [{ type: "text", text: { content: w } }] },
    })),
    {
      object: "block", type: "heading_2",
      heading_2: { rich_text: [{ type: "text", text: { content: "⚠️ What Slipped" } }] },
    },
    ...review.slipped.map((s) => ({
      object: "block", type: "bulleted_list_item",
      bulleted_list_item: { rich_text: [{ type: "text", text: { content: s } }] },
    })),
    {
      object: "block", type: "heading_2",
      heading_2: { rich_text: [{ type: "text", text: { content: "➡️ Carries to Next Week" } }] },
    },
    ...review.carries.map((c) => ({
      object: "block", type: "bulleted_list_item",
      bulleted_list_item: { rich_text: [{ type: "text", text: { content: c } }] },
    })),
    { object: "block", type: "divider", divider: {} },
    {
      object: "block", type: "heading_2",
      heading_2: { rich_text: [{ type: "text", text: { content: "💭 Reflection" } }] },
    },
    {
      object: "block", type: "paragraph",
      paragraph: { rich_text: [{ type: "text", text: { content: review.reflection } }] },
    },
  ];

  // Create as a standalone page (no parent database — goes to workspace)
  const page = await notionFetch("/pages", {
    parent: { type: "workspace", workspace: true },
    icon: { type: "emoji", emoji: "📋" },
    properties: {
      title: { title: [{ text: { content: `Weekly Review — ${review.weekOf}` } }] },
    },
    children: blocks,
  });

  return page.url;
}

/**
 * Break a goal down into sub-tasks and create them in Notion.
 */
export async function breakDownGoal(
  goalTitle: string,
  subtasks: NewTask[]
): Promise<CreatedTask[]> {
  // Reuse createTasks — same database, same logic
  return createTasks(subtasks.map((t) => ({
    ...t,
    notes: `Subtask of goal: ${goalTitle}${t.notes ? `\n\n${t.notes}` : ""}`,
  })));
}
