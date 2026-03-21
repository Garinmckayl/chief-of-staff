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

    if (hasStatus || hasDue) taskDbs.push({ id: db.id, name: title });
    if (hasProgress) goalDbs.push({ id: db.id, name: title });
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
  try {
    await notionPatch(`/pages/${taskId}`, {
      properties: { Status: { status: { name: "Done" } } },
    });
  } catch {
    try {
      await notionPatch(`/pages/${taskId}`, {
        properties: { Done: { checkbox: true } },
      });
    } catch {
      await notionPatch(`/pages/${taskId}`, { archived: true });
    }
  }
}
