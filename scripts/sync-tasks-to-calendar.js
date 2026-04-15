import { Client } from "@notionhq/client";
import { google } from "googleapis";

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: "2025-09-03",
});

const TASKS_DB_ID = process.env.TASKS_DB_ID;
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

const DEFAULT_DURATION_MIN = 30;

// 🔐 Google Auth
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
  scopes: ["https://www.googleapis.com/auth/calendar"],
});

const calendar = google.calendar({ version: "v3", auth });

// ---------- Helpers ----------

function hasTime(dateStr) {
  return dateStr.includes("T");
}

function addMinutes(dateStr, minutes) {
  const date = new Date(dateStr);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function getProp(task, name) {
  return task.properties[name];
}

// ---------- Core ----------

async function getTasksDataSourceId() {
  const db = await notion.databases.retrieve({ database_id: TASKS_DB_ID });
  return db.data_sources[0].id;
}

async function getTasks(dsId) {
  const res = await notion.dataSources.query({
    data_source_id: dsId,
  });
  return res.results;
}

async function createEvent({ summary, start, end, description }) {
  const res = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary,
      description,
      start: { dateTime: start },
      end: { dateTime: end },
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: 10 }],
      },
    },
  });

  return res.data.id;
}

async function updateEvent(eventId, { summary, start, end, description }) {
  await calendar.events.update({
    calendarId: CALENDAR_ID,
    eventId,
    requestBody: {
      summary,
      description,
      start: { dateTime: start },
      end: { dateTime: end },
    },
  });
}

async function deleteEvent(eventId) {
  try {
    await calendar.events.delete({
      calendarId: CALENDAR_ID,
      eventId,
    });
  } catch (e) {
    console.log("Event already deleted:", eventId);
  }
}

// ---------- Main ----------

async function main() {
  const dsId = await getTasksDataSourceId();
  const tasks = await getTasks(dsId);

  for (const task of tasks) {
    const name =
      getProp(task, "Name")?.title?.[0]?.plain_text ?? "Untitled";

    const status = getProp(task, "Status")?.status?.name;
    const reminder = getProp(task, "Reminder At")?.date?.start;
    const duration =
      getProp(task, "Duration (min)")?.number ?? DEFAULT_DURATION_MIN;
    const eventId = getProp(task, "Google Event ID")?.rich_text?.[0]?.plain_text;

    const carriedFrom =
      getProp(task, "Carried From")?.rich_text?.[0]?.plain_text ?? "";

    const isDone = status === "Done";
    const hasReminder = reminder && hasTime(reminder);

    // ---------- DELETE ----------
    if ((!hasReminder || isDone) && eventId) {
      await deleteEvent(eventId);

      await notion.pages.update({
        page_id: task.id,
        properties: {
          "Google Event ID": { rich_text: [] },
        },
      });

      console.log("Deleted event:", name);
      continue;
    }

    // ---------- SKIP ----------
    if (!hasReminder) continue;

    const start = reminder;
    const end = addMinutes(reminder, duration);

    const notionUrl = `https://www.notion.so/${task.id.replace(/-/g, "")}`;

    const description = `
    🔗 Open in Notion:
    ${notionUrl}
    
    Status: ${status}
    ${carriedFrom ? `Carried From: ${carriedFrom}` : ""}
    `.trim();

    // ---------- UPDATE ----------
    if (eventId) {
      await updateEvent(eventId, {
        summary: `Task: ${name}`,
        start,
        end,
        description,
      });

      console.log("Updated:", name);
    } else {
      // ---------- CREATE ----------
      const newEventId = await createEvent({
        summary: `Task: ${name}`,
        start,
        end,
        description,
      });

      await notion.pages.update({
        page_id: task.id,
        properties: {
          "Google Event ID": {
            rich_text: [{ text: { content: newEventId } }],
          },
        },
      });

      console.log("Created:", name);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});