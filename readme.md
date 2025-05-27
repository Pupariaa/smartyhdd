# SMARTYHDD

**SMARTYHDD** is an open-source diagnostic and formatting tool for HDDs and SSDs, built in Node.js and designed for Windows. It extracts SMART data via `smartctl`, generates professional PDF reports, and format full disks.

> Developed with ❤️ by [Puparia](https://github.com/pupariaa)

![License](https://img.shields.io/github/license/pupariaa/smartyhdd?style=flat-square)
![Node.js](https://img.shields.io/badge/node-%3E%3D18-green?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Windows-blue?style=flat-square)

---

## 📸 Preview

<img src="https://img001.prntscr.com/file/img001/HspVjE-lQdeVWMjs6MRENA.png">
<img src="https://img001.prntscr.com/file/img001/_Du7zYhmSteRWFKcxUFf0Q.png">
<img src="https://img001.prntscr.com/file/img001/ViEedZnOQ06dxHjjNR_vFQ.png">

---

## ⚙ Features

* Interactive CLI using `inquirer`
* SMART data reading via `smartctl`
* PDF report generation in English or French
* Full or quick formatting with partitioning (diskpart)

---

## ✨ Quick Start

### Requirements

* Windows 10/11
* Administrator privileges
* Internet connection (first launch only, for Node.js install)

### Launch

```powershell
./run.ps1
```

That’s it. The script checks for Node.js, installs it silently if needed, and launches the interactive CLI.

---

## 📄 PDF Reports
<img src="https://img001.prntscr.com/file/img001/X4ZS2YxWRzOk9dnPciZFDA.png">
Each exported PDF includes:

* General disk info (model, serial, capacity, temp, health...)
* Detailed SMART attributes (ID, name, raw value, threshold, etc.)
* Localized labels (English or French)

<img src="https://img001.prntscr.com/file/img001/WC72ob1fTReEkaHcQIZRcQ.png">


---

## 💣 Formatting (DANGEROUS)
<img src="https://img001.prntscr.com/file/img001/33O1DY2rQfiaiTbOtifrww.png">
You can erase and reformat a full disk:

* Disk selection
* Choose FS (NTFS, exFAT, FAT32)
* Quick or full format
* Auto partition creation and volume label assignment

⚠️ All data is permanently deleted. Use with caution.

---

## 📂 Structure

```
smartyhdd/
├── src/
│   └── smart.js            # Main application
│   └── smartctl.exe        # Background service
├── run.ps1                 # Launcher with admin + resize
├── run.bat                 # Click-to-run Windows batch
├── README.md
└── package.json            # Optional (if npm is used)
```

---

## 📜 License

MIT © Puparia

---

## 🚀 Contributions

Want to help?

* Add support for other platforms (Linux/macOS)
* Export to other formats (CSV, JSON, HTML)
* Improve UI or allow CLI arguments

PRs welcome! ✨
