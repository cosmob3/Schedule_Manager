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
