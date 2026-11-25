// The Angelus reminder (on the Angelus page): a calendar file with an event every day at the
// chosen times (6:00, 12:00, 18:00, in the phone's own time zone), each with an alert. The
// phone's calendar does the reminding, so it works even when this app is closed (a website
// can't wake a phone by itself without a server).
import { $ } from './util.js';
import { t } from './ui.js';

const pad = (n) => String(n).padStart(2, '0');

/** The calendar file (iCalendar) for the chosen times, "HH:MM". */
export function angelusIcs(times, today = new Date()) {
  const day = `${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const note = t('The Angelus. In Eastertide, the Regina Caeli.');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Office and Mass//Angelus//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const time of times) {
    const hm = time.replace(':', '');
    lines.push(
      'BEGIN:VEVENT',
      `UID:angelus-${hm}@office-and-mass`,
      `DTSTAMP:${stamp}`,
      // No time zone: "floating" local time, so 6:00 stays 6:00 wherever the phone is.
      `DTSTART:${day}T${hm}00`,
      'DURATION:PT5M',
      'RRULE:FREQ=DAILY',
      'SUMMARY:Angelus',
      `DESCRIPTION:${note.replace(/[,;]/g, (c) => `\\${c}`)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Angelus', 'TRIGGER:PT0M', 'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

export function initAngelus() {
  $('angelus-add').onclick = () => {
    const times = [...document.querySelectorAll('.angelus-times input:checked')].map((i) => i.value);
    if (!times.length) return;
    const blob = new Blob([angelusIcs(times)], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: 'angelus.ics' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
}
