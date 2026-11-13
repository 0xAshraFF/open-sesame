import { embedUrl, getScribdDocument } from "./links.js";
import { readPageImages } from "./archive.js";
import { readScribdDocument } from "./reader.js";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function readEmbedTab(tabId, id) {
  const deadline = Date.now() + 15_000;
  let latest;
  let previousSignature;
  let stableReads = 0;
  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId);
    const address = getScribdDocument(tab.url);
    if (tab.status === "complete" && tab.url && tab.url !== "about:blank" && (!address?.isEmbed || address.id !== id)) {
      throw new Error("Scribd could not open this document in its embed viewer.");
    }
    if (address?.isEmbed && address.id === id) {
      try {
        const [injection] = await chrome.scripting.executeScript({
          target: { tabId },
          func: readScribdDocument,
          args: [id, true]
        });
        const data = injection?.result;
        if (data?.pages.length) {
          latest = data;
          const signature = data.pages.map(page => (
            `${page.number}:${page.text.length}:${page.visual?.images.length ?? 0}`
          )).join(",");
          stableReads = signature === previousSignature ? stableReads + 1 : 0;
          previousSignature = signature;
          if (stableReads >= 2) return data;
        }
      } catch (error) {
        if (tab.status === "complete") throw error;
      }
    }
    await delay(400);
  }
  if (latest) return latest;
  throw new Error("No readable pages loaded in the Scribd embed. Try again once the document is available.");
}

async function captureEmbed(tabId, id, format) {
  const data = await readEmbedTab(tabId, id);
  if (format === "md") {
    const pages = data.pages.filter(page => page.text).map(({ number, text }) => ({ number, text }));
    if (!pages.length) throw new Error("These pages have no selectable text for Markdown. Try PDF or HTML.");
    return { ...data, pages, omitted: data.omitted + data.pages.length - pages.length };
  }

  if (!data.pages.some(page => page.visual?.images.length)) return data;
  const address = getScribdDocument((await chrome.tabs.get(tabId)).url);
  if (!address?.isEmbed || address.id !== id) throw new Error("The embed changed before Chrome could save it.");
  const archive = await chrome.pageCapture.saveAsMHTML({ tabId });
  if (!archive) throw new Error("Chrome could not save the embed's page images.");
  const assets = await readPageImages(archive, data.pages);
  const pages = data.pages.filter(page => (
    !page.visual?.images.some(image => !assets.has(image.url))
  ));
  if (!pages.length) throw new Error("The embed's page images could not be saved. Try reloading the embed.");
  for (const page of pages) {
    for (const image of page.visual?.images ?? []) {
      image.dataUrl = assets.get(image.url);
      delete image.url;
    }
  }
  return { ...data, pages, omitted: data.omitted + data.pages.length - pages.length };
}

async function readEmbed({ sourceUrl, sourceTabId, format }) {
  const source = getScribdDocument(sourceUrl);
  if (!source || !Number.isInteger(sourceTabId)) throw new Error("Open a Scribd document first.");
  if (!["html", "pdf", "md"].includes(format)) throw new Error("Choose an export format.");

  if (source.isEmbed) return captureEmbed(sourceTabId, source.id, format);

  const tab = await chrome.tabs.create({ url: embedUrl(source.id), active: false });
  try {
    return await captureEmbed(tab.id, source.id, format);
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type !== "read-embed" || sender.url !== chrome.runtime.getURL("popup.html")) return;
  readEmbed(message).then(
    data => reply({ data }),
    error => reply({ error: error.message || "The Scribd embed could not be read." })
  );
  return true;
});
