import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import {
  getGoogleCalendarClient,
  createCalendarEvent,
} from "../../../lib/googleCalendar";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.accessToken) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const { shifts } = req.body;

    if (!Array.isArray(shifts) || shifts.length === 0) {
      return res.status(400).json({ error: "Shifts array is required" });
    }

    const calendar = getGoogleCalendarClient(session.accessToken);
    const results = [];

    for (const shift of shifts) {
      try {
        const event = await createCalendarEvent(calendar, shift);
        results.push({ success: true, event, shift });
      } catch (error) {
        results.push({ success: false, error: error.message, shift });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    res.status(200).json({
      message: `Created ${successCount} events${
        failureCount > 0 ? `, ${failureCount} failed` : ""
      }`,
      results,
      summary: {
        total: results.length,
        success: successCount,
        failed: failureCount,
      },
    });
  } catch (error) {
    console.error("Calendar API Error:", error);
    res.status(500).json({ error: "Failed to create calendar events" });
  }
}
