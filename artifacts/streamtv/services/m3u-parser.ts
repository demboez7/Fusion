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

export async function fetchM3U(url: string): Promise<IptvChannel[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const text = await res.text();
    if (!text.includes("#EXTM3U") && !text.includes("#EXTINF")) {
      throw new Error("Not a valid M3U file. Check your URL.");
    }
    const channels = parseM3U(text);
    if (channels.length === 0) throw new Error("Playlist loaded but no channels found");
    return channels;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("Request timed out after 20s");
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
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
