import { getScribdDocument } from "./links.js";

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

function createSnapshot(data) {
  const sections = data.pages.map(page => (
    `<section data-page="${page.number}"><h2>Page ${page.number}</h2><div class="text">${escapeHtml(page.text)}</div></section>`
  ));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
  <title>${escapeHtml(data.title)}</title>
  <style>
    body { max-width: 48rem; margin: 2rem auto; padding: 0 1rem; color: #202825;
      font: 16px/1.65 system-ui, sans-serif; overflow-wrap: anywhere; }
    h1 { font-size: 1.7rem; line-height: 1.25; }
    section { border-top: 1px solid #c8d4ce; margin-top: 2rem; padding-top: .75rem; }
    h2 { font-size: 1rem; color: #475650; }
    .text { white-space: pre-wrap; }
  </style>
</head>
<body><main>
  <h1>${escapeHtml(data.title)}</h1>
  ${sections.join("\n  ")}
</main></body>
</html>`;
}

function readSnapshot(html) {
  const snapshot = new DOMParser().parseFromString(html, "text/html");
  return {
    title: snapshot.querySelector("h1").textContent,
    pages: [...snapshot.querySelectorAll("section[data-page]")].map(section => ({
      number: section.dataset.page,
      text: section.querySelector(".text").textContent
    }))
  };
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

async function createFile(format, html) {
  if (format === "html") return new Blob([html], { type: "text/html;charset=utf-8" });
  const data = readSnapshot(html);
  if (format === "pdf") {
    const { createPdf } = await import("./pdf.js");
    return createPdf(data);
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
  setStatus("Downloads readable pages loaded in the Scribd embed.");
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
          sourceTabId: tab.id
        });
        if (!result?.data) throw new Error(result?.error || "The Scribd embed could not be read.");
        const { data } = result;
        setStatus(`Preparing ${button.textContent}…`);
        const file = await createFile(format, createSnapshot(data));
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
