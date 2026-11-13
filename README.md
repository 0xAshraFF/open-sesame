# Open Sesame

Export readable text from a Scribd embed as PDF, HTML, or Markdown.

1. Open `chrome://extensions` in Chrome and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder, the one containing `manifest.json`.
3. Open a Scribd document, click **Open Sesame** in the Extensions menu, and choose **PDF**, **HTML**, or **Markdown**. Chrome saves the file using your usual download settings.

Open the downloaded file on your PC. HTML opens in Chrome and Markdown opens in any text editor. The PDF lays out the text on letter-size pages. Use HTML or Markdown if you need to select, search, or edit the text.

On a Scribd document page, the extension uses the document ID to open `https://www.scribd.com/embeds/<id>/content` in a background tab. It saves the readable text and page numbers as a self-contained HTML snapshot and converts that snapshot for PDF or Markdown. Chrome downloads just the format you choose. Keep the popup open while it prepares the file.

Exports cover pages the embed has loaded. For more pages, open the embed directly, scroll through the pages you need, and export from that tab. Unloaded, hidden, blurred, and image-only pages are skipped. Scribd's own **Download** button, when available, provides the original file with its images and layout.

The extension accesses the Scribd viewer and converts the snapshot locally. It uses no remote converter.
