import { Client } from "@notionhq/client";
import { google } from "googleapis";

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: "2025-09-03",
});

const TASKS_DB_ID = process.env.TASKS_DB_ID;
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

const DEFAULT_DURATION_MIN = 30;

// Google Auth
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
  scopes: ["https://www.googleapis.com/auth/calendar"],
});

const calendar = google.calendar({ version: "v3", auth });

// ---------- Helpers ----------

function hasTime(dateStr) {
  return typeof dateStr === "string" && dateStr.includes("T");
}

function addMinutes(dateStr, minutes) {
  const date = new Date(dateStr);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function getProp(task, name) {
  return task.properties[name];
}

async function getCalendarTimeZone() {
  const res = await calendar.calendars.get({
    calendarId: CALENDAR_ID,
  });

  return res.data.timeZone || "UTC";
}

// ---------- Notion ----------

async function getTasksDataSourceId() {
  const db = await notion.databases.retrieve({ database_id: TASKS_DB_ID });
  const ds = db.data_sources?.[0];
  if (!ds?.id) {
    throw new Error(`No data source found for database ${TASKS_DB_ID}`);
  }
  return ds.id;
}

async function getTasks(dsId) {
  const results = [];
  let hasMore = true;
  let nextCursor = undefined;

  while (hasMore) {
    const res = await notion.dataSources.query({
      data_source_id: dsId,
      start_cursor: nextCursor,
    });

    results.push(...res.results);
    hasMore = res.has_more;
    nextCursor = res.next_cursor ?? undefined;
  }

  return results;
}

// ---------- Google Calendar ----------

async function createEvent({ summary, start, end, description, timeZone }) {
  const res = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary,
      description,
      start: {
        dateTime: start,
        timeZone,
      },
      end: {
        dateTime: end,
        timeZone,
      },
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: 10 }],
      },
    },
  });

  return res.data.id;
}

async function updateEvent(eventId, { summary, start, end, description, timeZone }) {
  await calendar.events.update({
    calendarId: CALENDAR_ID,
    eventId,
    requestBody: {
      summary,
      description,
      start: {
        dateTime: start,
        timeZone,
      },
      end: {
        dateTime: end,
        timeZone,
      },
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: 10 }],
      },
    },
    sendUpdates: "none",
  });
}

async function deleteEvent(eventId) {
  try {
    await calendar.events.delete({
      calendarId: CALENDAR_ID,
      eventId,
      sendUpdates: "none",
    });
  } catch (e) {
    console.log("Event already deleted or missing:", eventId);
  }
}

// ---------- Main ----------

async function main() {
  if (
    !process.env.NOTION_TOKEN ||
    !TASKS_DB_ID ||
    !CALENDAR_ID ||
    !process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  ) {
    throw new Error(
      "Missing env vars: NOTION_TOKEN, TASKS_DB_ID, GOOGLE_CALENDAR_ID, GOOGLE_SERVICE_ACCOUNT_KEY"
    );
  }

  const timeZone = await getCalendarTimeZone();
  console.log("Using calendar time zone:", timeZone);

  const dsId = await getTasksDataSourceId();
  const tasks = await getTasks(dsId);

  for (const task of tasks) {
    const name = getProp(task, "Name")?.title?.[0]?.plain_text ?? "Untitled";
    const status = getProp(task, "Status")?.status?.name ?? "";
    const reminder = getProp(task, "Reminder At")?.date?.start ?? null;
    const duration =
      getProp(task, "Duration (min)")?.number ?? DEFAULT_DURATION_MIN;
    const eventId =
      getProp(task, "Google Event ID")?.rich_text?.[0]?.plain_text ?? "";

    const carriedFrom =
      getProp(task, "Carried From")?.rich_text?.[0]?.plain_text ?? "";

    const isDone = status === "Done";
    const shouldSync = reminder && hasTime(reminder) && !isDone;

    // Delete linked event if task no longer qualifies
    if (!shouldSync && eventId) {
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

    // No timed reminder, nothing to do
    if (!shouldSync) continue;

    const start = reminder;
    const end = addMinutes(reminder, duration);
    const notionUrl = `https://www.notion.so/${task.id.replace(/-/g, "")}`;

    const description = [
      `Open in Notion: ${notionUrl}`,
      `Status: ${status}`,
      carriedFrom ? `Carried From: ${carriedFrom}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    if (eventId) {
      await updateEvent(eventId, {
        summary: `Task: ${name}`,
        start,
        end,
        description,
        timeZone,
      });

      console.log("Updated:", name);
    } else {
      const newEventId = await createEvent({
        summary: `Task: ${name}`,
        start,
        end,
        description,
        timeZone,
      });

      await notion.pages.update({
        page_id: task.id,
        properties: {
          "Google Event ID": {
            rich_text: [{ type: "text", text: { content: newEventId } }],
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