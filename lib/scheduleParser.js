// pages/api/parse-schedule.js
import { parse, isValid, format as fmt } from "date-fns";

// ----- Parser -----
export default class StarbucksScheduleParser {
  constructor() {
    this.patterns = {
      dates: [
        /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g, // 12/25/2024, 12-25-24
        /(\w+day)\s*(\d{1,2}[\/\-\.]\d{1,2})/g, // Monday 12/25
        /(\w+day)\s+(\w+\s+\d{1,2})/g, // Monday Dec 25
      ],
      times: [
        /(\d{1,2}:\d{2})\s*([AaPp][Mm])?\s*[-–—]\s*(\d{1,2}:\d{2})\s*([AaPp][Mm])?/g,
        /(\d{1,2}:\d{2})\s*([AaPp][Mm])\s*to\s*(\d{1,2}:\d{2})\s*([AaPp][Mm])/g,
        /(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/g,
        /(\d{1,2}(?::\d{2})?)\s*([AaPp]m?|[AaPp])\s*[-–—]\s*(\d{1,2}(?::\d{2})?)\s*([AaPp]m?|[AaPp])/gi,
        /(\d{1,2}(?::\d{2})?)\s*([AaPp]m?|[AaPp])\s*to\s*(\d{1,2}(?::\d{2})?)\s*([AaPp]m?|[AaPp])/gi,
      ],

      days: /(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)/gi,
      positions:
        /(barista|shift|supervisor|manager|opener|closer|mid|morning|evening|overnight)/gi,
      locations:
        /(store|location|#\d+|\d+\s*\w+\s*(ave|avenue|st|street|rd|road|blvd|boulevard))/gi,
    };
  }

  parse(text) {
    const lines = this.preprocessText(text);

    // Keep your year hint (used for "Mon Dec 25" without a year)
    this.yearHint = (() => {
      for (const ln of lines.slice(0, 5)) {
        const m = ln.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
        if (m) return parseInt(m[3], 10);
      }
      return new Date().getFullYear();
    })();

    // NEW: Build a map from weekday → yyyy-MM-dd using the header range
    // e.g. "09/01/2025 - 09/07/2025"
    this.weekDayToDate = null;
    {
      const m = text.match(
        /(\d{1,2}\/\d{1,2}\/\d{4})\s*[-–—]\s*(\d{1,2}\/\d{1,2}\/\d{4})/
      );
      if (m) {
        const start = parse(m[1], "MM/dd/yyyy", new Date());
        if (isValid(start)) {
          const names = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
          this.weekDayToDate = {};
          for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const key = names[d.getDay()];
            this.weekDayToDate[key] = fmt(d, "yyyy-MM-dd");
          }
          // also full names
          this.weekDayToDate.sunday = this.weekDayToDate.sun;
          this.weekDayToDate.monday = this.weekDayToDate.mon;
          this.weekDayToDate.tuesday = this.weekDayToDate.tue;
          this.weekDayToDate.wednesday = this.weekDayToDate.wed;
          this.weekDayToDate.thursday = this.weekDayToDate.thu;
          this.weekDayToDate.friday = this.weekDayToDate.fri;
          this.weekDayToDate.saturday = this.weekDayToDate.sat;
        }
      }
    }

    const shifts = [];
    for (let i = 0; i < lines.length; i++) {
      const shift = this.parseLine(lines[i], lines, i);
      console.log("LINE", i, "→", lines[i]);
      if (shift) {
        console.log("✅ Parsed shift:", shift);
        shifts.push(shift);
      } else {
        console.log("❌ Skipped:", lines[i]);
      }
    }
    console.log("FINAL shifts count:", shifts.length);
    return this.postProcessShifts(shifts);
  }

  preprocessText(text) {
    return text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 2)
      .map((l) => l.replace(/\s+/g, " "));
  }

