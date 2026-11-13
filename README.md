# Open Sesame

Export readable text from a Scribd document as PDF, HTML, or Markdown.

1. Open `chrome://extensions` in Chrome and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder, the one containing `manifest.json`.
3. Open a Scribd document, click **Open Sesame** in the Extensions menu, and choose **PDF**, **HTML**, or **Markdown**. Chrome saves the file using your usual download settings.

Open the downloaded file on your PC. HTML opens in Chrome and Markdown opens in any text editor. The PDF lays out the text on letter-size pages. Use HTML or Markdown if you need to select, search, or edit the text.

The extension reads text from pages already loaded in the Scribd viewer, including supported embed pages. Scroll through the pages you want before exporting. Unloaded, hidden, blurred, and image-only pages are skipped. The export preserves readable text and page numbers. Scribd's own **Download** button, when available, is the way to get the original file with its images and layout.

The extension runs locally and requests temporary access to the current tab when you open its popup. It uses no remote converter.
