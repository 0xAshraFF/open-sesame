import { getScribdDocument } from "./links.js";
import { renderVisualPage } from "./visual.js";

const buttons = [...document.querySelectorAll("[data-format]")];
const status = document.querySelector("#status");
const title = document.querySelector("#document-title");

function setStatus(message, error = false) {
  status.textContent = message;
  status.toggleAttribute("data-error", error);
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

async function createSnapshot(data) {
  const sections = [];
  for (const page of data.pages) {
    const canvas = await renderVisualPage(page);
    const text = `<div class="text">${escapeHtml(page.text)}</div>`;
    let content = text;
    if (canvas) {
      const bitmap = canvas.toDataURL("image/jpeg", .93);
      canvas.width = 0;
      canvas.height = 0;
      content = `<img src="${bitmap}" alt="Page ${page.number}">`;
      if (page.text) content += `<details><summary>Page text</summary>${text}</details>`;
    }
    sections.push(`<section><h2>Page ${page.number}</h2>${content}</section>`);
  }
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
  <title>${escapeHtml(data.title)}</title>
  <style>
    body { max-width: 48rem; margin: 2rem auto; padding: 0 1rem; color: #202825;
      font: 16px/1.65 system-ui, sans-serif; overflow-wrap: anywhere; }
    h1 { font-size: 1.7rem; line-height: 1.25; }
    section { border-top: 1px solid #c8d4ce; margin-top: 2rem; padding-top: .75rem; }
    h2 { font-size: 1rem; color: #475650; }
    img { display: block; max-width: 100%; height: auto; }
    details { margin-top: .5rem; }
    .text { white-space: pre-wrap; }
  </style>
</head>
<body><main>
  <h1>${escapeHtml(data.title)}</h1>
  ${sections.join("\n  ")}
</main></body>
</html>`;
}

function createMarkdown(data) {
  function escapeMarkdown(text) {
    return text.replace(/[\\`*_{}\[\]<>()#+.!|>~=-]/g, "\\$&");
  }
  const sections = data.pages.map(page => (
    `## Page ${page.number}\n\n${page.text.split("\n").map(escapeMarkdown).join("  \n")}`
  ));
  const markdown = `# ${escapeMarkdown(data.title.replace(/\s+/g, " "))}\n\n${sections.join("\n\n")}\n`;
  return new Blob([markdown], { type: "text/markdown;charset=utf-8" });
}

async function createFile(format, data) {
  if (format === "html") return new Blob([await createSnapshot(data)], { type: "text/html;charset=utf-8" });
  if (format === "pdf") {
    const { createPdf } = await import("./pdf.js");
    return createPdf(data, renderVisualPage);
  }
  return createMarkdown(data);
}

function setButtonsDisabled(disabled) {
  for (const button of buttons) button.disabled = disabled;
}

async function initialize() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const source = getScribdDocument(tab?.url);
  if (!Number.isInteger(tab?.id) || !source) {
    setStatus("Open a Scribd document to download it.");
    return;
  }

  const { id } = source;
  title.textContent = tab.title?.replace(/\s*\|\s*Scribd\s*$/i, "").trim() || `Document ${id}`;
  title.title = title.textContent;
  title.hidden = false;
  setStatus("Saves loaded embed pages for offline use.");
  setButtonsDisabled(false);

  for (const button of buttons) {
    button.addEventListener("click", async () => {
      const format = button.dataset.format;
      setButtonsDisabled(true);
      setStatus("Loading the Scribd embed… Keep this popup open.");
      try {
        const result = await chrome.runtime.sendMessage({
          type: "read-embed",
          sourceUrl: tab.url,
          sourceTabId: tab.id,
          format
        });
        if (!result?.data) throw new Error(result?.error || "The Scribd embed could not be read.");
        const { data } = result;
        setStatus(`Preparing ${button.textContent}…`);
        const file = await createFile(format, data);
        const url = URL.createObjectURL(file);
        try {
          await chrome.downloads.download({
            url,
            filename: `scribd-${id}.${format}`,
            conflictAction: "uniquify"
          });
        } catch (error) {
          URL.revokeObjectURL(url);
          throw error;
        }
        // Chrome opens the Blob when starting the download. Give it time to take ownership.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        const count = data.pages.length;
        const summary = `${button.textContent} download started. ${count} ${count === 1 ? "page" : "pages"} exported.`;
        setStatus(data.omitted ? `${summary} ${data.omitted} skipped.` : summary);
      } catch (error) {
        setStatus(error.message || "Download failed. Reload the document and try again.", true);
      } finally {
        setButtonsDisabled(false);
      }
    });
  }
}

initialize().catch(() => setStatus("Chrome could not read this tab. Reopen the extension and try again.", true));