  parseLine(line, allLines, index) {
    if (this.isHeaderLine(line)) return null;

    const timeMatch = this.extractTime(line);
    if (!timeMatch) return null;

    // allow looking backwards for date
    let date = this.extractDate(line, allLines, index);
    if (!date) {
      for (let i = index - 1; i >= Math.max(0, index - 2); i--) {
        date = this.extractDate(allLines[i], allLines, i);
        if (date) break;
      }
    }
    if (!date) return null;

    // look forwards for position/location
    let position = this.extractPosition(line, allLines, index);
    if (!position) {
      for (
        let i = index + 1;
        i <= Math.min(allLines.length - 1, index + 2);
        i++
      ) {
        position = this.extractPosition(allLines[i], allLines, i);
        if (position) break;
      }
    }

    let location = this.extractLocation(line, allLines, index);
    if (!location || location === "Starbucks") {
      for (
        let i = index + 1;
        i <= Math.min(allLines.length - 1, index + 3);
        i++
      ) {
        location = this.extractLocation(allLines[i], allLines, i);
        if (location && location !== "Starbucks") break;
      }
    }

    return {
      date,
      startTime: timeMatch.start,
      endTime: timeMatch.end,
      position: position || "Barista",
      location: location || "Starbucks",
      notes: line.trim(),
      originalLine: line,
    };
  }

  isHeaderLine(line) {
    const headerKeywords = [
      "schedule",
      "week",
      "employee",
      "name",
      "position",
      "total",
      "hours",
    ];
    // Use a fresh regex to avoid stateful /g issues
    const timeLike = /(\d{1,2}:\d{2}).*[-–—].*(\d{1,2}:\d{2})/i.test(line);
    return (
      headerKeywords.some((k) => line.toLowerCase().includes(k)) && !timeLike
    );
  }
  extractTime(line) {
    for (const pattern of this.patterns.times) {
      pattern.lastIndex = 0;
      const m = pattern.exec(line);
      if (m) {
        let startTime = null,
          endTime = null;

        // Defensive: check groups safely
        if (m[1]) startTime = this.normalizeTime(m[1], m[2]);
        if (m[3]) endTime = this.normalizeTime(m[3], m[4]);

        if (startTime && endTime) {
          return { start: startTime, end: endTime };
        }
      }
    }
    return null;
  }

