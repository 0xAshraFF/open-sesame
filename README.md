# Open Sesame

Save Scribd pages for offline reading with one click. Open a document in desktop Google Chrome, click **Open Sesame**, and pick **PDF**, **HTML**, or **Markdown**.

## Install on Windows

1. [**Download Open Sesame ZIP**](https://github.com/0xAshraFF/open-sesame/archive/refs/heads/main.zip). The file is called `open-sesame-main.zip`. You can also use **Code → Download ZIP** on this GitHub page.
2. Open **File Explorer → Downloads**. Right-click the ZIP, choose **Extract All**, then click **Extract**. Windows creates a regular folder with the extension files.
3. Open the extracted folder in File Explorer and look for `manifest.json`. If you see another `open-sesame-main` folder inside, open it too. The folder that directly contains `manifest.json` is the one Chrome needs.
4. In desktop Chrome, type `chrome://extensions` into the address bar and press **Enter**. Turn on **Developer mode** in the top right.
5. Click **Load unpacked**, go to the folder you found in step 3, and click **Select Folder**. An **Open Sesame** card should appear on the Extensions page.

If you already have the extracted files, start at step 3. Chrome loads the extension from that folder, so keep it in place.

## Download a document

1. Open the Scribd document you want to save.
2. Click the **puzzle-piece icon** at the top right of Chrome, then click **Open Sesame**. To keep it on the toolbar, click the **pin** beside its name in that menu.
3. Choose **PDF**, **HTML**, or **Markdown**. Keep the popup open until it says the download started. If Chrome asks where to save the file, choose a folder and click **Save**.
4. Press **Ctrl+J** in Chrome to find the file. It will have a name like `scribd-438238896.pdf`.

| Choose | What you get |
| --- | --- |
| **PDF** | A file for offline reading. It includes loaded page images where available. The layout may differ from the original. |
| **HTML** | One web page with images included. Double-click the file to open it in your browser, even offline. |
| **Markdown** | A `.md` text file you can open in Notepad. It skips pages that contain only images, such as scanned pages. |

## If something goes wrong

- **Chrome says the manifest is missing.** Extract the ZIP first. Select the folder that contains `manifest.json` directly. If you picked the folder one level above it, open the inner folder.
- **The format buttons are grey.** Open an individual Scribd document in the current tab, then reopen Open Sesame.
- **The file is missing pages.** Open Sesame saves pages that have loaded in the Scribd viewer. To load more pages, take the number after `/document/` in the Scribd address and put it into the viewer link. For example, document `438238896` opens at [scribd.com/embeds/438238896/content](https://www.scribd.com/embeds/438238896/content). Scroll through the pages you need, wait for them to appear, then use Open Sesame from that tab. Scribd's own **Download** button can provide the original file when available.
