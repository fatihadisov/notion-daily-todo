# 🗓️ Notion Daily Todo Automation

Automatically creates a new daily note in Notion every day with:

-   ✅ Pre-filled daily layout (main goal, Kanban, questions, etc.)
-   ✅ Kanban board powered by a Tasks database
-   ✅ Automatic carryover of unfinished tasks (Backlog + In Progress)
-   ✅ Done tasks stay in the original day

Runs using **GitHub Actions (cron job)** + **Notion API**.

------------------------------------------------------------------------

# 📐 Architecture Overview

## Notion Structure

### 1️⃣ Daily Notes (Database)

Each row = one day.

Properties:

-   `Name` (Title)
-   `Date` (Date)

Template inside Daily Notes: - **Today's main goal** - Linked Kanban
view of Tasks - Filter: `Day contains This page` - Grouped by `Status` -
Questions / Idea sections (optional)

------------------------------------------------------------------------

### 2️⃣ Tasks (Database)

Each Kanban card is a real Task page.

Properties:

-   `Name` (Title)
-   `Status` (Status)
    -   Backlog
    -   In Progress
    -   Done
-   `Day` (Relation → Daily Notes)
-   `Carryover` (Checkbox)
-   `Carried From` (Text)

------------------------------------------------------------------------

### 3️⃣ Todo Page (Folder-style view)

A normal Notion page that contains:

-   A linked view of **Daily Notes**
-   Sorted by `Date (Descending)`

Example structure:

Todo ├── 2026-Mar-02 Mon ├── 2026-Mar-01 Sun ├── 2026-Feb-28 Sat

------------------------------------------------------------------------

# ⚙️ What the Automation Does

Every day at 00:05 (Asia/Baku time):

1.  Checks if today's Daily Note exists
2.  If not:
    -   Creates it
    -   Applies your template automatically
3.  Finds yesterday's Daily Note
4.  Moves all tasks where:
    -   `Status != Done`
    -   `Day = yesterday`
5.  Updates them to:
    -   `Day = today`
    -   `Carryover = true`
    -   `Carried From = yesterday title`

------------------------------------------------------------------------

# 🔁 Daily Behavior

  Yesterday Status   Today
  ------------------ ----------------
  Done               ❌ Not carried
  Backlog            ✅ Carried
  In Progress        ✅ Carried

Tasks are moved, not duplicated.

------------------------------------------------------------------------

# 🚀 Setup Guide

## 1️⃣ Create Notion Integration

1.  Go to Notion → Settings → Integrations
2.  Create **Internal Integration**
3.  Copy the **Internal Integration Token**
4.  Give it access to:
    -   Daily Notes database
    -   Tasks database

------------------------------------------------------------------------

## 2️⃣ Get Required IDs

From Notion URLs:

Daily Notes Database ID:
https://www.notion.so/`<DATABASE_ID>`{=html}?v=...

Tasks Database ID: https://www.notion.so/`<DATABASE_ID>`{=html}?v=...

Template Page ID:
https://www.notion.so/`<PAGE_NAME>`{=html}-`<PAGE_ID>`{=html}

------------------------------------------------------------------------

## 3️⃣ Add GitHub Secrets

Add the following in your repo:

NOTION_TOKEN\
DAILY_DB_ID\
TASKS_DB_ID\
TEMPLATE_PAGE_ID

------------------------------------------------------------------------

## 4️⃣ GitHub Workflow

Runs daily via cron:

schedule: - cron: "5 20 \* \* \*" \# 00:05 Asia/Baku (UTC+4)

------------------------------------------------------------------------

# 🆓 Free Tier Safety

-   GitHub Actions: \~2000 minutes/month
-   This script uses \~10--20 minutes/month
-   Notion API: 3 requests/sec limit
-   Typical usage: \~10--30 requests/day

Safe for free tier usage.

------------------------------------------------------------------------

# 👤 Built With

-   Notion
-   GitHub Actions
-   Notion API (v5)
-   Node.js

------------------------------------------------------------------------

If you'd like enhancements (weekly reports, Slack notifications, streak
tracking), they can easily be added.