  normalizeTime(timeStr, meridiem) {
    if (!timeStr) return null;

    const raw = String(timeStr).trim();
    const parts = raw.split(":");
    let hours = parseInt(parts[0], 10);
    let minutes = parts[1] ? parseInt(parts[1], 10) : 0;

    if (isNaN(hours) || isNaN(minutes)) return null;

    let inf = meridiem ? String(meridiem).toLowerCase() : "";
    if (inf.startsWith("a")) inf = "am";
    if (inf.startsWith("p")) inf = "pm";

    if (inf) {
      if (inf === "pm" && hours !== 12) hours += 12;
      if (inf === "am" && hours === 12) hours = 0;
    } else {
      if (hours >= 1 && hours <= 7) hours += 12; // guess PM
    }

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}`;
  }

  extractDate(line, allLines, currentIndex) {
    // If we have a week header map, prefer weekday → exact date
    const dayMatch = line.match(this.patterns.days);
    if (dayMatch && this.weekDayToDate) {
      const key = dayMatch[0].toLowerCase();
      const mapped = this.weekDayToDate[key];
      if (mapped) return mapped;
    }

    // Otherwise look for an explicit date on this/previous lines,
    // but IGNORE lines that contain a date range (two dates).
    let dateStr = this.findDateInLine(line);
    if (!dateStr) {
      for (let i = currentIndex - 1; i >= Math.max(0, currentIndex - 10); i--) {
        dateStr = this.findDateInLine(allLines[i]);
        if (dateStr) break;
      }
    }

    // If still nothing and we saw a weekday, fall back to the rolling heuristic
    if (!dateStr && dayMatch) {
      return this.getNextDateForDay(dayMatch[0]);
    }

    return dateStr ? this.normalizeDate(dateStr) : null;
  }

  findDateInLine(line) {
    // If a line looks like a date RANGE (two dates with a dash), ignore it
    const looksLikeRange =
      /(\d{1,2}\/\d{1,2}\/\d{2,4}).*[-–—].*(\d{1,2}\/\d{1,2}\/\d{2,4})/.test(
        line
      );
    if (looksLikeRange) return null;

    for (const pattern of this.patterns.dates) {
      pattern.lastIndex = 0;
      const m = pattern.exec(line);
      if (m) return m[1] || m[0];
    }
    return null;
  }

  normalizeDate(dateStr) {
    const s = String(dateStr).trim();
    const hasName = /[A-Za-z]{3,}/.test(s);
    const hasYear = /\d{4}/.test(s) || /\d{2}$/.test(s);
    const candidates = hasName && !hasYear ? [`${s} ${this.yearHint}`] : [s];
    const fmts = [
      "MM/dd/yyyy",
      "MM-dd-yyyy",
      "MM.dd.yyyy",
      "MM/dd/yy",
      "MM-dd-yy",
      "MM.dd/yy",
      "yyyy-MM-dd",
      "MMM d yyyy",
      "MMMM d yyyy",
    ];
    for (const cand of candidates) {
      for (const f of fmts) {
        try {
          const d = parse(cand, f, new Date());
          if (isValid(d)) return fmt(d, "yyyy-MM-dd");
        } catch {}
      }
    }
    return null;
  }

  getNextDateForDay(dayName) {
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const target = days.findIndex((d) =>
      d.startsWith(dayName.toLowerCase().slice(0, 3))
    );
    if (target === -1) return null;
    const today = new Date();
    const delta = (target - today.getDay() + 7) % 7;
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + delta);
    return fmt(targetDate, "yyyy-MM-dd");
  }
  extractPosition(line, allLines, index) {
    // "@ e NewStoreLabor" → "NewStoreLabor"
    if (line.startsWith("@")) {
      return line.replace(/^@\s*/, "").replace(/^e\s*/i, "").trim();
    }

    // Some OCR lines are just "e NewStoreLabor"
    if (/^e\s+/i.test(line)) {
      return line.replace(/^e\s+/i, "").trim();
    }

    // Check the next line (OCR often splits)
    const nextLine = allLines[index + 1];
    if (nextLine) {
      if (nextLine.startsWith("@")) {
        return nextLine.replace(/^@\s*/, "").replace(/^e\s*/i, "").trim();
      }
      if (/^e\s+/i.test(nextLine)) {
        return nextLine.replace(/^e\s+/i, "").trim();
      }
    }

    // Fallback keywords
    const m = line.match(this.patterns.positions);
    return m ? m[0] : "Barista";
  }
  extractLocation(line, allLines, index) {
    // Accept optional non-alnum (e.g., "© ") before the store number
    const idStoreMatch = line.match(
      /^[^A-Za-z0-9]*\d+\s*-\s*([A-Za-z0-9 .,'&-]+)/
    );
    if (idStoreMatch) {
      return idStoreMatch[1].trim();
    }

    // Look ahead a few lines for the same pattern
    const fwd = allLines.slice(index, index + 4);
    for (const l of fwd) {
      const tail = l.match(/^[^A-Za-z0-9]*\d+\s*-\s*([A-Za-z0-9 .,'&-]+)/);
      if (tail) return tail[1].trim();
    }

    // Fallbacks
    let m = line.match(this.patterns.locations);
    if (m) return m[0];

    const ctx = allLines.slice(Math.max(0, index - 3), index + 3);
    for (const l of ctx) {
      m = l.match(this.patterns.locations);
      if (m) return m[0];
    }
    return "Starbucks";
  }

  postProcessShifts(shifts) {
    // Weekday order map
    const weekOrder = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];

    return shifts.sort((a, b) => {
      // Try to infer weekday from original line
      const getDayIndex = (shift) => {
        if (!shift.originalLine) return -1;
        const lower = shift.originalLine.toLowerCase();
        for (let i = 0; i < weekOrder.length; i++) {
          if (lower.includes(weekOrder[i].slice(0, 3))) return i; // match mon/tue/etc
        }
        return -1;
      };

      const ai = getDayIndex(a);
      const bi = getDayIndex(b);

      // If both have valid weekday indices → sort by that
      if (ai !== -1 && bi !== -1 && ai !== bi) return ai - bi;

      // Otherwise fallback to date sort
      if (a.date !== b.date) return a.date.localeCompare(b.date);

      // And if same date → sort by time
      return a.startTime.localeCompare(b.startTime);
    });
  }
}
