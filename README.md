<p align="center">
  <img src="docs/images/logo.png" width="128" alt="Evelopment Games Designer logo">
</p>

<h1 align="center">Evelopment Games Designer</h1>

<p align="center">
  <a href="https://github.com/Evelynnsrepos/Evelopment-Games-Designer/releases/latest"><b>Download</b></a> ·
  <a href="#features">Features</a> ·
  <a href="#install">Install</a>
</p>

<p align="center">
  <img src="docs/images/items.jpg" width="800" alt="The Item List with item cards">
</p>

**One program for designing your whole game.** Story, lore wiki, characters, towns, items, enemies, maps,
timelines, mood boards, brainstorm boards and balancing calculators all live in one project, and they all
know about each other. Free, offline, for Windows, macOS and Linux.

> **Status:** early development. All 14 tools work, but expect rough edges and changes to the project format.

## Why

Designing a game usually means juggling a dozen apps: a wiki here, a spreadsheet for drop rates there, a
whiteboard app, a writing app, a map tool. Evelopment Games Designer keeps everything in one project, so an item you
create in the Item List can be linked from the Wiki, dropped by an enemy, and counted by the Resource Calculator.

## Features

| | |
|---|---|
| <img src="docs/images/story.jpg" alt="Story Branch Writer"> | <img src="docs/images/timeline.jpg" alt="Timeline with a branch"> |
| **Story Branch Writer**: branching stories as a mind map | **Timeline**: history with alternative branches |
| <img src="docs/images/brainstorm.jpg" alt="Brainstorm Board"> | <img src="docs/images/launcher.jpg" alt="Project launcher"> |
| **Brainstorm Board**: notes, pins, string and areas | **Launcher**: all your game projects at a glance |
| <img src="docs/images/tour.jpg" alt="First-launch tour"> | <img src="docs/images/guide.jpg" alt="In-app user guide"> |
| **Guided tour** on first launch | **User guide** for every tool, built in (F1) |

### Workspace
- **Project launcher**: all your games at a glance, with word and image counts.
- **Tiling editor**: open several tools side by side, drag a tool from the sidebar to split the screen, and resize the splits.
- **Layout Mode**: press `Esc` to close or rearrange tools with big, easy targets.
- **Auto-save** about a second after every edit, **undo/redo** in every tool, and **rolling backups** of the last 10 saves.
- **Light and dark themes** (dark by default), plus a **Project look** per project: accent, background and wallpaper.
- **Guided tour** on first launch and a built-in **user guide** for every tool (press `F1` or click Help).

### The tools

| Tool | What it does |
|---|---|
| **Item List** | Every item in your game, with images, rarity, value, stats and your own custom categories. Shows which enemies drop each item. |
| **Character List** | Characters with portraits, family, nation, clan, race and links to other characters. |
| **Town List** | Towns with nation, race, religion and links. Cities placed on a map are towns. |
| **Enemy List** | Enemies with combat stats, growth per level, resistances, drop tables and where they are found. |
| **Wiki** | Articles with `[[links]]`, articles made from any item, character, town or enemy (with a live info box), backlinks and a connection map. |
| **Writer** | Rich text documents for design docs, scripts and dialogue, with live word count and Markdown/text export. |
| **Story Branch Writer** | Mind-map style branching stories: create, branch, connect and sever nodes. |
| **Timeline** | Timelines with optional years, events with images, and branches for alternative histories (press `B`). |
| **Moodboard** | Images, cutouts (shapes or freehand lasso), text, shapes and a layers panel, with an always-on-top layer for drawings. |
| **Brainstorm Board** | Drawing, sticky notes, shapes, images, audio clips and voice recording, pins with string, and named colored areas. |
| **Map Creator** | Cities, streets and terrain stamps on a blank map, with PNG export. Cities are linked to the Town List. |
| **Damage Calculator** | A library of game damage formulas (elemental reactions, armor, crits, damage over time, resistances), plus your own formulas. |
| **Level Calculator** | XP curves, stat growth, and damage per level against a fixed defense or an enemy from your Enemy List. |
| **Resource Calculator** | How many resources and how much play time a goal takes, using level-up costs and enemy drop rates. |

### Everything is connected
- Custom categories (like *Element* or *Faction*) are created once and used on items, characters, towns and enemies.
- `[[links]]` in the Wiki, Writer, Story and Timeline point at articles and entities, and follow renames.
- Before you delete something, the app shows every place it is used.

### Your data stays yours
Each project is a normal folder of JSON files plus an `assets/` folder, saved in
`Documents/Evelopment Games Designer/`. Easy to back up and readable, it works fully offline, and the app sends no telemetry.

