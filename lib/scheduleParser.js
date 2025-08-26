import { parse, isValid, format } from "date-fns";

export class StarbucksScheduleParser {
  constructor() {
    // Enhanced patterns for different Starbucks schedule formats
    this.patterns = {
      // Date patterns
      dates: [
        /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g, // MM/DD/YYYY, MM-DD-YY
        /(\w+day)\s*(\d{1,2}[\/\-\.]\d{1,2})/g, // Monday 12/25
        /(\w+day)\s+(\w+\s+\d{1,2})/g, // Monday Dec 25
      ],

      // Time patterns - more comprehensive
      times: [
        /(\d{1,2}:\d{2})\s*([AaPp][Mm])?\s*[\-\–\—]\s*(\d{1,2}:\d{2})\s*([AaPp][Mm])?/g,
        /(\d{1,2}:\d{2})([AaPp][Mm])\s*to\s*(\d{1,2}:\d{2})([AaPp][Mm])/g,
        /(\d{1,2}:\d{2})\s*[\-\–\—]\s*(\d{1,2}:\d{2})/g,
      ],

      // Day names
      days: /(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)/gi,

      // Position/role patterns
      positions:
        /(barista|shift|supervisor|manager|opener|closer|mid|morning|evening|overnight)/gi,

      // Store location patterns
      locations:
        /(store|location|#\d+|\d+\s*\w+\s*(ave|avenue|st|street|rd|road|blvd|boulevard))/gi,
    };
  }

  parse(text) {
    const lines = this.preprocessText(text);
    const shifts = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const shift = this.parseLine(line, lines, i);

      if (shift) {
        shifts.push(shift);
      }
    }

    return this.postProcessShifts(shifts);
  }

  preprocessText(text) {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 2)
      .map((line) => line.replace(/\s+/g, " ")); // Normalize whitespace
  }

  parseLine(line, allLines, index) {
    // Skip headers and non-shift lines
    if (this.isHeaderLine(line)) return null;

    const timeMatch = this.extractTime(line);
    if (!timeMatch) return null;

    const date = this.extractDate(line, allLines, index);
    if (!date) return null;

    return {
      date: date,
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
    return headerKeywords.some(
      (keyword) =>
        line.toLowerCase().includes(keyword) &&
        !this.patterns.times[0].test(line)
    );
  }

  extractTime(line) {
    for (const pattern of this.patterns.times) {
      pattern.lastIndex = 0; // Reset regex
      const match = pattern.exec(line);

      if (match) {
        let startTime, endTime;

        if (match.length >= 4) {
          // Pattern with separate start/end times
          startTime = this.normalizeTime(match[1], match[2]);
          endTime = this.normalizeTime(match[3], match[4]);
        } else if (match.length === 3) {
          // Simple time range
          startTime = this.normalizeTime(match[1]);
          endTime = this.normalizeTime(match[2]);
        }

        if (startTime && endTime) {
          return { start: startTime, end: endTime };
        }
      }
    }
    return null;
  }

  normalizeTime(timeStr, meridiem) {
    if (!timeStr) return null;

    const [hours, minutes] = timeStr.split(":").map((num) => parseInt(num, 10));

    if (isNaN(hours) || isNaN(minutes)) return null;

    let normalizedHours = hours;

    if (meridiem) {
      const isPM = meridiem.toLowerCase() === "pm";
      if (isPM && hours !== 12) normalizedHours += 12;
      if (!isPM && hours === 12) normalizedHours = 0;
    } else {
      // Smart AM/PM detection based on common shift patterns
      if (hours >= 1 && hours <= 7) {
        normalizedHours = hours + 12; // Likely PM
      } else if (hours >= 8 && hours <= 11) {
        normalizedHours = hours; // Likely AM
      }
    }

    return `${normalizedHours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;
  }

  extractDate(line, allLines, currentIndex) {
    // First try to find date in current line
    let dateStr = this.findDateInLine(line);

    // If not found, look backwards for context
    if (!dateStr) {
      for (let i = currentIndex - 1; i >= Math.max(0, currentIndex - 5); i--) {
        dateStr = this.findDateInLine(allLines[i]);
        if (dateStr) break;
      }
    }

    // If still not found, try to infer from day name
    if (!dateStr) {
      const dayMatch = line.match(this.patterns.days);
      if (dayMatch) {
        dateStr = this.getNextDateForDay(dayMatch[0]);
      }
    }

    return dateStr ? this.normalizeDate(dateStr) : null;
  }

  findDateInLine(line) {
    for (const pattern of this.patterns.dates) {
      pattern.lastIndex = 0;
      const match = pattern.exec(line);
      if (match) return match[1] || match[0];
    }
    return null;
  }

  normalizeDate(dateStr) {
    const formats = [
      "MM/dd/yyyy",
      "MM-dd-yyyy",
      "MM.dd.yyyy",
      "MM/dd/yy",
      "MM-dd-yy",
      "MM.dd.yy",
      "yyyy-MM-dd",
    ];

    for (const format of formats) {
      try {
        const parsed = parse(dateStr, format, new Date());
        if (isValid(parsed)) {
          return format(parsed, "yyyy-MM-dd");
        }
      } catch (e) {
        continue;
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
    const targetDay = days.findIndex((day) =>
      day.startsWith(dayName.toLowerCase().substring(0, 3))
    );

    if (targetDay === -1) return null;

    const today = new Date();
    const currentDay = today.getDay();
    const daysUntilTarget = (targetDay - currentDay + 7) % 7;

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysUntilTarget);

    return format(targetDate, "yyyy-MM-dd");
  }

  extractPosition(line) {
    const match = line.match(this.patterns.positions);
    return match ? match[0] : "Barista";
  }

  extractLocation(line, allLines) {
    // Check current line first
    let locationMatch = line.match(this.patterns.locations);
    if (locationMatch) return locationMatch[0];

    // Check nearby lines for store info
    const contextLines = allLines.slice(
      Math.max(0, allLines.indexOf(line) - 3),
      allLines.indexOf(line) + 3
    );
    for (const contextLine of contextLines) {
      locationMatch = contextLine.match(this.patterns.locations);
      if (locationMatch) return locationMatch[0];
    }

    return "Starbucks";
  }

  postProcessShifts(shifts) {
    // Remove duplicates
    const uniqueShifts = shifts.filter(
      (shift, index, self) =>
        index ===
        self.findIndex(
          (s) =>
            s.date === shift.date &&
            s.startTime === shift.startTime &&
            s.endTime === shift.endTime
        )
    );

    // Sort by date and time
    return uniqueShifts.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.startTime.localeCompare(b.startTime);
    });
  }
}
