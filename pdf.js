const pageWidth = 612;
const pageHeight = 792;
const resolution = 2;
const margin = 48;
const bodyWidth = pageWidth - 2 * margin;
const lineHeight = 17;
const linesPerPage = 38;
const bodyFont = '13px "Segoe UI", Arial, sans-serif';

function* wrapLine(context, line) {
  let current = "";
  for (const word of line.split(/\s+/u).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= bodyWidth) {
      current = candidate;
      continue;
    }

    if (current) yield current;
    current = "";

    if (context.measureText(word).width <= bodyWidth) {
      current = word;
      continue;
    }

    const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    for (const { segment } of graphemes.segment(word)) {
      if (current && context.measureText(current + segment).width > bodyWidth) {
        yield current;
        current = "";
      }
      current += segment;
    }
  }
  yield current;
}

function* wrapText(context, text) {
  for (const line of text.trim().split(/\r\n|\n|\r/u)) {
    yield* wrapLine(context, line);
  }
}

function drawPage(context, title, sourcePage, part, outputPage, lines) {
  context.fillStyle = "#fff";
  context.fillRect(0, 0, pageWidth, pageHeight);
  context.fillStyle = "#17212b";
  context.font = 'bold 17px "Segoe UI", Arial, sans-serif';
  context.fillText(title, margin, 48, bodyWidth);

  context.fillStyle = "#485560";
  context.font = '11px "Segoe UI", Arial, sans-serif';
  const label = part === 1 ? `Source page ${sourcePage}` : `Source page ${sourcePage} (continued)`;
  context.fillText(label, margin, 69, bodyWidth);
  context.fillText(String(outputPage), margin, 752);

  context.strokeStyle = "#dce1e6";
  context.beginPath();
  context.moveTo(margin, 81);
  context.lineTo(pageWidth - margin, 81);
  context.stroke();

  context.fillStyle = "#17212b";
  context.font = bodyFont;
  for (const [index, line] of lines.entries()) {
    context.fillText(line, margin, 108 + index * lineHeight, bodyWidth);
  }
}

function asJpeg(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((image) => {
      if (image?.type === "image/jpeg") resolve(image);
      else reject(new Error("Chrome could not render a PDF page."));
    }, "image/jpeg", 0.92);
  });
}

function utf16Hex(text) {
  let hex = "FEFF";
  for (let index = 0; index < text.length; index++) {
    hex += text.charCodeAt(index).toString(16).padStart(4, "0");
  }
  return hex;
}

function encodePdf(images, title) {
  const chunks = [];
  const offsets = [0];
  let size = 0;

  // PDF syntax and metadata hex are ASCII. JPEG bytes are kept as binary blobs.
  function append(chunk) {
    chunks.push(chunk);
    size += chunk instanceof Blob ? chunk.size : chunk.length;
  }

  function writeObject(id, ...contents) {
    offsets[id] = size;
    append(`${id} 0 obj\n`);
    for (const content of contents) append(content);
    append("\nendobj\n");
  }

  append("%PDF-1.4\n");
  append(new Uint8Array([37, 226, 227, 207, 211, 10]));

  const pageIds = images.map((_, index) => 3 + index * 3);
  writeObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  writeObject(2, `<< /Type /Pages /Count ${images.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`);

  for (const [index, image] of images.entries()) {
    const pageId = pageIds[index];
    const streamId = pageId + 1;
    const imageId = pageId + 2;
    writeObject(pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /PageImage ${imageId} 0 R >> >> /Contents ${streamId} 0 R >>`);

    const commands = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/PageImage Do\nQ\n`;
    writeObject(streamId, `<< /Length ${commands.length} >>\nstream\n${commands}endstream`);
    writeObject(imageId,
      `<< /Type /XObject /Subtype /Image /Width ${pageWidth * resolution} /Height ${pageHeight * resolution} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.size} >>\nstream\n`,
      image,
      "\nendstream");
  }

  const infoId = 3 + images.length * 3;
  writeObject(infoId, `<< /Title <${utf16Hex(title)}> >>`);
  const xref = size;
  append(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (const offset of offsets.slice(1)) {
    append(`${String(offset).padStart(10, "0")} 00000 n \n`);
  }
  append(`trailer\n<< /Size ${offsets.length} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks, { type: "application/pdf" });
}

export async function createPdf({ title, pages }) {
  if (!pages.length) throw new Error("There is no readable text to export.");

  const canvas = document.createElement("canvas");
  canvas.width = pageWidth * resolution;
  canvas.height = pageHeight * resolution;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Chrome could not start PDF rendering.");
  context.scale(resolution, resolution);
  context.font = bodyFont;

  const images = [];
  try {
    for (const page of pages) {
      let lines = [];
      let part = 1;
      for (const line of wrapText(context, page.text)) {
        if (lines.length === linesPerPage) {
          drawPage(context, title, page.number, part, images.length + 1, lines);
          images.push(await asJpeg(canvas));
          lines = [];
          part++;
        }
        lines.push(line);
      }
      drawPage(context, title, page.number, part, images.length + 1, lines);
      images.push(await asJpeg(canvas));
    }
    return encodePdf(images, title);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
