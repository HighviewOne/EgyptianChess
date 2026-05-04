// Custom Egyptian SVG piece silhouettes.
// Each piece returns an inline SVG string. Sized to a 100×100 viewBox.
// Color is set via currentColor by the caller (.piece.white / .piece.black).

const PHARAOH_SVG = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <!-- Nemes headdress + face silhouette -->
  <path fill="currentColor" d="
    M50 10
    C 36 10, 26 20, 24 36
    L 22 50
    C 18 54, 16 62, 18 70
    L 26 76
    L 28 84
    L 36 90
    L 50 88
    L 64 90
    L 72 84
    L 74 76
    L 82 70
    C 84 62, 82 54, 78 50
    L 76 36
    C 74 20, 64 10, 50 10 Z"/>
  <!-- Nemes stripes -->
  <path stroke="rgba(0,0,0,0.35)" stroke-width="1.2" fill="none" d="
    M 28 38 L 28 62
    M 34 32 L 34 66
    M 66 32 L 66 66
    M 72 38 L 72 62"/>
  <!-- Uraeus / cobra forehead -->
  <path fill="rgba(0,0,0,0.55)" d="
    M 50 18 C 47 22, 47 26, 50 30 C 53 26, 53 22, 50 18 Z"/>
  <circle cx="50" cy="22" r="1.6" fill="rgba(0,0,0,0.6)"/>
  <!-- Pharaoh beard -->
  <path fill="currentColor" d="M 46 84 L 50 96 L 54 84 Z" opacity="0.85"/>
  <!-- Eyes hint -->
  <ellipse cx="42" cy="50" rx="3" ry="1.4" fill="rgba(0,0,0,0.55)"/>
  <ellipse cx="58" cy="50" rx="3" ry="1.4" fill="rgba(0,0,0,0.55)"/>
</svg>`;

const VIZIER_SVG = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <!-- Isis / Hathor crown silhouette: horns + sun disk + face -->
  <!-- Horns -->
  <path fill="currentColor" d="
    M 30 28
    C 22 22, 18 14, 22 8
    C 26 14, 32 18, 36 22 Z"/>
  <path fill="currentColor" d="
    M 70 28
    C 78 22, 82 14, 78 8
    C 74 14, 68 18, 64 22 Z"/>
  <!-- Sun disk -->
  <circle cx="50" cy="20" r="9" fill="currentColor"/>
  <circle cx="50" cy="20" r="5" fill="rgba(0,0,0,0.25)"/>
  <!-- Headdress / hair -->
  <path fill="currentColor" d="
    M 50 28
    C 34 28, 26 38, 26 52
    L 24 70
    L 30 78
    L 34 86
    L 50 88
    L 66 86
    L 70 78
    L 76 70
    L 74 52
    C 74 38, 66 28, 50 28 Z"/>
  <!-- Hair stripes -->
  <path stroke="rgba(0,0,0,0.3)" stroke-width="1" fill="none" d="
    M 30 50 L 28 78
    M 36 46 L 34 84
    M 64 46 L 66 84
    M 70 50 L 72 78"/>
  <!-- Eye of horus stripe -->
  <path fill="rgba(0,0,0,0.5)" d="M 38 56 Q 50 50 62 56 L 60 60 Q 50 56 40 60 Z"/>
  <ellipse cx="44" cy="58" rx="1.6" ry="1" fill="rgba(0,0,0,0.7)"/>
  <ellipse cx="56" cy="58" rx="1.6" ry="1" fill="rgba(0,0,0,0.7)"/>
</svg>`;

