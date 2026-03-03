# 🚀 OpenDeck: The Open-Source Presentation Studio

**OpenDeck** is a high-performance, privacy-centric presentation builder designed for the modern web. It enables users to create beautiful, branded tech talks and corporate decks with zero backend dependencies, zero tracking, and 100% data ownership.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
![Version](https://img.shields.io/badge/Version-1.0-green)
![Privacy](https://img.shields.io/badge/Privacy-100%25_Local-blueviolet)
[![Wiki](https://img.shields.io/badge/Documentation-Wiki-orange.svg)](https://github.com/chrisglaske/opendeck/wiki)

---

## 🌐 Quick Start

OpenDeck is designed to be highly portable. You can use it in two ways:

1.  **Cloud Hosted**: Visit [OpenDeck](https://opendeck.work/) to start building instantly.
2.  **Local Environment**: Clone this repository and open `index.html` in any modern browser. Since it uses standard ES6, LocalStorage, and ships with pre-compiled CSS, **no `npm install` or local server is required to run the app.**
3.  * **📖 Documentation**: [Full Wiki & Developer Guides](https://github.com/chrisglaske/opendeck/wiki)

---

## ✨ Robust Feature Set

### 🗂️ Dashboard Organization
* **Folders & Drag-and-Drop**: Keep your workspace tidy by creating custom folders. Drag your `.odeck` projects directly into them to organize by client, topic, or quarter.
* **Tagging System**: Assign custom comma-separated tags to presentations to quickly filter and search through your deck library.

### 🛠️ The Interactive Builder
* **WYSIWYG Inline Editing**: Every text element on the slide preview is `contenteditable`. 
* **Live Sync**: Click and type directly on the slide; the inspector panel stays in sync automatically.
* **Drag-and-Drop Outline**: Reorder your presentation flow instantly by dragging slides in the left-hand sidebar.
* **Smart Image Compression**: Built-in canvas-based resizing ensures high-res uploads don't crash your browser's storage limits.

### 🎨 Premium Slide Templates
OpenDeck features three distinct "Design Tracks" to suit any audience:
* **Modern Tech**: Specialized templates for Terminal/Code blocks, Feature Grids, and Hero Icons.
* **Corporate Edge**: Minimalist layouts focusing on Executive Titles, Magazine Splits, and Visionary Quotes.
* **Creative Pitch**: High-impact visuals featuring Cinematic Backgrounds, Metric Counters, and Project Timelines.

### 📤 Multi-Engine Export
* **PowerPoint (PPTX)**: Generates high-fidelity `.pptx` files compatible with Google Slides and Microsoft PowerPoint. 
* **Speaker Notes**: Notes added in the inspector are automatically embedded into the exported PPTX file.
* **High-Res PDF**: Uses optimized print CSS to generate perfect 16:9 PDF documents.
* **Standalone HTML**: Export your entire deck as a single, interactive HTML file that runs anywhere without dependencies.

---

## 🏗️ Project Architecture

OpenDeck is built with a modular "Vanilla+" approach—maximum performance with minimal tooling.

    opendeck/
    ├── index.html          # Application entry, UI shell, and CSP rules
    ├── styles.css          # Custom animations and theme engines
    ├── tailwind-build.css  # Pre-compiled Tailwind CSS (Production Ready)
    ├── tailwind.config.js  # Tailwind configuration (For devs)
    ├── input.css           # Tailwind input directives (For devs)
    └── js/
        ├── globals.js      # Central state & data models
        ├── storage.js      # LocalStorage & persistence logic
        ├── editor.js       # Slide rendering & mutation
        ├── ui.js           # Dashboard & modal management
        ├── export.js       # PPTX, PDF, and HTML generators
        └── tutorial.js     # Interactive onboarding data

---

## 🔒 Data & Enterprise Security

### 100% Client-Side
OpenDeck has **no backend database**. Your presentations are stored in `localStorage` under the key `openDeckDB_v2`, and your dashboard folders are saved under `openDeckFolders_v1`.
* **Warning**: Clearing your browser cache will delete your local presentations.

### Strict Content Security Policy (CSP)
OpenDeck is engineered for corporate safety. It includes a strict CSP that explicitly blocks unknown external scripts, making it highly resistant to Cross-Site Scripting (XSS) attacks, even when importing foreign `.odeck` files.

### .odeck Portability
To ensure long-term safety, OpenDeck includes a custom `.odeck` export/import format. This allows you to download a JSON-based backup of your project to your hard drive and safely restore it on any other machine.

---

## 🛠️ For Developers

### Adding Custom Templates
You can easily extend OpenDeck by adding new types to `editor.js`.
1.  **Define the UI**: Add a new `template-card` to `index.html`.
2.  **Define the Data**: Add the default object structure to the `addSlide()` function in `editor.js`.
3.  **Define the Render**: Add a new condition to `generateSlideHTML()` to define how the slide looks in the preview and exports.

### Recompiling Tailwind CSS
OpenDeck ships with a pre-compiled CSS file so anyone can run it instantly. However, if you add new Tailwind classes to the HTML, you will need to recompile the CSS. 
You do not need an extensive node setup; just run the standalone CLI command from the project root:

    npx tailwindcss@3.4.1 -i ./input.css -o ./tailwind-build.css --minify


---

## 📜 License

This project is licensed under the **MIT License**.

> "THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED...".

---

**Crafted for developers and presenters who value privacy and speed.**

Built by **Chris Glaske** with ♥️.