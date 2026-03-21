# Chief of Staff — Demo Recording Guide

## Before you start

- Codespaces running, server started (`bash start.sh`), port 3333 forwarded
- Claude open (claude.ai or Claude Desktop) with Chief of Staff MCP connected
- Your Notion workspace has at least a few tasks in a database with Status and Due Date
- Close all other tabs, Do Not Disturb ON, dock hidden
- Record at 1080p — Loom is fine, window at full width
- Do one full dry run before recording so Claude has context cached

---

## Tools

- **Loom** — screen + mic, free, instant share link
- **CapCut** or **iMovie** — text overlays and cuts
- **Claude** (claude.ai web or desktop) — where the MCP App renders

---

## Scene by scene

---

### SCENE 1 — The Problem (0:00–0:15)

**What to show:** Your actual Notion workspace — 5 different databases open.

**Steps:**
1. Open Notion
2. Show your sidebar — multiple databases visible: Tasks, Goals, Projects, whatever you have
3. Click between 3–4 of them slowly. Don't do anything. Just navigate.
4. Let the audience feel the friction of piecing it together manually

**Narration (speak over the recording):**
> *"Every morning I open Notion. My tasks are here. My goals are over here. Overdue stuff is somewhere. I spend 15 minutes just figuring out what to focus on today. Every single day."*

**Text overlay to add in edit:**
> "Every solo founder pays this tax."
> (white text, bottom left, appears at second 4)

Hold for 12 seconds total.

---

### SCENE 2 — Cut (0:15–0:18)

**In edit:** 3 seconds black. No audio. Then fade in:

> **"It shouldn't cost you 15 minutes."**

Hold 1.5 seconds. Fade out.

---

### SCENE 3 — The Briefing (0:18–0:50)

**This is the core demo. One sentence triggers everything.**

**Steps:**
1. Switch to Claude (full screen)
2. Make sure Chief of Staff MCP is connected (check the tools list — should show 8 tools)
3. Type slowly so the audience can read it:
   > `Give me my morning briefing`
4. Hit enter
5. Watch Claude call `get_notion_briefing_data`, then `chief_of_staff_briefing`
6. The interactive dashboard renders in the chat — **hold on it for 5 full seconds**

**What the audience should see:** A real dashboard with their actual tasks. FocusCard at top. Overdue tasks in red. Goal progress bars. AgentAction buttons at the bottom.

**Narration:**
> *"One sentence. That's it."*

Then silence while the dashboard loads. Let it speak for itself.

**Text overlays (staggered, bottom of screen):**
> "Your real tasks. Your real goals." ← appears when dashboard loads
> "All from Notion. All live." ← appears 3 seconds later

---

### SCENE 4 — Complete a task (0:50–1:05)

**The "it actually works" moment.**

**Steps:**
1. In the dashboard, find a task that's clearly done
2. Click the checkbox next to it
3. The row disappears (optimistic UI)
4. Switch to Notion — show the task is now marked Done

**Narration:**
> *"Check it off here. Done in Notion."*

**Keep this fast — 10 seconds max.** The point lands quickly. Don't linger.

---

### SCENE 5 — The Agent Action (1:05–1:40)

**This is the money shot. This is what nobody else has.**

**Setup:** Make sure you have at least 2–3 overdue tasks in Notion before recording.

**Steps:**
1. Back in the Claude dashboard
2. Zoom in slightly on the AgentAction buttons at the bottom so they're readable
3. Click **"📅 Reschedule overdue tasks"**
4. Watch Claude work:
   - It calls `get_notion_briefing_data` (show this happening)
   - It reasons about new dates
   - It calls `reschedule_overdue_tasks`
5. Expand the tool call result so the audience can see the JSON with `reason` fields — Claude explaining *why* it picked each date
6. Switch to Notion — the due dates are updated. Show this clearly.

**Narration:**
> *"This is the part that's different. It doesn't tell you what to do — it goes and does it."*

Then when Notion is shown:
> *"New due dates. In Notion. Decided and written by the agent."*

**Text overlay:**
> "The agent does the work."
> "Notion is the output."

**Hold on the updated Notion tasks for 3 full seconds.** This is what the judges will screenshot.

---

### SCENE 6 — Plan my week (1:40–1:55)

**Fast cut — show the create action working.**

**Steps:**
1. Back in Claude
2. Click **"⚡ Plan my week"** AgentAction button
3. Claude calls `create_notion_tasks` — show the tool call briefly
4. Cut immediately to Notion — 4–6 new tasks exist that weren't there before
5. Click one to show it has full content: status, due date, "Created by Chief of Staff agent" callout

**Narration:**
> *"Or plan the whole week. From scratch. Tasks in Notion in seconds."*

**Keep this to 15 seconds.** It's a flex, not the main event.

---

### SCENE 7 — End card (1:55–2:00)

**In edit:** Black screen, white text, appears line by line:

```
You don't need a chief of staff.

You need Chief of Staff.

github.com/Garinmckayl/chief-of-staff
```

Fade to black.

---

## Audio notes

- **Speak the narration yourself** — your accent and voice make this personal and real. Don't use AI voiceover.
- Keep the mic close, room quiet. Loom's built-in mic is fine.
- **No background music.** The tool call sounds (Claude thinking, typing) are your soundtrack.
- Narration lines above are guides — say them naturally, not word for word.

---

## What NOT to show

- Don't show any setup steps (installing, configuring the MCP server) — start from Claude already connected
- Don't read tool names aloud — just let Claude work and show the output
- Don't apologize if Claude takes a few seconds — silence is fine, it builds anticipation
- Don't show the full JSON output of tool calls — just a quick glimpse, then cut to Notion

---

## Edit checklist

- [ ] Scene 1: Notion friction, 12 seconds, narration + text overlay
- [ ] Scene 2: 3 seconds black, "It shouldn't cost you 15 minutes"
- [ ] Scene 3: Dashboard loads from one sentence, hold 5 seconds, overlays
- [ ] Scene 4: Task checked off, confirmed in Notion, under 10 seconds
- [ ] Scene 5: Reschedule agent runs, Notion updated, hold 3 seconds on result
- [ ] Scene 6: Plan my week, new tasks in Notion, 15 seconds
- [ ] Scene 7: End card with GitHub URL
- [ ] Total runtime: under 2 minutes
- [ ] Export at 1080p

---

## Submission checklist after video

- [ ] Upload to YouTube (unlisted) or Loom
- [ ] Paste link in SUBMISSION.md where it says `<!-- Add demo video here -->`
- [ ] Set `published: true` in SUBMISSION.md frontmatter
- [ ] Cover image: black background, white text "Your Notion workspace. Automated." — 1000×420px in Canva, 5 minutes
- [ ] Submit before March 29