const CHARIOT_SVG = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <!-- War chariot wheel + cab silhouette -->
  <!-- Cab body -->
  <path fill="currentColor" d="
    M 18 42
    L 64 42
    L 70 56
    L 64 64
    L 24 64
    L 18 56 Z"/>
  <!-- Cab front curl -->
  <path fill="currentColor" d="M 64 42 C 72 38, 78 38, 80 44 L 78 50 L 70 50 Z"/>
  <!-- Pole -->
  <rect x="64" y="56" width="20" height="3" fill="currentColor"/>
  <!-- Wheel -->
  <circle cx="36" cy="74" r="18" fill="none" stroke="currentColor" stroke-width="4"/>
  <circle cx="36" cy="74" r="4" fill="currentColor"/>
  <!-- Spokes (6) -->
  <g stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
    <line x1="36" y1="74" x2="36" y2="58"/>
    <line x1="36" y1="74" x2="36" y2="90"/>
    <line x1="36" y1="74" x2="22" y2="66"/>
    <line x1="36" y1="74" x2="50" y2="66"/>
    <line x1="36" y1="74" x2="22" y2="82"/>
    <line x1="36" y1="74" x2="50" y2="82"/>
  </g>
  <!-- Decorative panel on cab -->
  <path stroke="rgba(0,0,0,0.45)" stroke-width="1.2" fill="none" d="
    M 28 48 L 56 48
    M 28 54 L 56 54
    M 28 60 L 56 60"/>
  <!-- Standard / banner above cab -->
  <path fill="currentColor" d="M 38 24 L 42 24 L 42 42 L 38 42 Z"/>
  <path fill="currentColor" d="M 42 26 L 56 30 L 42 34 Z"/>
</svg>`;

const PRIEST_SVG = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <!-- Anubis jackal-head priest -->
  <!-- Ears -->
  <path fill="currentColor" d="M 32 8 L 26 32 L 38 24 Z"/>
  <path fill="currentColor" d="M 68 8 L 74 32 L 62 24 Z"/>
  <!-- Long jackal snout + head -->
  <path fill="currentColor" d="
    M 30 22
    C 30 18, 38 14, 50 14
    C 62 14, 70 18, 70 22
    L 74 38
    L 76 52
    L 72 60
    L 64 64
    L 64 78
    L 36 78
    L 36 64
    L 28 60
    L 24 52
    L 26 38 Z"/>
  <!-- Snout extension -->
  <path fill="currentColor" d="
    M 36 60
    L 34 76
    L 38 82
    L 50 84
    L 62 82
    L 66 76
    L 64 60 Z"/>
  <!-- Robe collar (broad usekh collar) -->
  <path fill="currentColor" d="
    M 22 78
    Q 50 96, 78 78
    L 82 92
    L 18 92 Z"/>
  <path stroke="rgba(0,0,0,0.4)" stroke-width="1" fill="none" d="
    M 26 82 Q 50 92, 74 82
    M 30 86 Q 50 94, 70 86"/>
  <!-- Eye -->
  <ellipse cx="58" cy="34" rx="3" ry="2" fill="rgba(0,0,0,0.65)"/>
  <!-- Nostril -->
  <circle cx="48" cy="74" r="1.4" fill="rgba(0,0,0,0.55)"/>
</svg>`;

const SPHINX_SVG = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <!-- Sphinx: human-headed lion in profile -->
  <!-- Body / haunch -->
  <path fill="currentColor" d="
    M 8 76
    L 14 60
    C 22 56, 34 56, 44 58
    L 60 56
    L 72 50
    L 82 54
    L 88 64
    L 90 78
    L 86 84
    L 78 84
    L 76 78
    L 56 80
    L 36 82
    L 18 84
    L 10 84 Z"/>
  <!-- Front paws -->
  <rect x="20" y="78" width="6" height="14" fill="currentColor"/>
  <rect x="30" y="78" width="6" height="14" fill="currentColor"/>
  <!-- Back haunch -->
  <path fill="currentColor" d="M 78 76 L 84 92 L 90 92 L 88 76 Z"/>
  <!-- Nemes head (right-facing) -->
  <path fill="currentColor" d="
    M 72 28
    C 78 26, 86 30, 86 40
    L 88 50
    L 86 56
    L 78 60
    L 70 60
    L 64 56
    L 62 48
    L 64 36
    C 66 30, 70 28, 72 28 Z"/>
  <!-- Nemes stripes -->
  <path stroke="rgba(0,0,0,0.4)" stroke-width="1" fill="none" d="
    M 70 38 L 70 56
    M 76 34 L 76 58
    M 82 38 L 82 54"/>
  <!-- Face features -->
  <ellipse cx="68" cy="46" rx="2" ry="1.4" fill="rgba(0,0,0,0.6)"/>
  <path fill="rgba(0,0,0,0.5)" d="M 64 50 L 68 52 L 64 54 Z"/>
  <!-- Uraeus -->
  <path fill="rgba(0,0,0,0.55)" d="M 76 30 C 74 32, 74 36, 78 36 C 80 34, 80 30, 76 30 Z"/>
