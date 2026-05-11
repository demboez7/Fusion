export interface EpgProgram {
  channelId: string;
  title: string;
  description?: string;
  start: Date;
  stop: Date;
  category?: string;
  icon?: string;
}

export interface EpgChannel {
  id: string;
  displayName?: string;
  icon?: string;
  programs: EpgProgram[];
}

function parseXmltvDate(str: string): Date {
  const cleaned = str.replace(/\s.*$/, "").trim();
  const y = cleaned.slice(0, 4);
  const mo = cleaned.slice(4, 6);
  const d = cleaned.slice(6, 8);
  const h = cleaned.slice(8, 10);
  const mi = cleaned.slice(10, 12);
  const s = cleaned.slice(12, 14);
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
}

function parseOffset(str: string): number {
  const m = str.match(/([+-])(\d{2})(\d{2})$/);
  if (!m) return 0;
  const sign = m[1] === "+" ? 1 : -1;
  return sign * (parseInt(m[2]) * 60 + parseInt(m[3])) * 60 * 1000;
}

function parseDateWithOffset(str: string): Date {
  const trimmed = str.trim();
  const datePart = trimmed.slice(0, 14);
  const offsetPart = trimmed.slice(14).trim();
  const utcDate = parseXmltvDate(datePart);
  const offset = parseOffset(offsetPart);
  return new Date(utcDate.getTime() - offset);
}

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "i"));
  return m ? m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#\d+;/g, "").trim() : "";
}

function extractAttr(xml: string, attr: string): string {
  const m = xml.match(new RegExp(`${attr}="([^"]*)"`));
  return m ? m[1] : "";
}

export function parseXmltv(xml: string): Map<string, EpgProgram[]> {
  const programs = new Map<string, EpgProgram[]>();
  const now = Date.now();
  const cutoff = now + 24 * 60 * 60 * 1000;

  const progRegex = /<programme\s([^>]+)>([\s\S]*?)<\/programme>/g;
  let match: RegExpExecArray | null;

  while ((match = progRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const body = match[2];
    const startStr = extractAttr(attrs, "start");
    const stopStr = extractAttr(attrs, "stop");
    const channelId = extractAttr(attrs, "channel");

    if (!startStr || !channelId) continue;
    const start = parseDateWithOffset(startStr);
    const stop = stopStr ? parseDateWithOffset(stopStr) : new Date(start.getTime() + 3600000);

    if (stop.getTime() < now - 60000) continue;
    if (start.getTime() > cutoff) continue;

    const program: EpgProgram = {
      channelId,
      title: extractTag(body, "title") || "Unknown",
      description: extractTag(body, "desc") || undefined,
      category: extractTag(body, "category") || undefined,
      start,
      stop,
    };

    if (!programs.has(channelId)) programs.set(channelId, []);
    programs.get(channelId)!.push(program);
  }

  return programs;
}

export function getCurrentProgram(programs: EpgProgram[]): EpgProgram | null {
  const now = Date.now();
  return (
    programs.find((p) => p.start.getTime() <= now && p.stop.getTime() > now) ?? null
  );
}

export function getNextProgram(programs: EpgProgram[]): EpgProgram | null {
  const now = Date.now();
  const upcoming = programs
    .filter((p) => p.start.getTime() > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  return upcoming[0] ?? null;
}

export function formatEpgTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function programProgress(program: EpgProgram): number {
  const now = Date.now();
  const total = program.stop.getTime() - program.start.getTime();
  const elapsed = now - program.start.getTime();
  return Math.min(1, Math.max(0, elapsed / total));
}

export function extractEpgUrlFromM3u(content: string): string | null {
  const firstLine = content.split("\n").slice(0, 3).join("\n");
  const m = firstLine.match(/url-tvg="([^"]+)"/i) || firstLine.match(/x-tvg-url="([^"]+)"/i);
  return m ? m[1].trim() : null;
}

export async function fetchEpg(url: string): Promise<Map<string, EpgProgram[]>> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`EPG fetch failed: ${res.status}`);
    const text = await res.text();
    return parseXmltv(text);
  } finally {
    clearTimeout(id);
  }
}
