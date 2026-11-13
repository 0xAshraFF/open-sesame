async function loadImage(source) {
  const image = new Image();
  image.src = source;
  await image.decode();
  return image;
}

export async function renderVisualPage({ visual }) {
  if (!visual?.images.length) return null;
  const { width, height, images, fragments } = visual;
  const scale = Math.min(2, 2400 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Chrome could not render the page layout.");
  context.scale(canvas.width / width, canvas.height / height);
  context.fillStyle = "white";
  context.fillRect(0, 0, width, height);

  for (const image of images) {
    const bitmap = await loadImage(image.dataUrl);
    context.save();
    if (image.clip) {
      const [top, right, bottom, left] = image.clip;
      context.beginPath();
      context.rect(image.left + left, image.top + top, Math.max(0, right - left), Math.max(0, bottom - top));
      context.clip();
    }
    context.drawImage(bitmap, image.left, image.top, image.width, image.height);
    context.restore();
  }

  for (const fragment of fragments) {
    const fontSize = Math.max(1, fragment.height * .85);
    context.font = `${fragment.fontStyle} ${fragment.weight} ${fontSize}px ${fragment.family}, Arial, sans-serif`;
    context.fillStyle = fragment.color;
    context.textBaseline = "top";
    const measured = context.measureText(fragment.text).width;
    if (!measured) continue;
    context.save();
    context.translate(fragment.left, fragment.top);
    context.scale(fragment.width / measured, 1);
    context.fillText(fragment.text, 0, 0);
    context.restore();
  }
  return canvas;
}
