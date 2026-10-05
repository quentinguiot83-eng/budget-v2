export type CalendarFeed = {
  name: string;
  events: { id: string; title: string; startsAt: string; endsAt: string; location: string; updatedAt: string }[];
};

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
}
function date(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error("Invalid calendar date");
  return parsed.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
function fold(line: string): string {
  let result = "", size = 0;
  const encoder = new TextEncoder();
  for (const character of line) {
    const bytes = encoder.encode(character).length;
    if (size + bytes > 75) { result += "\r\n "; size = 1; }
    result += character; size += bytes;
  }
  return result;
}
export function calendarFeed(feed: CalendarFeed): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Wimm//Agenda professionnel//FR", "CALSCALE:GREGORIAN", "X-WR-CALNAME:" + escapeText(feed.name)];
  for (const event of feed.events) {
    if (!/^[0-9a-f-]{36}$/i.test(event.id) || new Date(event.endsAt) < new Date(event.startsAt)) throw new Error("Invalid calendar event");
    lines.push("BEGIN:VEVENT", "UID:" + event.id + "@wimm", "DTSTAMP:" + date(event.updatedAt), "LAST-MODIFIED:" + date(event.updatedAt), "DTSTART:" + date(event.startsAt), "DTEND:" + date(event.endsAt), "SUMMARY:" + escapeText(event.title));
    if (event.location) lines.push("LOCATION:" + escapeText(event.location));
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
