// This function runs in Chrome's isolated world on the active Scribd tab.
// It reads the viewer DOM without fetching or changing the page.
export function readScribdDocument(expectedId) {
  const path = location.pathname;
  const id = path.match(/^\/(?:document|doc|presentation)\/(\d+)(?:\/|$)/i)?.[1]
    ?? path.match(/^\/embeds\/(\d+)\/content\/?$/i)?.[1];

  if (
    location.protocol !== "https:"
    || !["www.scribd.com", "scribd.com"].includes(location.hostname)
    || id !== expectedId
  ) {
    throw new Error("The tab changed. Reopen the extension on the Scribd document.");
  }

  const viewer = document.querySelector(
    ".document_scroller, #document_scroller, #pdf_document_scroll_container"
  );
  const title = document.querySelector('[data-e2e="doc_page_title"]')?.innerText?.trim()
    || document.title.replace(/\s*\|\s*Scribd\s*$/i, "").trim() || `Scribd ${id}`;
  if (!viewer) return { title, pages: [], omitted: 0 };

  const restrictions = [
    ".blurred_page", ".locked_page", ".restricted_page", ".paywall",
    '[hidden]', '[aria-hidden="true"]', '[data-page-locked="true"]'
  ].join(",");

  function isReadable(element) {
    if (element.closest(restrictions)) return false;
    for (let current = element; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (
        style.display === "none" || style.visibility !== "visible" || Number(style.opacity) === 0
        || style.contentVisibility === "hidden" || /blur\(/i.test(style.filter)
      ) return false;
      if (current === document.documentElement) break;
    }
    const style = getComputedStyle(element);
    return style.color !== "transparent" && !/[,/]\s*0\s*\)$/.test(style.color);
  }

  function readTextLayer(layer) {
    if (!isReadable(layer)) return "";
    const positioned = [...layer.querySelectorAll("span.a, span.g")];
    if (positioned.length) {
      const fragments = positioned
        .filter(span => span.textContent.trim() && isReadable(span))
        .map(span => {
          const { top, left, right, height } = span.getBoundingClientRect();
          return { top, left, right, height, text: span.textContent };
        })
        .filter(fragment => fragment.height > 0)
        .sort((a, b) => a.top - b.top || a.left - b.left);
      const rows = [];
      for (const fragment of fragments) {
        const row = rows.at(-1);
        if (row && Math.abs(row.top - fragment.top) <= Math.max(1, fragment.height * .35)) {
          row.fragments.push(fragment);
        } else {
          rows.push({ top: fragment.top, fragments: [fragment] });
        }
      }
      return rows.map(row => {
        let line = "";
        let previous;
        for (const part of row.fragments.sort((a, b) => a.left - b.left)) {
          if (previous && part.left - previous.right > .5 && !/\s$/.test(line) && !/^\s/.test(part.text)) {
            line += " ";
          }
          line += part.text;
          previous = part;
        }
        return line.trim();
      }).join("\n");
    }

    // Use computed visibility for individual fragments as well as for the page.
    const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
    let text = "";
    let previousLine;
    const range = document.createRange();
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim() || !isReadable(node.parentElement)) continue;
      range.selectNodeContents(node);
      const firstLine = range.getClientRects()[0];
      const lastLine = range.getClientRects()[range.getClientRects().length - 1];
      if (!firstLine) continue;
      if (previousLine && Math.abs(previousLine.top - firstLine.top) > 1) {
        text += "\n";
      } else if (previousLine && firstLine.left - previousLine.right > .5 && !/\s$/.test(text)) {
        text += " ";
      }
      text += node.textContent.replace(/[\r\n\t]+/g, " ");
      previousLine = lastLine;
    }
    return text.split("\n").map(line => line.trim()).join("\n").trim();
  }

  const sourcePages = [...viewer.querySelectorAll(".outer_page, .page[data-page-number]")]
    .filter(page => !page.parentElement.closest(".outer_page, .page[data-page-number]"));
  const pages = [];
  for (const [index, page] of sourcePages.entries()) {
    const layer = page.querySelector(".text_layer, .text-layer, .textLayer");
    if (!layer || !isReadable(page)) continue;
    const text = readTextLayer(layer);
    if (!text) continue;
    const number = page.dataset.pageNumber ?? page.id.match(/\d+$/)?.[0] ?? String(index + 1);
    pages.push({ number: /^\d+$/.test(number) ? number : String(index + 1), text });
  }
  return { title, pages, omitted: sourcePages.length - pages.length };
}

