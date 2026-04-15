# 🗓️ Notion Daily Todo Automation

A lightweight personal productivity system that combines **Notion + Google Calendar + GitHub Actions**.

Automatically creates daily notes, manages tasks, and syncs time-based tasks to your calendar with notifications.

---

## ✨ Features

- ✅ Auto-create daily notes (with template)
- ✅ Kanban-style task management
- ✅ Automatic carryover of unfinished tasks
- ✅ Clean separation of daily context vs tasks
- ✅ ⏰ Time-based tasks sync to Google Calendar
- ✅ 🔔 Automatic reminders via calendar
- ✅ 🔄 Tasks update & delete in calendar automatically
- ✅ 🔗 Click calendar event → open Notion task

---

## ⚡ Quick Setup (5–10 min)

### 1. Notion Setup

Create 2 databases:

**Daily Notes**
- Name (Title)
- Date (Date)

**Tasks**
- Name (Title)
- Status (Backlog / In Progress / Done)
- Day (Relation → Daily Notes)
- Carryover (Checkbox)
- Carried From (Text)

**(Optional for Calendar Sync)**
- Reminder At (Date with time)
- Duration (min) (Number)
- Google Event ID (Text)

---

### 2. Create Daily Template

Inside Daily Notes:

- Main goal section
- Linked Tasks view
  - Filter: Day contains This page
  - Group by Status

---

### 3. Create Notion Integration

- Go to Notion → Settings → Integrations
- Create Internal Integration
- Copy token
- Share both databases with it

---

### 4. Get Notion IDs

From URLs:

- DAILY_DB_ID
- TASKS_DB_ID
- TEMPLATE_PAGE_ID

---

### 5. Add GitHub Secrets

NOTION_TOKEN
DAILY_DB_ID
TASKS_DB_ID
TEMPLATE_PAGE_ID

---

### 6. (Optional) Google Calendar Sync

#### Create Calendar
- Create a new calendar (e.g. Notion Tasks)
- Copy Calendar ID

#### Google Cloud Setup
- Create project
- Enable Google Calendar API
- Create Service Account
- Download JSON key
- Share calendar with service account email

#### Add Secrets

GOOGLE_CALENDAR_ID
GOOGLE_SERVICE_ACCOUNT_KEY

---

### 7. Run Workflows

- Daily workflow → creates notes + carryover
- Sync workflow → updates Google Calendar

---

## 📐 Architecture

### Daily Notes (Database)
Each row = one day.

Includes:
- Main goal
- Linked tasks
- Notes / ideas

---

### Tasks (Database)

Core:
- Name
- Status
- Day
- Carryover
- Carried From

Calendar:
- Reminder At
- Duration (min)
- Google Event ID

---

## ⚙️ Automation

### 🟢 Daily Notes Workflow
Runs once per day:

- Creates today's note
- Applies template
- Moves unfinished tasks from yesterday

---

### 🔵 Calendar Sync Workflow
Runs every 10 minutes:

| Condition | Action |
|----------|--------|
| Has time | Create event |
| Time changed | Update event |
| Done | Delete event |
| No time | Ignore |

---

## 🔁 Task Behavior

| Case | Result |
|-----|--------|
| No time | Not scheduled |
| Has time | Calendar event |
| No duration | Default 30 min |
| Done | Event removed |

---

## 🆓 Free Tier Usage

- GitHub Actions: ~200 min/month
- Notion API: Safe
- Google Calendar API: Minimal usage

---

## 👤 Built With

- Notion
- GitHub Actions
- Notion API
- Google Calendar API
- Node.js
