<div align="center">

<img src="docs/banner.svg" alt="Egyptian Chess — Pharaoh's Game" width="900"/>

[![Live Demo](https://img.shields.io/badge/Play%20Now-GitHub%20Pages-f5d574?style=for-the-badge&logo=github&logoColor=0a0603&labelColor=6e4a22)](https://highviewone.github.io/EgyptianChess/)
[![License: MIT](https://img.shields.io/badge/License-MIT-d9b878?style=for-the-badge&labelColor=6e4a22)](LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/HighviewOne/EgyptianChess?style=for-the-badge&color=2a4ea8&labelColor=1a0f04)](https://github.com/HighviewOne/EgyptianChess/commits/main)
[![No Dependencies](https://img.shields.io/badge/Dependencies-None-c14a2e?style=for-the-badge&labelColor=1a0f04)](index.html)

*A browser-based chess variant set in ancient Egypt — same board, new rules, new pieces.*

</div>

---

## Overview

Egyptian Chess replaces standard chess pieces with their ancient Egyptian equivalents and introduces three new mechanics that fundamentally change how the game is played. No installation, no framework, no build step — open `index.html` and play.

| Standard piece | Egyptian name | Special power |
|---|---|---|
| King | **Pharaoh** | — |
| Queen | **Vizier** | — |
| Rook | **Chariot** | — |
| Bishop | **Priest (Anubis)** | — |
| Knight | **Sphinx** | Extended movement ↓ |
| Pawn | **Soldier** | — |

---

## Egyptian Rules

### Sphinx Movement
The Sphinx combines a standard knight's L-jump with short diagonal slides: it can move to any of the 8 knight squares **or** slide 1–2 squares diagonally (blocked by intervening pieces). It cannot jump over pieces during diagonal slides.

### ☥ Ankh Resurrection
Once per game, on your turn, you may spend your move to resurrect the most recently captured piece of your own that is not your Pharaoh, placing it on any empty square on your home two ranks (rows 7–8 for White, rows 1–2 for Black). The placement is illegal if it leaves your Pharaoh in check.

### Pyramid Squares
The four central squares — **d4, d5, e4, e5** — form the sacred Pyramid Zone. They are visual only (no movement restriction), but their golden glow intensifies when occupied, making them a natural focal point of the middle game.

### Other rule changes
- **No castling** — the Chariot stands alone
- **En passant** retained as-is
- **Promotion** choices: Vizier, Chariot, Priest, or Sphinx

---

## Features

- **Custom SVG pieces** — hand-crafted Egyptian silhouettes, styled via CSS `currentColor`
- **Hi-fi visual design** — carved sandstone board, hieroglyph frieze, ambient wall texture, vignette
- **Particle effects** — 12-particle sand-dust burst on capture; cinematic 10-ray ankh burst on resurrection
- **WebAudio sounds** — procedural oscillator tones for select, move, capture, check, ankh, and victory; no audio files
- **Move log** — full algebraic-style notation with Egyptian piece initials
- **Responsive** — collapses to single column below 1060 px; smaller squares below 600 px
- **Zero dependencies** — vanilla HTML/CSS/JS, runs from the filesystem with no server

---

## Getting Started

```bash
git clone https://github.com/HighviewOne/EgyptianChess.git
cd EgyptianChess
open index.html        # macOS
xdg-open index.html   # Linux
# or just drag index.html into any modern browser
```

Or play instantly: **[highviewone.github.io/EgyptianChess](https://highviewone.github.io/EgyptianChess/)**

---

## Project Structure

```
EgyptianChess/
├── index.html          # Shell, layout, dialogs
├── css/
│   └── style.css       # Design tokens, animations, responsive layout
├── js/
│   ├── engine.js       # Pure game logic (window.PharaohEngine)
│   ├── pieces-svg.js   # Egyptian SVG silhouettes (window.PIECE_SVGS)
│   ├── game.js         # GameState class — move execution, Ankh logic
│   └── ui.js           # Rendering, WebAudio, particle FX, event handling
└── docs/
    └── banner.svg      # README banner
```

---

## Browser Support

Requires a modern browser with ES6 classes, Web Animations API, and WebAudio API.

| Chrome | Firefox | Safari | Edge |
|--------|---------|--------|------|
| 90+ ✓ | 90+ ✓ | 15+ ✓ | 90+ ✓ |

---

## Contributing

Bug reports and feature ideas are welcome — see the [issue templates](.github/ISSUE_TEMPLATE/) to get started. For code changes, please check the [PR template](.github/pull_request_template.md) testing checklist before opening a pull request.

---

## License

[MIT](LICENSE) — free to use, modify, and distribute.
