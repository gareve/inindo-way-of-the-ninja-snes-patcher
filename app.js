// ---------------------------------------------------------------------------
// Inindo trainer — slider-driven retuning of the per-level EXP requirement
// tables baked into PRG ROM at $01539E (main char) and $015402 (helpers).
//
// Reverse-engineered values are hardcoded below; see DEBUGGING_NOTES.md.
// ---------------------------------------------------------------------------

const TABLE1_OFFSET = 0x01539E; // ninja class (the protagonist's class)
const TABLE2_OFFSET = 0x015402; // monk (僧) / onmyoji (陰陽師) classes
const TABLE_LEN     = 50;       // each table has 50 16-bit LE entries

// ---------------------------------------------------------------------------
// Note on level / stat caps — no patch needed.
//
// Late in the investigation we restored the vanilla clamped-add routine at
// WRAM $7E:4BD8, set all party members to level 99, and triggered a kill.
// The orchestrator passed $16 = $0063 (= 99) to the primitive — meaning the
// SNES port of Inindo natively hard-caps level at 99. There is no reachable
// post-100 crash on SNES (the secky.org "post-100 crash" claim was for the
// PC-98 original; Koei evidently fixed the overflow during the port).
//
// Character attributes are also safe: Intel/Speed/Luck/Power and two
// unidentified bytes are all 8-bit single fields. The game's orchestrator
// passes $16 = $00FF as the caller's cap for five of them, so the field
// physically can't overflow past 255. HP/MP are recomputed from the level
// at every level-up event, so they hold once the level reaches its 99 cap.
//
// See DEBUGGING_NOTES.md § "Errata: the SNES version natively caps level at 99" for
// the empirical trace and the full investigation.
//
// This editor therefore only patches the per-level EXP requirement tables.
// ---------------------------------------------------------------------------

const TABLE1_ORIG = [
  18, 39, 54, 75, 108, 144, 180, 210, 270, 327,
  405, 495, 606, 741, 903, 1098, 1365, 1644, 2046, 2454,
  3072, 3681, 4146, 4614, 5184, 5760, 6480, 7200, 8040, 9000,
  10050, 11250, 12654, 14064, 15819, 17559, 19773, 21963, 23340, 24717,
  26259, 27792, 29541, 31305, 33231, 35187, 37383, 39582, 42291, 45000
];

const TABLE2_ORIG = [
  15, 33, 45, 60, 84, 102, 144, 177, 219, 276,
  324, 402, 501, 609, 732, 867, 996, 1326, 1749, 2214,
  2934, 3615, 4389, 4761, 5373, 5895, 6360, 7296, 8130, 9621,
  10320, 11532, 13233, 13896, 15744, 17592, 19752, 21927, 23616, 24564,
  26376, 27729, 29289, 31272, 33156, 35139, 37395, 39516, 42306, 45000
];

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const slider           = $("difficulty");
const sliderExplainer  = $("slider-explainer");
const tableEl          = $("table-combined");
const romFileInput     = $("rom-file");
const romStatus        = $("rom-status");
const downloadRomBtn   = $("download-rom");
const downloadIpsBtn   = $("download-ips");

let romBytes = null;       // headerless Uint8Array, or null

// ---------------------------------------------------------------------------
// Difficulty math
// ---------------------------------------------------------------------------

// t in [0, 1]: 0 = EASY (all 1s), 1 = GRINDY (original).
function difficultyT() { return Number(slider.value) / 100; }

// Linear interpolation 1 ↔ orig, rounded UP, never below 1.
function scale(orig, t) {
  return Math.max(1, Math.ceil(orig * t + 1 * (1 - t)));
}

