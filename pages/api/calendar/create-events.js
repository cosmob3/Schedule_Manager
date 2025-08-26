// pages/api/calendar/create-events.js
import { google } from "@googleapis/calendar";
import { getToken } from "next-auth/jwt";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Grab the user’s NextAuth token (contains accessToken from our JWT callback)
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token?.accessToken) {
    return res.status(401).json({ error: "Not authenticated with Google" });
  }
  if (token?.error) {
    // If refresh failed, ask the user to reconnect Google
    return res.status(401).json({ error: token.error });
  }

  try {
    const { title, description, startISO, endISO, location } = req.body || {};
    if (!title || !startISO || !endISO) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Auth client with the (fresh) access token from NextAuth
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token.accessToken });

    const calendar = google.calendar({ version: "v3", auth });

    const event = {
      summary: title,
      description,
      location,
      start: { dateTime: startISO, timeZone: "America/Edmonton" }, // change if needed
      end: { dateTime: endISO, timeZone: "America/Edmonton" },
    };

    const r = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
    });

    return res.status(200).json(r.data);
  } catch (err) {
    console.error("Calendar insert error:", err);
    return res.status(500).json({ error: "Failed to create event" });
  }
}
