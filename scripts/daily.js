import { Client } from "@notionhq/client";

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: "2025-09-03",
});

const DAILY_DB_ID = process.env.DAILY_DB_ID;     // your database container id
const TASKS_DB_ID = process.env.TASKS_DB_ID;     // your database container id
const TEMPLATE_PAGE_ID = process.env.TEMPLATE_PAGE_ID;

const TZ = "Asia/Baku";

function formatTitle(date) {
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

async function getFirstDataSourceId(database_id) {
  const db = await notion.databases.retrieve({ database_id });
  const ds = db.data_sources?.[0];
  if (!ds?.id) throw new Error(`No data_sources found for database ${database_id}`);
  return ds.id;
}

async function findDailyPageByDate(dailyDataSourceId, isoDate) {
  const res = await notion.dataSources.query({
    data_source_id: dailyDataSourceId,
    filter: { property: "Date", date: { equals: isoDate } },
  });
  return res.results?.[0] ?? null;
}

async function createDailyPage(dailyDataSourceId, { title, isoDate }) {
  // IMPORTANT: when using templates, you cannot pass children in this request.
  return await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: dailyDataSourceId },
    properties: {
      Name: { title: [{ text: { content: title } }] },
      Date: { date: { start: isoDate } },
    },
    template: {
      type: "template_id",
      template_id: TEMPLATE_PAGE_ID,
    },
  });
}

async function carryOverTasks(tasksDataSourceId, { yesterdayDailyId, todayDailyId, yesterdayTitle }) {
  const res = await notion.dataSources.query({
    data_source_id: tasksDataSourceId,
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
  if (!process.env.NOTION_TOKEN || !DAILY_DB_ID || !TASKS_DB_ID || !TEMPLATE_PAGE_ID) {
    throw new Error("Missing env vars: NOTION_TOKEN, DAILY_DB_ID, TASKS_DB_ID, TEMPLATE_PAGE_ID");
  }

  const dailyDS = await getFirstDataSourceId(DAILY_DB_ID);
  const tasksDS = await getFirstDataSourceId(TASKS_DB_ID);

  const now = new Date();
  const todayISO = formatISODate(now);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayISO = formatISODate(yesterday);

  const todayTitle = formatTitle(now);

  let todayPage = await findDailyPageByDate(dailyDS, todayISO);
  if (!todayPage) {
    todayPage = await createDailyPage(dailyDS, { title: todayTitle, isoDate: todayISO });
    console.log("Created today:", todayTitle);
  } else {
    console.log("Today exists:", todayTitle);
  }

  const yesterdayPage = await findDailyPageByDate(dailyDS, yesterdayISO);
  if (!yesterdayPage) {
    console.log("No yesterday page found, skipping carryover.");
    return;
  }

  const yesterdayTitle =
    yesterdayPage.properties?.Name?.title?.[0]?.plain_text ?? yesterdayISO;

  const carried = await carryOverTasks(tasksDS, {
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