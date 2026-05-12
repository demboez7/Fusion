export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

function timeToSeconds(t: string): number {
  const m = t.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})$/);
  if (!m) return 0;
  const [, h, mm, ss, ms] = m;
  return Number(h) * 3600 + Number(mm) * 60 + Number(ss) + Number(ms.padEnd(3, "0")) / 1000;
}

export function parseSrt(content: string): SubtitleCue[] {
  const text = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = text.split(/\n\n+/);
  const cues: SubtitleCue[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.length > 0);
    if (lines.length < 2) continue;
    const timeLineIdx = lines[0].includes("-->") ? 0 : 1;
    const timeLine = lines[timeLineIdx];
    const tm = timeLine.match(/(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3})/);
    if (!tm) continue;
    const start = timeToSeconds(tm[1]);
    const end = timeToSeconds(tm[2]);
    const cueText = lines
      .slice(timeLineIdx + 1)
      .join("\n")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (cueText) cues.push({ start, end, text: cueText });
  }
  return cues;
}

export function parseVtt(content: string): SubtitleCue[] {
  const text = content.replace(/^WEBVTT[^\n]*\n+/i, "");
  return parseSrt(text);
}

export async function fetchSubtitleCues(url: string): Promise<SubtitleCue[]> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
      Accept: "*/*",
    },
  });
  if (!res.ok) throw new Error(`Failed to download subtitles (HTTP ${res.status})`);
  const text = await res.text();
  if (!text.trim()) throw new Error("Subtitle file is empty");
  const isVtt = /^WEBVTT/i.test(text.trim()) || /\.vtt(\?|$)/i.test(url);
  const cues = isVtt ? parseVtt(text) : parseSrt(text);
  if (cues.length === 0) throw new Error("Could not parse any cues from this subtitle file");
  return cues;
}

export function findActiveCue(cues: SubtitleCue[], time: number): SubtitleCue | null {
  // Linear search is fine — typical SRT has under 2000 cues.
  for (let i = 0; i < cues.length; i++) {
    if (time >= cues[i].start && time <= cues[i].end) return cues[i];
    if (cues[i].start > time) return null;
  }
  return null;
}
