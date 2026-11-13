import { embedUrl, getScribdDocument } from "./links.js";
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
          const signature = data.pages.map(page => `${page.number}:${page.text.length}`).join(",");
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
  throw new Error("No readable text loaded in the Scribd embed. Try again once the document is available.");
}

async function readEmbed({ sourceUrl, sourceTabId }) {
  const source = getScribdDocument(sourceUrl);
  if (!source || !Number.isInteger(sourceTabId)) throw new Error("Open a Scribd document first.");

  if (source.isEmbed) return readEmbedTab(sourceTabId, source.id);

  const tab = await chrome.tabs.create({ url: embedUrl(source.id), active: false });
  try {
    return await readEmbedTab(tab.id, source.id);
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
