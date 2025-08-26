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
