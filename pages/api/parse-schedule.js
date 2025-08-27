// pages/api/parse-schedule.js
import StarbucksScheduleParser from "../../lib/scheduleParser";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const {
    text,
    defaultLocation = "Starbucks",
    defaultPosition = "Barista",
  } = req.body || {};

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "No text" });
  }

  try {
    const parser = new StarbucksScheduleParser();
    const raw = parser.parse(text);

    const shifts = raw.map((s, i) => ({
      id: String(i + 1),
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      location: s.location || defaultLocation,
      position: s.position || defaultPosition,
      notes: s.notes || "",
    }));

    return res.status(200).json({ shifts });
  } catch (e) {
    console.error("parse-schedule error:", e);
    return res.status(500).json({ error: "Parser failed" });
  }
}
