import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const DAILY_DB_ID = process.env.DAILY_DB_ID;
const TASKS_DB_ID = process.env.TASKS_DB_ID;

// Your timezone
const TZ = "Asia/Baku";

function formatTitle(date) {
  // YYYY-MMM-DD ddd  e.g. 2026-Feb-28 Sat
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "short",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value;

  return `${get("year")}-${get("month")}-${get("day")} ${get("weekday")}`;
}

function formatISODate(date) {
  // YYYY-MM-DD in Asia/Baku
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const yyyy = parts.find((p) => p.type === "year").value;
  const mm = parts.find((p) => p.type === "month").value;
  const dd = parts.find((p) => p.type === "day").value;
  return `${yyyy}-${mm}-${dd}`;
}

async function findDailyPageByDate(isoDate) {
  const res = await notion.databases.query({
    database_id: DAILY_DB_ID,
    filter: {
      property: "Date",
      date: { equals: isoDate },
    },
  });
  return res.results?.[0] ?? null;
}

async function createDailyPage({ title, isoDate }) {
  return await notion.pages.create({
    parent: { database_id: DAILY_DB_ID },
    properties: {
      Name: { title: [{ text: { content: title } }] },
      Date: { date: { start: isoDate } },
    },
    template: {
      template_id: process.env.TEMPLATE_PAGE_ID,
    },
  });
}
async function carryOverTasks({ yesterdayDailyId, todayDailyId, yesterdayTitle }) {
  const res = await notion.databases.query({
    database_id: TASKS_DB_ID,
    filter: {
      and: [
        { property: "Day", relation: { contains: yesterdayDailyId } },
        { property: "Status", status: { does_not_equal: "Done" } },
      ],
    },
  });

  for (const task of res.results) {
    await notion.pages.update({
      page_id: task.id,
      properties: {
        Day: { relation: [{ id: todayDailyId }] }, // MOVE to today
        Carryover: { checkbox: true },
        "Carried From": {
          rich_text: [{ type: "text", text: { content: yesterdayTitle } }],
        },
      },
    });
  }

  return res.results.length;
}

async function main() {
  if (!DAILY_DB_ID || !TASKS_DB_ID || !process.env.NOTION_TOKEN) {
    throw new Error("Missing env vars: NOTION_TOKEN, DAILY_DB_ID, TASKS_DB_ID");
  }

  if (!process.env.TEMPLATE_PAGE_ID) {
    throw new Error("Missing env var: TEMPLATE_PAGE_ID");
  }

  const now = new Date();
  const todayISO = formatISODate(now);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayISO = formatISODate(yesterday);

  const todayTitle = formatTitle(now);

  // Get/Create today
  let todayPage = await findDailyPageByDate(todayISO);
  if (!todayPage) {
    todayPage = await createDailyPage({ title: todayTitle, isoDate: todayISO });
    console.log("Created today:", todayTitle);
  } else {
    console.log("Today exists:", todayTitle);
  }

  // Carryover
  const yesterdayPage = await findDailyPageByDate(yesterdayISO);
  if (!yesterdayPage) {
    console.log("No yesterday page found, skipping carryover.");
    return;
  }

  const yesterdayTitle =
    yesterdayPage.properties?.Name?.title?.[0]?.plain_text ?? yesterdayISO;

  const carried = await carryOverTasks({
    yesterdayDailyId: yesterdayPage.id,
    todayDailyId: todayPage.id,
    yesterdayTitle,
  });

  console.log("Carried over tasks:", carried);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});