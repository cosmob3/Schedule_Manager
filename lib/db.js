import { openDB } from "idb";

const DB_NAME = "StarbucksSchedulerDB";
const DB_VERSION = 1;
const STORES = {
  SCHEDULES: "schedules",
  SYNC_QUEUE: "syncQueue",
  SETTINGS: "settings",
};

export async function initDB() {
  return await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Schedules store
      if (!db.objectStoreNames.contains(STORES.SCHEDULES)) {
        const scheduleStore = db.createObjectStore(STORES.SCHEDULES, {
          keyPath: "id",
          autoIncrement: true,
        });
        scheduleStore.createIndex("date", "date", { unique: false });
        scheduleStore.createIndex("synced", "synced", { unique: false });
      }

      // Sync queue for offline operations
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        db.createObjectStore(STORES.SYNC_QUEUE, {
          keyPath: "id",
          autoIncrement: true,
        });
      }

      // Settings store
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: "key" });
      }
    },
  });
}

export async function saveSchedule(schedule) {
  const db = await initDB();
  return await db.add(STORES.SCHEDULES, {
    ...schedule,
    createdAt: new Date(),
    synced: false,
  });
}

export async function getSchedules() {
  const db = await initDB();
  return await db.getAll(STORES.SCHEDULES);
}

export async function addToSyncQueue(operation) {
  const db = await initDB();
  return await db.add(STORES.SYNC_QUEUE, {
    ...operation,
    timestamp: new Date(),
  });
}

export async function getSyncQueue() {
  const db = await initDB();
  return await db.getAll(STORES.SYNC_QUEUE);
}

export async function clearSyncQueue() {
  const db = await initDB();
  return await db.clear(STORES.SYNC_QUEUE);
}

// ==== lib/googleCalendar.js ====
import { google } from "googleapis";

export function getGoogleCalendarClient(accessToken) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  return google.calendar({
    version: "v3",
    auth: oauth2Client,
  });
}

export async function createCalendarEvent(calendar, eventData) {
  try {
    const event = {
      summary: `Starbucks Shift - ${eventData.location}`,
      description: eventData.notes || "Starbucks work shift",
      start: {
        dateTime: `${eventData.date}T${eventData.startTime}:00`,
        timeZone: "America/Toronto", // Adjust for Calgary
      },
      end: {
        dateTime: `${eventData.date}T${eventData.endTime}:00`,
        timeZone: "America/Toronto",
      },
      location: eventData.location,
      colorId: "10", // Green color for work events
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 30 },
          { method: "popup", minutes: 10 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      resource: event,
    });

    return response.data;
  } catch (error) {
    console.error("Error creating calendar event:", error);
    throw error;
  }
}