function newTable(orig, t) {
  return orig.map(v => scale(v, t));
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function cellHtml(orig, neu) {
  const o = orig.toLocaleString();
  if (orig === neu) {
    return `<span class="val same">${o}</span>`;
  }
  const n = neu.toLocaleString();
  return `<span class="val orig">${o}</span><span class="arrow">&rarr;</span><span class="val new">${n}</span>`;
}

function renderCombined() {
  const t    = difficultyT();
  const new1 = newTable(TABLE1_ORIG, t);
  const new2 = newTable(TABLE2_ORIG, t);

  const last = TABLE1_ORIG.length - 1;
  const rows = TABLE1_ORIG.map((_, i) => {
    // Level column shows the level you're reaching. The level-50 entry is reused
    // by the level-up routine for every level past 50, all the way up to 100.
    const lvlLabel = (i === last)
      ? `<span class="lvl-num">51&ndash;100</span><span class="lvl-note">value reused for every level past 50</span>`
      : `<span class="lvl-num">${i + 2}</span>`;
    return `<tr>` +
      `<td class="lvl">${lvlLabel}</td>` +
      `<td>${cellHtml(TABLE1_ORIG[i], new1[i])}</td>` +
      `<td>${cellHtml(TABLE2_ORIG[i], new2[i])}</td>` +
    `</tr>`;
  }).join("");

  tableEl.innerHTML =
    `<thead><tr>` +
      `<th>to reach level</th>` +
      `<th>ninja</th>` +
      `<th>monk / onmyoji</th>` +
    `</tr></thead>` +
    `<tbody>${rows}</tbody>`;
}

function updateExplainer() {
  const t = difficultyT();
  if (t === 0) {
    sliderExplainer.textContent = "EASY — every level needs only 1 EXP.";
  } else if (t === 1) {
    sliderExplainer.textContent = "GRINDY — original, untouched curve. Patch is a no-op.";
  } else {
    sliderExplainer.textContent =
      `${Math.round(t * 100)}% of the original curve, rounded up. Each entry interpolates between 1 (left) and the original (right).`;
  }
}

function rerender() {
  updateExplainer();
  renderCombined();
  downloadRomBtn.disabled = !romBytes;
  downloadRomBtn.title = romBytes ? "" : "Upload a ROM file first";
}

slider.addEventListener("input", rerender);

// ---------------------------------------------------------------------------
// ROM upload
// ---------------------------------------------------------------------------

function showRomStatus(text, kind) {
  romStatus.textContent = text;
  romStatus.classList.remove("ok", "error");
  if (kind) romStatus.classList.add(kind);
}

function looksLikeInindo(buf) {
  // LoROM internal title at $7FC0..$7FD4 — should start with "ININDO".
  const expected = "ININDO";
  for (let i = 0; i < expected.length; i++) {
    if (buf[0x7FC0 + i] !== expected.charCodeAt(i)) return false;
  }
  return true;
}

romFileInput.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) {
    romBytes = null;
    showRomStatus("No ROM loaded.");
    rerender();
    return;
  }

  let buf = new Uint8Array(await file.arrayBuffer());

  // Strip 512-byte SMC copier header if present.
  if (buf.length % 1024 === 512) {
    buf = buf.slice(512);
  }

  if (buf.length !== 0x100000) {
    showRomStatus(
      `Loaded ${file.name} (${buf.length.toLocaleString()} bytes) — expected exactly 1 048 576 bytes for Inindo. ` +
      `Refusing to patch.`, "error");
    romBytes = null;
    rerender();
    return;
  }

  if (!looksLikeInindo(buf)) {
    showRomStatus(
      `Loaded ${file.name} but the internal header doesn’t say "ININDO". Refusing to patch.`, "error");
    romBytes = null;
    rerender();
    return;
  }

  romBytes = buf;
  showRomStatus(`Loaded ${file.name} — 1 MB, looks like Inindo. Ready to patch.`, "ok");
  rerender();
});

// ---------------------------------------------------------------------------
// Patched ROM build
// ---------------------------------------------------------------------------

function writeWord(arr, off, val) {
  arr[off]     = val & 0xFF;
  arr[off + 1] = (val >>> 8) & 0xFF;
}

