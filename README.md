# PDF_Editor.py
`PDF_Editor.py` is a desktop application to merge PDF files and reorder/delete pages in PDF file.

# Features
* Open a PDF file and show thumbnails of all pages.
* Open and save an encrypted PDF file with user/owner password.
* Append all pages of other PDF file.
* Reorder pages by drag-and-drop.
* Delete pages.

# Requirements
* Python 3.13 or later
* uv

**NOTE: The `install.ps1` for Windows installer will install all of the above requirements automatically if needed.**

# Install
## for Windows
* Open a Powershell prompt and run `install.ps1`
  ```powershell
  powershell -ExecutionPolicy ByPass -File install.ps1
  ```

## for macOS
* Open a Terminal and run the following command:
  ```bash
  uv sync
  ```

# Launch
## for Windows
* Double click or select the shortcut icon on the desktop or startmenu.

## for macOS
* Open a Terminal and run the following command:
  ```bash
  uv run pdf_editor.py
  ```
