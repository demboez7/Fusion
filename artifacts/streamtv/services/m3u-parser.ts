export interface IptvChannel {
  id: string;
  name: string;
  url: string;
  logo?: string;
  group?: string;
  tvgId?: string;
  tvgLanguage?: string;
  tvgCountry?: string;
}

function parseAttributes(line: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([\w-]+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    attrs[match[1].toLowerCase().replace(/-/g, "")] = match[2];
  }
  return attrs;
}

export function parseM3U(content: string): IptvChannel[] {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  const channels: IptvChannel[] = [];
  let currentInfo: Partial<IptvChannel> | null = null;
  let index = 0;

  for (const line of lines) {
    if (line.startsWith("#EXTM3U")) continue;

    if (line.startsWith("#EXTINF:")) {
      const commaIndex = line.indexOf(",");
      const attrs = parseAttributes(line);
      const name =
        commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : attrs["tvgname"] || "Unknown";

      currentInfo = {
        id: `ch_${index++}`,
        name: name || attrs["tvgname"] || "Channel " + index,
        logo: attrs["tvglogo"] || attrs["logo"],
        group: attrs["grouptitle"] || attrs["group"] || "Other",
        tvgId: attrs["tvgid"],
        tvgLanguage: attrs["tvglanguage"],
        tvgCountry: attrs["tvgcountry"],
      };
    } else if (!line.startsWith("#") && currentInfo) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith("http://") ||
        trimmed.startsWith("https://") ||
        trimmed.startsWith("rtmp://") ||
        trimmed.startsWith("rtsp://")
      ) {
        channels.push({ ...currentInfo, url: trimmed } as IptvChannel);
      }
      currentInfo = null;
    }
  }

  return channels;
}

const BROWSER_UA =
  "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

async function fetchWithFallback(url: string): Promise<Response> {
  try {
    return await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "*/*",
      },
    });
  } catch {
    return await fetch(url);
  }
}

export async function fetchM3U(url: string): Promise<IptvChannel[]> {
  let res: Response;
  try {
    res = await fetchWithFallback(url);
  } catch (netErr) {
    const msg = (netErr as Error).message || String(netErr);
    throw new Error(
      `Could not reach the server. ${msg}. URL: ${url.slice(0, 80)}${url.length > 80 ? "…" : ""}.`
    );
  }
  if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
  const text = await res.text();
  const channels = parseM3U(text);
  if (channels.length === 0) {
    const preview = text.slice(0, 120).replace(/\s+/g, " ");
    throw new Error(`No channels found in playlist. Response preview: "${preview}"`);
  }
  return channels;
}

export function groupChannels(channels: IptvChannel[]): Record<string, IptvChannel[]> {
  const groups: Record<string, IptvChannel[]> = {};
  for (const ch of channels) {
    const group = ch.group || "Other";
    if (!groups[group]) groups[group] = [];
    groups[group].push(ch);
  }
  return groups;
}
