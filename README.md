# 🚀 OpenDeck: The Open-Source Presentation Studio

**OpenDeck** is a high-performance, privacy-centric presentation builder designed for the modern web. It enables users to create beautiful, branded tech talks and corporate decks with zero backend dependencies, zero tracking, and 100% data ownership.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
![Version](https://img.shields.io/badge/Version-1.0.0-green)
![Privacy](https://img.shields.io/badge/Privacy-100%25_Local-blueviolet)

---

## 🌐 Quick Start

OpenDeck is designed to be highly portable. You can use it in two ways:

1.  **Cloud Hosted**: Visit [your-cloudflare-link.pages.dev](https://https://opendeck.pages.dev/) to start building instantly.
2.  **Local Environment**: Clone this repository and open `index.html` in any modern browser. Since it uses standard ES6 and local storage, no `npm install` or local server is required.

---

## ✨ Robust Feature Set

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

OpenDeck is built with a modular "Vanilla+" approach—zero build tools, maximum performance.

```text
opendeck/
├── index.html          # Application entry & UI shell
├── styles.css          # Layout, animations, and theme engine
└── js/
    ├── globals.js      # Central state & data models
    ├── storage.js      # LocalStorage & persistence logic
    ├── editor.js       # Slide rendering & mutation
    ├── ui.js           # Dashboard & modal management
    ├── export.js       # PPTX, PDF, and HTML generators
    └── tutorial.js     # Interactive onboarding data
```

---

## 🔒 Data & Privacy

### 100% Client-Side
OpenDeck has **no backend**. Your presentations are stored in `localStorage` under the key `openDeckDB_v2`.
* **Warning**: Clearing your browser cache will delete your local presentations.

### .odeck Portability
To ensure long-term safety, OpenDeck includes a custom `.odeck` export/import format. This allows you to download a JSON-based backup of your project to your hard drive and restore it on any other machine.

---

## 🛠️ For Developers: Adding Custom Templates

You can easily extend OpenDeck by adding new types to `editor.js`.

1.  **Define the UI**: Add a new `template-card` to `index.html`.
2.  **Define the Data**: Add the default object structure to the `addSlide()` function in `editor.js`.
3.  **Define the Render**: Add a new condition to `generateSlideHTML()` to define how the slide looks in the preview and exports.

---

## 📜 License

This project is licensed under the **MIT License**.

> "THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED...".

---

**Crafted for developers and presenters who value privacy and speed.** Built by **Chris Glaske**.