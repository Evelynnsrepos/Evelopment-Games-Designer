# Evelopment Games Designer

A free, all-in-one desktop tool for designing games: story, lore wiki, characters, towns,
items, enemies, maps, timelines, mood and brainstorm boards, and balancing calculators, all in one project
and all aware of each other. Runs on Windows and Linux.

Status: early development. The app shell (projects, sidebar, tiling editor) works; the design tools are being built.
See [`docs/SPEC.md`](docs/SPEC.md) for the full plan and [`AGENTS.md`](AGENTS.md) for how the code is organised.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

This opens the UI in your browser at http://localhost:5173. In the browser, projects are stored in the browser's
local storage, which is fine for trying things out.

### Desktop app

The desktop app needs Rust and the Tauri prerequisites:

- **Windows:** Microsoft C++ Build Tools (Desktop development with C++), WebView2 (already on Windows 10/11), and Rust via [rustup](https://rustup.rs).
- **Linux:** see the [Tauri Linux prerequisites](https://v2.tauri.app/start/prerequisites/#linux) (webkit2gtk and friends), then Rust via rustup.

Then:

```bash
npm run tauri dev      # run the desktop app
npm run tauri build    # build installers (.msi/.exe on Windows, AppImage/.deb on Linux)
```

Projects are saved as normal folders in `Documents/Evelopment Games Designer/`.

## License

[PolyForm Strict 1.0.0](LICENSE). You may download, read and use the code for free for noncommercial purposes.
You may not share copies (modified or not) or make changes to it. This makes the project source-available, not open source.
