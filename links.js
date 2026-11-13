export function getScribdDocument(value) {
  const match = value?.match(
    /^https:\/\/(?:www\.)?scribd\.com\/(?:(?:document|doc|presentation)\/(\d+)(?:[/?#]|$)|embeds\/(\d+)\/content\/?(?:[?#]|$))/i
  );
  if (!match) return null;
  return { id: match[1] ?? match[2], isEmbed: Boolean(match[2]) };
}

export function embedUrl(id) {
  return `https://www.scribd.com/embeds/${id}/content`;
}
