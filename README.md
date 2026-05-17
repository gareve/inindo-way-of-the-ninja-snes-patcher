# Inindo: Way of the Ninja — De-grinder Patch (SNES, US)

A browser-based ROM/IPS patcher that retunes the per-level EXP requirement
curve in **Inindo: Way of the Ninja** (SNES, US, 1994). Drag a slider
between EASY (every level needs 1 EXP) and GRINDY (the original, untouched
curve), then download either a patched `.sfc` ROM or an `.ips` patch file.

## Live site

**https://gareve.github.io/inindo-way-of-the-ninja-snes-patcher/**

Everything runs in your browser — no ROM is uploaded or stored anywhere.
You supply your own legally-obtained copy of the game.

## How it works

The patch overwrites two per-level EXP tables baked into the SNES ROM:

- **Table 1** at `0x01539E` — used by the **ninja** class (the protagonist
  and other ninja party members).
- **Table 2** at `0x015402` — used by the **monk (僧)** and
  **onmyoji (陰陽師)** classes.

Each table is 50 × 16-bit little-endian words. The slider linearly
interpolates each entry between `1` and the original value, rounded up
(so even the easiest setting never produces a zero EXP requirement).

The `.sfc` download additionally recomputes the SNES internal header
checksum at `0x7FDC..0x7FDF` to keep ROM tools happy.

## Why no level-cap patch?

The SNES port of Inindo natively caps level at 99 and bounds character
attributes at 255, so there's nothing else to touch. See
[DEBUGGING_NOTES.md](DEBUGGING_NOTES.md) for the full investigation,
including the live trace that confirmed the cap and the byte-diff
against the original ROM.

## Files

- `index.html`, `styles.css`, `app.js` — the patcher UI and logic.
- [`DEBUGGING_NOTES.md`](DEBUGGING_NOTES.md) — long-form
  reverse-engineering notes (where the offsets came from, what was tried,
  what was ruled out).
</content>
</invoke>