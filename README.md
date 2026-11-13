# Open Sesame

Save loaded Scribd embed pages for offline use as PDF, HTML, or Markdown.

1. Open `chrome://extensions` in Chrome and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder, the one containing `manifest.json`.
3. Open a Scribd document, click **Open Sesame** in the Extensions menu, and choose **PDF**, **HTML**, or **Markdown**. Chrome saves the file using your usual download settings.

**PDF** includes the saved page images and reconstructs their layout where available. **HTML** embeds the saved images in a single file you can open offline. **Markdown** saves selectable text and skips image-only pages. It does not run OCR.

On a Scribd document page, the extension uses the document ID to open `https://www.scribd.com/embeds/<id>/content` in a background tab. For PDF and HTML it uses Chrome's web page capture to collect images the embed has loaded, then generates the selected file locally. Chrome downloads just the format you choose. Keep the popup open while it prepares the file.

Exports cover pages the embed has loaded. For more pages, open the embed directly, scroll through the pages you need, and export from that tab. Unloaded, hidden, and blurred pages are skipped. Some fonts or positioning can differ from the viewer. Scribd's own **Download** button, when available, provides the original file.

The extension accesses the Scribd viewer and converts the snapshot locally. It uses no remote converter.