// Recompute SNES LoROM internal checksum.
// Header at $7FC0; checksum at $7FDE-$7FDF, complement at $7FDC-$7FDD.
// Convention: during summation treat the complement bytes as 0xFF and the
// checksum bytes as 0x00 (i.e. their canonical "blank" values).
function recomputeChecksum(rom) {
  let sum = 0;
  for (let i = 0; i < rom.length; i++) {
    if      (i === 0x7FDC || i === 0x7FDD) sum += 0xFF;
    else if (i === 0x7FDE || i === 0x7FDF) sum += 0x00;
    else                                    sum += rom[i];
  }
  sum &= 0xFFFF;
  const compl = 0xFFFF ^ sum;
  rom[0x7FDC] = compl & 0xFF;
  rom[0x7FDD] = (compl >>> 8) & 0xFF;
  rom[0x7FDE] = sum & 0xFF;
  rom[0x7FDF] = (sum >>> 8) & 0xFF;
}

function buildPatchedRom() {
  if (!romBytes) throw new Error("no ROM loaded");
  const out = romBytes.slice();
  const t = difficultyT();
  const t1 = newTable(TABLE1_ORIG, t);
  const t2 = newTable(TABLE2_ORIG, t);
  for (let i = 0; i < TABLE_LEN; i++) {
    writeWord(out, TABLE1_OFFSET + i * 2, t1[i]);
    writeWord(out, TABLE2_OFFSET + i * 2, t2[i]);
  }
  recomputeChecksum(out);
  return out;
}

// ---------------------------------------------------------------------------
// IPS patch build
// ---------------------------------------------------------------------------
//
// IPS format:
//   "PATCH"  (5 bytes)
//   record   = 3-byte BE offset + 2-byte BE size + size bytes of data
//             (size == 0 means RLE: 2-byte BE length + 1 byte value, not used here)
//   "EOF"    (3 bytes)
//
// One record:
//   1. Threshold tables (200 bytes at $01539E) — the slider drives this.

function buildIps() {
  const t = difficultyT();
  const t1 = newTable(TABLE1_ORIG, t);
  const t2 = newTable(TABLE2_ORIG, t);

  const tableData = new Uint8Array(TABLE_LEN * 4);
  for (let i = 0; i < TABLE_LEN; i++) {
    writeWord(tableData, i * 2,                 t1[i]);
    writeWord(tableData, TABLE_LEN * 2 + i * 2, t2[i]);
  }

  const records = [
    { offset: TABLE1_OFFSET, data: tableData },
  ];

  const total = 5 + records.reduce((n, r) => n + 5 + r.data.length, 0) + 3;
  const out   = new Uint8Array(total);

  // "PATCH"
  out[0] = 0x50; out[1] = 0x41; out[2] = 0x54; out[3] = 0x43; out[4] = 0x48;

  let p = 5;
  for (const r of records) {
    out[p++] = (r.offset    >>> 16) & 0xFF;
    out[p++] = (r.offset    >>>  8) & 0xFF;
    out[p++] = (r.offset    >>>  0) & 0xFF;
    out[p++] = (r.data.length >>> 8) & 0xFF;
    out[p++] = (r.data.length >>> 0) & 0xFF;
    out.set(r.data, p);
    p += r.data.length;
  }

  // "EOF"
  out[p++] = 0x45; out[p++] = 0x4F; out[p++] = 0x46;

  return out;
}

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

function triggerDownload(name, bytes, mime) {
  const blob = new Blob([bytes], { type: mime || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function patchSuffix() {
  const t = difficultyT();
  if (t === 1) return "no-changes";
  const pct = Math.max(1, Math.round(t * 100));
  return `${pct}pct-of-vanilla`;
}

function outputFileName(ext) {
  return `inindo-way-of-the-ninja[US]-${patchSuffix()}.${ext}`;
}

downloadRomBtn.addEventListener("click", () => {
  triggerDownload(outputFileName("sfc"), buildPatchedRom());
});

downloadIpsBtn.addEventListener("click", () => {
  triggerDownload(outputFileName("ips"), buildIps());
});

// Kick off
rerender();
