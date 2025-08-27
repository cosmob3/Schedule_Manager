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
        /(\d{1,2}:\d{2})([AaPp][Mm])\s*to\s*(\d{1,2}:\d{2})([AaPp][Mm])/g,
        /(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/g,
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
    const shifts = [];
    for (let i = 0; i < lines.length; i++) {
      const shift = this.parseLine(lines[i], lines, i);
      if (shift) shifts.push(shift);
    }
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

    const date = this.extractDate(line, allLines, index);
    if (!date) return null;

    return {
      date,
      startTime: timeMatch.start,
      endTime: timeMatch.end,
      position: this.extractPosition(line),
      location: this.extractLocation(line, allLines),
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
        let startTime, endTime;
        if (m.length >= 4) {
          startTime = this.normalizeTime(m[1], m[2]);
          endTime = this.normalizeTime(m[3], m[4]);
        } else if (m.length === 3) {
          startTime = this.normalizeTime(m[1]);
          endTime = this.normalizeTime(m[2]);
        }
        if (startTime && endTime) return { start: startTime, end: endTime };
      }
    }
    return null;
  }

  normalizeTime(timeStr, meridiem) {
    if (!timeStr) return null;
    const [hStr, mStr] = timeStr.split(":");
    const hours = parseInt(hStr, 10);
    const minutes = parseInt(mStr, 10);
    if (isNaN(hours) || isNaN(minutes)) return null;

    let hh = hours;
    if (meridiem) {
      const isPM = meridiem.toLowerCase() === "pm";
      if (isPM && hh !== 12) hh += 12;
      if (!isPM && hh === 12) hh = 0;
    } else {
      // heuristic if AM/PM omitted
      if (hh >= 1 && hh <= 7) hh += 12; // likely PM
    }
    return `${String(hh).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  extractDate(line, allLines, currentIndex) {
    let dateStr = this.findDateInLine(line);
    if (!dateStr) {
      for (let i = currentIndex - 1; i >= Math.max(0, currentIndex - 5); i--) {
        dateStr = this.findDateInLine(allLines[i]);
        if (dateStr) break;
      }
    }
    if (!dateStr) {
      const dayMatch = line.match(this.patterns.days);
      if (dayMatch) dateStr = this.getNextDateForDay(dayMatch[0]);
    }
    return dateStr ? this.normalizeDate(dateStr) : null;
  }

  findDateInLine(line) {
    for (const pattern of this.patterns.dates) {
      pattern.lastIndex = 0;
      const m = pattern.exec(line);
      if (m) return m[1] || m[0];
    }
    return null;
  }

  normalizeDate(dateStr) {
    const fmts = [
      "MM/dd/yyyy",
      "MM-dd-yyyy",
      "MM.dd.yyyy",
      "MM/dd/yy",
      "MM-dd-yy",
      "MM.dd.yy",
      "yyyy-MM-dd",
    ];
    for (const f of fmts) {
      try {
        const d = parse(dateStr, f, new Date());
        if (isValid(d)) return fmt(d, "yyyy-MM-dd");
      } catch {}
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

  extractPosition(line) {
    const m = line.match(this.patterns.positions);
    return m ? m[0] : "Barista";
  }

  extractLocation(line, allLines) {
    let m = line.match(this.patterns.locations);
    if (m) return m[0];
    const idx = allLines.indexOf(line);
    const ctx = allLines.slice(Math.max(0, idx - 3), idx + 3);
    for (const l of ctx) {
      m = l.match(this.patterns.locations);
      if (m) return m[0];
    }
    return "Starbucks";
  }

  postProcessShifts(shifts) {
    const unique = shifts.filter(
      (s, i, arr) =>
        i ===
        arr.findIndex(
          (t) =>
            t.date === s.date &&
            t.startTime === s.startTime &&
            t.endTime === s.endTime
        )
    );
    return unique.sort((a, b) =>
      a.date === b.date
        ? a.startTime.localeCompare(b.startTime)
        : a.date.localeCompare(b.date)
    );
  }
}