## Install

**Easiest:** download the installer for your system from the
[Releases page](https://github.com/Evelynnsrepos/Evelopment-Games-Designer/releases/latest):

| System | File |
|---|---|
| Windows | `*_x64-setup.exe` |
| macOS (Apple Silicon and Intel) | `*_universal.dmg` (read [Mac](#mac) below first) |
| Linux | `*.AppImage` (any distro) or `*.deb` |

Or build it from source as described below. It takes a few minutes the first time.

### 1. Install the prerequisites

**Windows 10/11**
1. [Node.js](https://nodejs.org) 20 or newer (the LTS installer is fine).
2. [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/). In the installer, tick **Desktop development with C++**.
3. [Rust](https://rustup.rs): run the installer and keep the defaults. Or in a terminal: `winget install Rustlang.Rustup`
4. WebView2 is already part of Windows 10 and 11.

**macOS 10.13 or newer** (Apple Silicon or Intel)
1. Xcode Command Line Tools: in Terminal run `xcode-select --install`.
2. [Rust](https://rustup.rs): `curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh`
3. [Node.js](https://nodejs.org) 20 or newer.

**Linux (Debian/Ubuntu)**

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
```

Then install [Node.js](https://nodejs.org) 20 or newer.

**Arch Linux**

The easy way: clone the code (step 2) and let `makepkg` build and install it as a normal package.
It pulls in everything it needs, and you get a menu entry and `pacman -R evelopment-games-designer` to uninstall.

```bash
sudo pacman -S --needed git base-devel
git clone https://github.com/Evelynnsrepos/evelopment-games-designer.git
cd evelopment-games-designer/packaging/arch
makepkg -si
```

To work on the code instead, install the prerequisites and follow steps 2 and 3:

```bash
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl appmenu-gtk-module libappindicator-gtk3 librsvg xdotool rustup nodejs npm
rustup default stable
```

For other distributions, see the
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/#linux).

### 2. Get the code

```bash
git clone https://github.com/Evelynnsrepos/evelopment-games-designer.git
cd evelopment-games-designer
npm install
```

(Or use **Code → Download ZIP** on GitHub, unzip it, and run `npm install` inside the folder.)

### 3. Run or build it

Run the app directly:

```bash
npm run tauri dev
```

Or build an installer for your system:

```bash
npm run tauri build
```

The installers end up in `src-tauri/target/release/bundle/`:

| System | Files |
|---|---|
| Windows | `msi/*.msi` and `nsis/*-setup.exe` |
| macOS | `dmg/*.dmg` and `macos/*.app` |
| Linux | `appimage/*.AppImage` (runs on any distro) and `deb/*.deb` |

### Mac

Download the `.dmg` from the [Releases page](https://github.com/Evelynnsrepos/Evelopment-Games-Designer/releases/latest).
It runs on both Apple Silicon and Intel Macs.

Open the `.dmg` and drag the app into **Applications**. The app is not signed with a paid Apple developer
certificate, so the first time macOS will refuse to open it:

1. Open the app once. macOS says it can't be opened. Click **Done** (or **Cancel**).
2. Go to **System Settings → Privacy & Security**, scroll down and click **Open Anyway** next to
   *Evelopment Games Designer*, then confirm.

If macOS instead says the app "is damaged and can't be opened", that's the download quarantine flag. Clear it in Terminal:

```bash
xattr -dr com.apple.quarantine "/Applications/Evelopment Games Designer.app"
```

After that it opens normally. Apps you build yourself with `npm run tauri build` skip all of this.

### Just want to look around?

`npm install` then `npm run dev` opens the app in your web browser at http://localhost:5173 without Rust.
In the browser, projects are kept in browser storage instead of real folders, so use the desktop app for real work.

## For developers

```bash
npm test             # unit tests
npm run typecheck    # TypeScript
npm run lint         # oxlint
```

Built with [Tauri 2](https://tauri.app), React, TypeScript, [Konva](https://konvajs.org) and [TipTap](https://tiptap.dev).
The product spec is in [`docs/SPEC.md`](docs/SPEC.md), and [`AGENTS.md`](AGENTS.md) explains how the code is organised.

Found a bug or have an idea? Please [open an issue](../../issues). Because of the license below, code changes
can only come from the author.

## License

[PolyForm Strict 1.0.0](LICENSE) © 2026 Evelynn.

You may download, read, build and use this software for free for noncommercial purposes. You may **not**
share copies (modified or not) or make changes to it. The project is source-available, not open source.