</svg>`;

const SOLDIER_SVG = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <!-- Egyptian soldier: head + shield + spear -->
  <!-- Spear shaft -->
  <rect x="74" y="14" width="3" height="74" fill="currentColor"/>
  <!-- Spearhead -->
  <path fill="currentColor" d="M 75.5 8 L 80 18 L 71 18 Z"/>
  <!-- Helmet/head -->
  <path fill="currentColor" d="
    M 50 22
    C 40 22, 32 30, 32 42
    L 30 54
    L 36 60
    L 40 70
    L 60 70
    L 64 60
    L 70 54
    L 68 42
    C 68 30, 60 22, 50 22 Z"/>
  <!-- Helmet stripe -->
  <path fill="rgba(0,0,0,0.4)" d="M 32 40 Q 50 36, 68 40 L 68 44 Q 50 40, 32 44 Z"/>
  <!-- Body / kilt -->
  <path fill="currentColor" d="
    M 38 68
    L 30 88
    L 70 88
    L 62 68 Z"/>
  <!-- Shield (oval/rectangular) -->
  <path fill="currentColor" d="
    M 18 50
    C 18 44, 22 40, 28 40
    L 32 40
    L 32 78
    L 28 80
    C 22 80, 18 76, 18 70 Z"/>
  <!-- Shield ankh emblem -->
  <g stroke="rgba(0,0,0,0.5)" stroke-width="1.5" fill="none">
    <circle cx="25" cy="54" r="3"/>
    <line x1="25" y1="57" x2="25" y2="68"/>
    <line x1="20" y1="62" x2="30" y2="62"/>
  </g>
  <!-- Eye -->
  <ellipse cx="46" cy="48" rx="2" ry="1.2" fill="rgba(0,0,0,0.55)"/>
  <ellipse cx="56" cy="48" rx="2" ry="1.2" fill="rgba(0,0,0,0.55)"/>
</svg>`;

window.PIECE_SVGS = {
  pharaoh: PHARAOH_SVG,
  vizier: VIZIER_SVG,
  chariot: CHARIOT_SVG,
  priest: PRIEST_SVG,
  sphinx: SPHINX_SVG,
  soldier: SOLDIER_SVG
};

// Unicode glyph fallback — lets the user toggle via Tweaks
window.PIECE_GLYPHS = {
  white: { pharaoh: '♔', vizier: '♕', chariot: '♖', priest: '♗', sphinx: '♘', soldier: '♙' },
  black: { pharaoh: '♚', vizier: '♛', chariot: '♜', priest: '♝', sphinx: '♞', soldier: '♟' }
};

// Hieroglyph cartouche style — short hieroglyphic-ish characters
window.PIECE_HIEROGLYPHS = {
  pharaoh: '𓋹', // ankh-ish, stand-in for royalty
  vizier:  '𓆗', // cobra
  chariot: '𓊽', // djed pillar
  priest:  '𓁢', // anubis-ish glyph
  sphinx:  '𓃬', // jackal/lion-ish
  soldier: '𓀎'  // standing figure
};
