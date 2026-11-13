const decoder = new TextDecoder();
const encoder = new TextEncoder();
const imageTypes = new Map([
  ["image/jpeg", (data) => data.startsWith("\xff\xd8\xff")],
  ["image/png", (data) => data.startsWith("\x89PNG\r\n\x1a\n")],
  ["image/webp", (data) => data.startsWith("RIFF") && data.slice(8, 12) === "WEBP"],
  ["image/gif", (data) => data.startsWith("GIF87a") || data.startsWith("GIF89a")],
  ["image/bmp", (data) => data.startsWith("BM")]
]);

function imageKey(value) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return undefined;
    url.protocol = "https:";
    url.hash = "";
    return url.href;
  } catch {
    return undefined;
  }
}

function readHeaders(bytes, start) {
  const headers = new Map();
  let name;
  let position = start;
  while (position < bytes.length) {
    const end = bytes.indexOf(10, position);
    if (end < 0 || end - start > 64 * 1024) return undefined;
    const line = decoder.decode(bytes.subarray(position, bytes[end - 1] === 13 ? end - 1 : end));
    position = end + 1;
    if (!line) return { headers, end: position };
    if (/^[\t ]/.test(line) && name) {
      const separator = name === "content-location" ? "" : " ";
      headers.set(name, headers.get(name) + separator + line.trim());
      continue;
    }
    const colon = line.indexOf(":");
    if (colon <= 0) return undefined;
    name = line.slice(0, colon).toLowerCase();
    if (headers.has(name)) return undefined;
    headers.set(name, line.slice(colon + 1).trim());
  }
  return undefined;
}

function findBoundary(bytes, token, start) {
  let position = start;
  while (position < bytes.length) {
    if (bytes[position] === 45 && token.every((byte, index) => bytes[position + index] === byte)) {
      let end = position + token.length;
      const closed = bytes[end] === 45 && bytes[end + 1] === 45;
      if (closed) end += 2;
      while (bytes[end] === 32 || bytes[end] === 9) end++;
      if (bytes[end] === 13) end++;
      if (bytes[end] === 10 || (closed && end === bytes.length)) {
        return { start: position, end: end + 1, closed };
      }
    }
    const end = bytes.indexOf(10, position);
    if (end < 0) break;
    position = end + 1;
  }
  return undefined;
}

function binaryString(bytes) {
  let text = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    text += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return text;
}

function rasterDataUrl(contentType, encoding, bytes) {
  const checkImage = imageTypes.get(contentType);
  if (!checkImage || bytes.length === 0) return undefined;
  let data = binaryString(bytes);
  try {
    if (encoding === "base64") data = atob(data);
    else if (encoding === "quoted-printable") {
      data = data.replace(/=\r?\n|=([0-9a-f]{2})/gi, (_, hex) => (
        hex ? String.fromCharCode(Number.parseInt(hex, 16)) : ""
      ));
    } else if (!["binary", "8bit", "7bit", ""].includes(encoding)) return undefined;
    if (checkImage(data)) return `data:${contentType};base64,${btoa(data)}`;
  } catch {
    // One malformed resource should not prevent other pages from exporting.
  }
  return undefined;
}

export async function readPageImages(archiveBlob, pages) {
  const requested = new Map();
  const images = new Map();
  for (const page of pages) {
    for (const { url } of page.visual?.images ?? []) {
      if (typeof url !== "string") continue;
      const key = imageKey(url);
      if (key) {
        if (!requested.has(key)) requested.set(key, new Set());
        requested.get(key).add(url);
        continue;
      }
      const inline = url.match(/^data:(image\/[a-z]+);base64,([a-z0-9+/=]+)$/i);
      if (inline) {
        const dataUrl = rasterDataUrl(inline[1].toLowerCase(), "base64", encoder.encode(inline[2]));
        if (dataUrl) images.set(url, dataUrl);
      }
    }
  }
  if (!archiveBlob || !requested.size) return images;

  const bytes = new Uint8Array(await archiveBlob.arrayBuffer());
  const archive = readHeaders(bytes, 0);
  const contentType = archive?.headers.get("content-type");
  if (!/^multipart\/related\b/i.test(contentType ?? "")) return images;
  const match = contentType.match(/;\s*boundary\s*=\s*(?:"([^"\r\n]+)"|([^;\s]+))/i);
  const boundary = match?.[1] ?? match?.[2];
  if (!boundary || boundary.length > 70) return images;

  const token = encoder.encode(`--${boundary}`);
  let part = findBoundary(bytes, token, archive.end);
  while (part && !part.closed && requested.size) {
    const header = readHeaders(bytes, part.end);
    if (!header) break;
    const next = findBoundary(bytes, token, header.end);
    if (!next) break;

    const key = imageKey(header.headers.get("content-location"));
    if (requested.has(key)) {
      const type = header.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
      const encoding = header.headers.get("content-transfer-encoding")?.toLowerCase() ?? "";
      let bodyEnd = next.start;
      if (bodyEnd > header.end && bytes[bodyEnd - 1] === 10) bodyEnd--;
      if (bodyEnd > header.end && bytes[bodyEnd - 1] === 13) bodyEnd--;
      const dataUrl = rasterDataUrl(type, encoding, bytes.subarray(header.end, bodyEnd));
      if (dataUrl) {
        for (const url of requested.get(key)) images.set(url, dataUrl);
        requested.delete(key);
      }
    }
    part = next;
  }
  return images;
}
