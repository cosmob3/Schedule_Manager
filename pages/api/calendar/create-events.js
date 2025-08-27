// pages/api/calendar/create-events.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { google } from "googleapis";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "No session" });
  if (!session.accessToken)
    return res.status(401).json({ error: "No accessToken on session" });

  const { title, description, startISO, endISO, location } = req.body || {};
  if (!title || !startISO || !endISO) {
    return res
      .status(400)
      .json({ error: "Missing required fields (title, startISO, endISO)" });
  }

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });
    const calendar = google.calendar({ version: "v3", auth });

    const requestBody = {
      summary: title,
      description,
      location,
      start: { dateTime: startISO, timeZone: "America/Edmonton" },
      end: { dateTime: endISO, timeZone: "America/Edmonton" },
    };

    const result = await calendar.events.insert({
      calendarId: "primary",
      requestBody,
    });

    return res.status(200).json(result.data);
  } catch (err) {
    const gErr =
      err?.response?.data?.error?.message ||
      err?.errors?.[0]?.message ||
      err?.message ||
      "Unknown error";
    console.error("Calendar insert error:", gErr, err?.response?.data);
    return res.status(500).json({ error: gErr });
  }
}
