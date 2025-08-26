import { StarbucksScheduleParser } from "../../lib/scheduleParser";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required" });
    }

    const parser = new StarbucksScheduleParser();
    const shifts = parser.parse(text);

    res.status(200).json({ shifts });
  } catch (error) {
    console.error("Parse Error:", error);
    res.status(500).json({ error: "Failed to parse schedule" });
  }
}
