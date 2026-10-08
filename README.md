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

<p align="center">
  <img src="docs/screenshot.png" alt="Pharaoh's Chess mid-game: a White Soldier on the Pyramid square e4 is selected, showing its blessed sideways and backward steps" width="820"/>
</p>

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

<p align="center">
  <img src="docs/demo.gif" alt="Captures raise sand dust, a blessed Soldier on the Pyramid shows its extra steps, and White resurrects a Sphinx with the Ankh" width="440"/>
</p>

### Sphinx Movement
The Sphinx combines a standard knight's L-jump with short diagonal slides: it can move to any of the 8 knight squares **or** slide 1–2 squares diagonally (blocked by intervening pieces). It cannot jump over pieces during diagonal slides.

### ☥ Ankh Resurrection
Once per game, on your turn, you may spend your move to resurrect the most recently captured piece of your own that is not your Pharaoh, placing it on any empty square on your home two ranks (rows 7–8 for White, rows 1–2 for Black). The placement is illegal if it leaves your Pharaoh in check.

### Blessing of the Pyramid
The four central squares — **d4, d5, e4, e5** — form the sacred Pyramid Zone. A piece standing on one may, in addition to its normal moves, move or capture **one square in any direction**, like the Pharaoh. A blessed Priest can step sideways, a blessed Chariot diagonally, and a blessed Soldier even backward. Their golden glow intensifies when occupied, making them the focal point of the middle game.

### Other rule changes
- **No castling** — the Chariot stands alone
- **En passant** retained as-is
- **Promotion** choices: Vizier, Chariot, Priest, or Sphinx
- **Mate and stalemate** count an unused Ankh: if a resurrection could block or escape, the game goes on
- **Draws** by threefold repetition, the fifty-move rule (a resurrection resets it, like a capture or Soldier move), or insufficient material (lone Pharaohs or a single Priest, with no Ankh left)
- **Promoted pieces** that are captured are lost — and resurrected — as Soldiers

---

## Features

- **Custom SVG pieces** — hand-crafted Egyptian silhouettes, styled via CSS `currentColor`
- **Hi-fi visual design** — carved sandstone board, hieroglyph frieze, ambient wall texture, vignette
- **Piece motion** — pieces glide to their squares (yours and the computer's); resurrected pieces grow out of the ground; instant when your system asks for reduced motion
- **Particle effects** — 12-particle sand-dust burst as a capturing piece lands; cinematic 10-ray ankh burst on resurrection
- **WebAudio sounds** — procedural oscillator tones for select, move, capture, check, ankh, and victory; no audio files
- **Move log** — long algebraic notation with unique Egyptian symbols (Ph Pharaoh, V Vizier, C Chariot, Pr Priest, S Sphinx; Soldiers unmarked), plus `+` check, `#` mate, `=V` promotion, `☥` resurrection
- **Computer opponent** — Easy, Medium, Hard, or Expert; play either side. Expert remembers positions it has already analysed and tries the moves that refuted others first, so it looks a move deeper, and thinks up to 4 seconds. It understands the Ankh (and will resurrect to escape mate) and steers away from repetition draws when ahead. On the live site the search runs in a background thread so the page never stalls
- **Installable & offline** — install it from the live site (⬇ Install App in Chrome/Edge/Android, or Share → Add to Home Screen on iPhone) and it plays with no connection, computer opponent included
- **Play a friend by link** — 🔗 Share Game copies a link to the current position; your friend opens it, moves, and shares a link back. No server, no account; every move in a link is checked for legality
- **Move review** — click any move in the Sacred Scroll (or use ⏮ ◀ ▶ ⏭, ← → Home End) to see the board as it was; Esc returns to the game
- **Autosave** — the game in progress survives a refresh or closed tab (saved in your browser as its move list and replayed on load)
- **Take back, flip, mute** — unlimited undo (Ctrl+Z), board flip for Black's view, sound toggle that remembers your choice
- **Keyboard & screen reader friendly** — arrow keys move around the board, Enter selects; squares, captures, and status are announced
- **Responsive** — collapses to single column below 1060 px; smaller squares below 600 px
- **Zero dependencies** — vanilla HTML/CSS/JS, no build step; opening `index.html` from disk plays the full game (offline install and the computer's background thread need it served over http — see below)

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

Opened from disk, everything plays, but browsers don't allow background threads or offline caching for `file://` pages: the computer thinks on the page itself (Expert is held to Hard's 1.6 s so the page doesn't freeze) and the app can't be installed. To get the live-site behaviour locally, serve the folder:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

### Running the tests

**Rules tests** use Node's built-in runner (Node 18+, no install step):

```bash
node --test
```

**Browser tests** play the real page in Chrome and Firefox with [Playwright](https://playwright.dev) — every button, dialog, the computer opponent, autosave, review, and share links. They're a development-only dependency; the game itself still has none:

```bash
npm install
npx playwright install chromium firefox   # first time only
npm run test:e2e
```

Both suites run on GitHub for every push and pull request.

---

## Project Structure

```
EgyptianChess/
├── index.html          # Shell, layout, dialogs
├── manifest.webmanifest # Install metadata (name, icons, colours)
├── sw.js               # Service worker: offline support (network first, cache fallback)
├── icons/              # App icons (SVG source + PNG sizes, maskable)
├── css/
│   └── style.css       # Design tokens, animations, responsive layout
├── js/
│   ├── engine.js       # Pure game logic (window.PharaohEngine)
│   ├── pieces-svg.js   # Egyptian SVG silhouettes (window.PIECE_SVGS)
│   ├── game.js         # GameState class — move execution, Ankh logic, draws, undo
│   ├── ai.js           # Computer opponent — alpha-beta search (window.PharaohAI)
│   ├── ai-worker.js    # Runs the search off the main thread when served over http(s)
│   └── ui.js           # Rendering, WebAudio, particle FX, event handling
├── tests/
│   ├── rules.test.js   # node --test suite for engine, GameState, and the computer
│   └── e2e/            # Playwright browser tests (Chrome + Firefox) + tiny static server
├── package.json        # Dev-only: Playwright for the browser tests (the game needs nothing)
├── playwright.config.js
├── .github/            # CI workflow (rules + browser tests), issue and PR templates
└── docs/
    ├── banner.svg      # README banner
    ├── screenshot.png  # README screenshot
    └── demo.gif        # README gameplay clip
```

---

## Browser Support

Requires a modern browser with ES2020 JavaScript, the Web Animations API, and WebAudio. Installing and offline play also need service workers.

| Chrome / Edge | Firefox | Safari |
|---------------|---------|--------|
| ✓ tested on every change | ✓ tested on every change | not tested yet — should work in a current version |

---

## Contributing

Bug reports and feature ideas are welcome — see the [issue templates](.github/ISSUE_TEMPLATE/) to get started. For code changes, run the tests above and check the [PR template](.github/pull_request_template.md) before opening a pull request; both test suites also run automatically on every pull request.

---

## License

[MIT](LICENSE) — free to use, modify, and distribute.
