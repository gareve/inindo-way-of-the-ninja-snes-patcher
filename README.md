# Inindo - Way of the Ninja (USA): per-level EXP-to-next thresholds

## Summary

Per-level "experience required to reach the next level" is stored as **two adjacent tables in PRG ROM**, not a formula. The table the game uses depends on the **character's class**, not on which party slot they occupy.

| Table | File offset | Footprint | Used by |
| ----- | ----------- | --------- | ------- |
| **Table 1** | `0x01539E .. 0x015401` | 100 bytes | **Ninja** class (the protagonist's class — verified at the level 2→3 transition and again at level 3→4 with a patched ROM) |
| **Table 2** | `0x015402 .. 0x015465` | 100 bytes | **Monk (僧)** and/or **onmyoji (陰陽師)** — the spell-casting / priestly classes |

Class-vs-table mapping per <https://secky.org/arcade/inindo/levelup.html>: the table on that page (which matches our Table 1 exactly) is annotated 「忍者のものです。僧や陰陽師などは異なります。ちなみに僧と陰陽師では異なります。なお、侍は未検証。」 — *"This is for the ninja class. Monks and onmyoji differ. By the way, monks and onmyoji differ from each other. Samurai is unverified."*

**Open question.** The page implies *at least three* distinct class curves (ninja, monk, onmyoji), and a possible fourth (samurai). Our exhaustive PRG ROM scan only found **two** 50-word strict-monotonic tables that end at 45000 — the two documented here. Possibilities: (a) a third table exists with a different shape (different cap, fewer entries, or a small data quirk that broke our strict-monotonic filter), (b) two of the classes share a table and the perceived difference comes from other factors (base stats, starting level, recruitment level), or (c) secky.org's observation conflates "leveling speed" with "EXP curve" (e.g. monks and onmyoji could share Table 2 but appear to level differently because of HP/MP differences). To settle this, instrument a `read` callback on PRG ROM `0x01539E..0x015465` and trigger a level-up for each class in turn — the captured access offset identifies the table.

- **Layout (both tables):** 50 consecutive 16-bit little-endian words.
- **Indexing:** word `i` (0-based) = EXP required to go from level `i+1` → level `i+2`.
- **Range:** level 1 → 2 through level 50 → 51, final word = 45000 = `0xAFC8` (both tables converge to the same cap).
- **Above level 50:** the table only stores 50 entries, but characters can keep leveling up to **level 100** (the practical cap before the game starts misbehaving). For levels 51 → 100, the game reuses the level-50 entry — i.e. each level past 50 also requires **45000 EXP** to reach the next level. This is a runtime clamp; the ROM table itself is not extended. Reference: <https://secky.org/arcade/inindo/levelup.html>.

## How `$7E:F0BE` is updated on level-up

`$7E:F0BE` is a 16-bit countdown ("EXP remaining until next level"), stored as `[F0BE = lo, F0BF = hi]`. On level-up the routine:

1. Looks up `thresholds[newLevel]` from the table at `0x01539E` (16-bit) and stores it at `$F0BE`.
2. Subtracts the *excess* EXP that overshot the previous threshold from `$F0BE`.

Captured live during a level 2 → 3 transition (protagonist, save state in battle):

| Step                                | Write to `$F0BE` |
| ----------------------------------- | ---------------- |
| Step 1 — store fresh threshold      | `0x0036` (54)    |
| Step 2 — subtract excess (6)        | `0x0030` (48)    |

Final value 48 is what the player sees in the menu.

## Verification

Three independent data points all line up with the table:

| Level transition | Expected from table | Observed `$F0BE` after level-up | Excess EXP |
| ---------------- | ------------------- | ------------------------------- | ---------- |
| 1 → 2 (game start, no kill) | 18  | 18 | n/a |
| 1 → 2 (kill awarded 10, F0BE was 1) | 39 (next-level seed) | 30 | 9 (= 39 − 30) |
| 2 → 3 (kill awarded 7, F0BE was 1)  | 54 (next-level seed) | 48 | 6 (= 54 − 48) |

A live ROM-patch test (single-word edit at file offset `0x0153A2`) further confirmed both the table location and the carryover formula `$F0BE = threshold[newLevel] − excess`.

External cross-check: <https://secky.org/arcade/inindo/levelup.html> independently documents the same per-level requirements.

## Full table 1 (ninja class)

```
L 1→ 2  off=01539E  word=0012  dec=   18
L 2→ 3  off=0153A0  word=0027  dec=   39
L 3→ 4  off=0153A2  word=0036  dec=   54
L 4→ 5  off=0153A4  word=004B  dec=   75
L 5→ 6  off=0153A6  word=006C  dec=  108
L 6→ 7  off=0153A8  word=0090  dec=  144
L 7→ 8  off=0153AA  word=00B4  dec=  180
L 8→ 9  off=0153AC  word=00D2  dec=  210
L 9→10  off=0153AE  word=010E  dec=  270
L10→11  off=0153B0  word=0147  dec=  327
L11→12  off=0153B2  word=0195  dec=  405
L12→13  off=0153B4  word=01EF  dec=  495
L13→14  off=0153B6  word=025E  dec=  606
L14→15  off=0153B8  word=02E5  dec=  741
L15→16  off=0153BA  word=0387  dec=  903
L16→17  off=0153BC  word=044A  dec= 1098
L17→18  off=0153BE  word=0555  dec= 1365
L18→19  off=0153C0  word=066C  dec= 1644
L19→20  off=0153C2  word=07FE  dec= 2046
L20→21  off=0153C4  word=0996  dec= 2454
L21→22  off=0153C6  word=0C00  dec= 3072
L22→23  off=0153C8  word=0E61  dec= 3681
L23→24  off=0153CA  word=1032  dec= 4146
L24→25  off=0153CC  word=1206  dec= 4614
L25→26  off=0153CE  word=1440  dec= 5184
L26→27  off=0153D0  word=1680  dec= 5760
L27→28  off=0153D2  word=1950  dec= 6480
L28→29  off=0153D4  word=1C20  dec= 7200
L29→30  off=0153D6  word=1F68  dec= 8040
L30→31  off=0153D8  word=2328  dec= 9000
L31→32  off=0153DA  word=2742  dec=10050
L32→33  off=0153DC  word=2BF2  dec=11250
L33→34  off=0153DE  word=316E  dec=12654
L34→35  off=0153E0  word=36F0  dec=14064
L35→36  off=0153E2  word=3DCB  dec=15819
L36→37  off=0153E4  word=4497  dec=17559
L37→38  off=0153E6  word=4D3D  dec=19773
L38→39  off=0153E8  word=55CB  dec=21963
L39→40  off=0153EA  word=5B2C  dec=23340
L40→41  off=0153EC  word=608D  dec=24717
L41→42  off=0153EE  word=6693  dec=26259
L42→43  off=0153F0  word=6C90  dec=27792
L43→44  off=0153F2  word=7365  dec=29541
L44→45  off=0153F4  word=7A49  dec=31305
L45→46  off=0153F6  word=81CF  dec=33231
L46→47  off=0153F8  word=8973  dec=35187
L47→48  off=0153FA  word=9207  dec=37383
L48→49  off=0153FC  word=9A9E  dec=39582
L49→50  off=0153FE  word=A533  dec=42291
L50→51  off=015400  word=AFC8  dec=45000
```

## Full table 2 (monk / onmyoji classes)

```
L 1→ 2  off=015402  word=000F  dec=   15
L 2→ 3  off=015404  word=0021  dec=   33
L 3→ 4  off=015406  word=002D  dec=   45
L 4→ 5  off=015408  word=003C  dec=   60
L 5→ 6  off=01540A  word=0054  dec=   84
L 6→ 7  off=01540C  word=0066  dec=  102
L 7→ 8  off=01540E  word=0090  dec=  144
L 8→ 9  off=015410  word=00B1  dec=  177
L 9→10  off=015412  word=00DB  dec=  219
L10→11  off=015414  word=0114  dec=  276
L11→12  off=015416  word=0144  dec=  324
L12→13  off=015418  word=0192  dec=  402
L13→14  off=01541A  word=01F5  dec=  501
L14→15  off=01541C  word=0261  dec=  609
L15→16  off=01541E  word=02DC  dec=  732
L16→17  off=015420  word=0363  dec=  867
L17→18  off=015422  word=03E4  dec=  996
L18→19  off=015424  word=052E  dec= 1326
L19→20  off=015426  word=06D5  dec= 1749
L20→21  off=015428  word=08A6  dec= 2214
L21→22  off=01542A  word=0B76  dec= 2934
L22→23  off=01542C  word=0E1F  dec= 3615
L23→24  off=01542E  word=1125  dec= 4389
L24→25  off=015430  word=1299  dec= 4761
L25→26  off=015432  word=14FD  dec= 5373
L26→27  off=015434  word=1707  dec= 5895
L27→28  off=015436  word=18D8  dec= 6360
L28→29  off=015438  word=1C80  dec= 7296
L29→30  off=01543A  word=1FC2  dec= 8130
L30→31  off=01543C  word=2595  dec= 9621
L31→32  off=01543E  word=2850  dec=10320
L32→33  off=015440  word=2D0C  dec=11532
L33→34  off=015442  word=33B1  dec=13233
L34→35  off=015444  word=3648  dec=13896
L35→36  off=015446  word=3D80  dec=15744
L36→37  off=015448  word=44B8  dec=17592
L37→38  off=01544A  word=4D28  dec=19752
L38→39  off=01544C  word=55A7  dec=21927
L39→40  off=01544E  word=5C40  dec=23616
L40→41  off=015450  word=5FF4  dec=24564
L41→42  off=015452  word=6708  dec=26376
L42→43  off=015454  word=6C51  dec=27729
L43→44  off=015456  word=7269  dec=29289
L44→45  off=015458  word=7A28  dec=31272
L45→46  off=01545A  word=8184  dec=33156
L46→47  off=01545C  word=8943  dec=35139
L47→48  off=01545E  word=9213  dec=37395
L48→49  off=015460  word=9A5C  dec=39516
L49→50  off=015462  word=A542  dec=42306
L50→51  off=015464  word=AFC8  dec=45000
```

Table 2 is **slightly easier** than Table 1 across the entire curve (e.g. L1→2 is 15 vs 18, L10→11 is 276 vs 327, L25→26 is 5373 vs 5184 — table 2 trails table 1 from L25 onward then catches up by L50). Both end at exactly 45000 EXP for the final level.

## Number of tables vs number of party slots

The party has **3 slots** (main player + 2 helpers), but only **2** threshold tables exist. The third slot must reuse one of them. Conclusion supported by:

1. **Exhaustive PRG ROM scan.** Searched all 1MB for any strictly-increasing run of 50 16-bit LE words with first value < 100 and last value > 1000. Exactly two candidates terminate at 45000 (= `0xAFC8`); both are the tables documented here. Other long monotonic runs in the ROM (around `0x012XXX`, `0x06XXX`, etc.) are unrelated data structures — they end at ~12500 or ~65000 and have lengths far larger than 50 words.
2. **Live WRAM hint.** With the protagonist at level 3 and `$F0BE = 48`, the byte at `$7E:F0DE` reads `0x000F` = 15 — exactly Table 2's L1→2 entry. This is consistent with a level-1 non-ninja party member using Table 2 (though it could not be definitively confirmed from a single battle save state).

**Open question:** do *both* helpers use Table 2, or does one use Table 1 and one use Table 2? To answer, instrument a `read` callback on PRG ROM `0x01539E..0x015465` (memType `snesPrgRom`) and trigger a level-up for each helper individually — the captured access offset will identify which table each helper indexes.

## Editing the tables

To change the EXP required to reach level `L+1` for a given table, write a new 16-bit little-endian value at:

- **Table 1:** `0x01539E + (L − 1) * 2`
- **Table 2:** `0x015402 + (L − 1) * 2`

Example: to halve the player's level-1-to-2 requirement to 9, write `09 00` at `0x01539E`.

The bytes immediately after Table 2 (`0x015466 .. 0x0154CA`) contain a non-monotonic structure interleaved with `01 00` sentinels — likely a different game data structure (item costs, magic properties, or similar). Don't treat it as a continuation of the threshold tables.

## Related WRAM addresses (per character, observed during the level-up event)

Verified from the wide-write log + diff vs baseline during the protagonist's L2→L3 transition:

| WRAM       | Meaning            | Width | Notes                          |
| ---------- | ------------------ | ----- | ------------------------------ |
| `$7E:F0A9` | Character name     | up to 6 ASCII bytes (player-chosen) | null-terminated |
| `$7E:F0B6` | HP current         | 16-bit LE | bumped 28 → 31 on level-up |
| `$7E:F0B8` | HP max             | 16-bit LE | bumped 28 → 31 on level-up |
| `$7E:F0BA` | MP current         | 16-bit LE | bumped 11 → 12 on level-up |
| `$7E:F0BC` | MP max             | 16-bit LE | bumped 11 → 12 on level-up |
| `$7E:F0BE` | EXP-to-next        | 16-bit LE | the countdown — this doc's subject |
| `$7E:F0C0` | Level              | **8-bit** | the cave does `SEP #$30 ; STA ($0E),Y` — single-byte store. Bumped 2 → 3 in the L2→L3 trace. |
| `$7E:F0C1` | Class / job ID(?)  | 8-bit     | preserved across level-up. Observed values: `$00` (protagonist, ninja), `$11` (party slot 2), `$22` (party slot 3). Almost certainly the class/job tag that selects Table 1 vs Table 2. |

The remaining bytes in `$F0C2..$F0CF` change on level-up too (stat bumps); not characterized here.

### Per-character block layout (3 party slots)

The 3 party members each have their own block of WRAM. Same offset structure within each block (`+0x16` HP cur, `+0x18` HP max, `+0x1A` MP cur, `+0x1C` MP max, `+0x1E` EXP-to-next, `+0x20` level, `+0x21` class ID). Bases:

| Slot | Base / EXP-to-next | Level field | Class-ID byte | Observed name in our save state |
| ---- | ------------------ | ----------- | ------------- | ------------------------------- |
| 1    | `$7E:F0BE`         | `$7E:F0C0`  | `$7E:F0C1` = `$00` | Gareve (protagonist) |
| 2    | `$7E:F65E`         | `$7E:F660`  | `$7E:F661` = `$11` | Tateoka |
| 3    | `$7E:F81E`         | `$7E:F820`  | `$7E:F821` = `$22` | Rei |

Slots 2 and 3 sit ~1.4 KB apart in WRAM — not adjacent, so a "stride of 32" assumption against slot 1 fails. The blocks were located by looking at known per-character EXP-to-next pointers in the user's saved notes.

## Reproducing the discovery

Tools used: `mesen-mcp` (this workspace's project at `../mesen-mcp/`) plus a save state in battle.

1. Load the save state in Mesen 2 with the bridge script running.
2. From Claude, install a `emu.callbackType.write` callback on `$7E:F0BE..$F0BF` (memType `snesWorkRam`) that records `(addr, value, frame, cpu.pc, cpu.k, cpu.a, cpu.x, cpu.y)` into a Lua global. Note: `emu.getState()` returns a *flat* table — keys are dotted strings like `"cpu.pc"`, not nested.
3. Deliver the killing blow manually.
4. Drain the log. The first write to `$F0BE` after the level-up is the raw threshold; combined with the known excess EXP it identifies the table value.
5. Search PRG ROM for the byte sequence formed by three consecutive observed thresholds (e.g. `12 00 27 00 36 00`). On Inindo there is exactly one match → the table base.

---

# Capping the level at 100 — fixing the post-100 crash

> ⚠️ **Errata — the premise of this section was wrong on SNES.** secky.org's "level 101 misbehaves" claim is for the **PC-98** original. The **SNES port** (which this repo targets) already natively caps level at **99** in its own level-up bytecode — Koei evidently fixed the overflow when they ported. Our cave doesn't *prevent a crash*; it actually **raises the cap from 99 → 100**, letting you reach one level the game never lets you reach. See [§ "Errata: the SNES version natively caps level at 99"](#errata-the-snes-version-natively-caps-level-at-99) at the bottom for the empirical evidence. The cave + stub mechanics, lessons learned, and table-editing tooling in this section are still accurate; only the *motivation* was wrong.

## The bug

The threshold table only stores 50 entries (level 1→2 through level 50→51). For levels 51 → 100 the game's level-up routine reuses the level-50 entry (45 000 EXP). At **level 101** the routine reads past the end of the table and the game misbehaves / crashes. The patch in this folder caps the protagonist's level at **100** so the bad code path is never reached.

## The patch

Two records, total **71** bytes of new code (was 61 in the original 1-address version):

| File offset       | Size     | Purpose                                                                 |
| ----------------- | -------- | ----------------------------------------------------------------------- |
| `0x003A00`        | **46 bytes** | **Cave** — guarded clamped-add with a **3-address discriminator** (matches any of the 3 party-slot level fields). CPU `$00:BA00` (LoROM bank 0). |
| `0x00ABD8`        | 25 bytes | **Stub** — replaces the original 25-byte routine with `JSL $00:BA00; PLP; RTL` + 19 `EA` NOPs. |

The stub lives in the WRAM-mirrored block (file `$008000..$00B27D` ↔ WRAM `$7E:2000..$7E:527D`), so at boot the patched bytes get DMA'd into WRAM at `$7E:4BD8` and the running game executes them.

The cave reproduces the original clamped-add but adds a 22-byte cascading-discriminator prefix:

```asm
; Cave at $00:BA00 (file $003A00) — 46 bytes
LDA $0E              ; load 16-bit pointer (m=0 on entry)
CMP #$F0C0           ; party slot 1 (protagonist) level?
BEQ doCap
CMP #$F660           ; party slot 2 level?
BEQ doCap
CMP #$F820           ; party slot 3 level?
BNE skipCap          ; not a level field → use caller's cap unchanged
doCap:
LDA #$0064           ; force cap to 100
STA $16
skipCap:

CLC                  ; ── original clamped-add follows ──
LDA ($0E),Y
AND #$00FF
ADC $12              ; sum = old + gain
CMP $16
BCC +2
LDA $16              ; clamp to cap
SEP #$30             ; back to 8-bit AXY
STA ($0E),Y          ; ← this store is what visibly sets the level (8-bit)
STA $0A
TYA
STA $0B
RTL                  ; returns to the stub's PLP+RTL
```

Net effect: any caller that bumps a stat at `$F0C0`, `$F660`, or `$F820` is forced through `min(old + gain, 100)`. All three party-slot level fields are clamped simultaneously. HP, MP, and other per-stat call sites have `$0E` pointing elsewhere, so the cap override is bypassed (the cascading BEQ/BNE block falls through to `skipCap`).

**Important consequence:** the cap is *only* on the level field — but in practice HP, MP, and the visible secondary stats end up held too. HP/MP are recomputed from the (capped) level by `$7E:4B8E` / `$00:A411`, so they automatically return the same value once the level is frozen. The 6 cave-driven secondary stats (Intel, Speed, Luck, Power, and two unidentified bytes) have a natural 255 ceiling in the game's own logic. See [§ "What gets capped, what doesn't"](#what-gets-capped-what-doesnt-observed) below for the full per-write-path breakdown.

## Why this site, not the EXP curve

We considered three patch points:

1. **Patch the EXP threshold table** so level 100 is unreachable (e.g. `0xFFFF` at the level-50 entry). Rejected — players can still grind past it given enough EXP, and it punishes legitimate level 51-100 progression.
2. **Patch the EXP-gain code** (option A: when level == 100, set incoming EXP to 0). Rejected — we never observed the EXP-decrement code path during a level-up, because Inindo's routine takes the level-up branch directly when a kill overshoots the threshold (no intermediate `$F0BE` write). Locating the gain math would have needed a separate save state with a kill that doesn't trigger level-up.
3. **Patch the level-write site** (option B, what we implemented). Every party member's level only ever changes through one routine, and we located it precisely on the first capture — confirmed by extending the discriminator to all 3 slots in a follow-up session.

## Lessons learned (Mesen-MCP investigation)

These generalize to any SNES/NES reverse-engineering task driven through the bridge:

### 1. WRAM-resident code is normal in Koei games

The level-up routine at `$7E:4BD8` is not a one-off — Koei's RPGs (Inindo, Romance of the Three Kingdoms, Nobunaga's Ambition, Genghis Khan) routinely DMA chunks of code from PRG ROM into WRAM at boot and execute from there. **The WRAM range `$7E:2000..$7E:527D` is a 12,926-byte code cache mirrored verbatim from file `$008000..$00B27D` (offset = `+$6000`).** Walk the byte-equality forwards and backwards from any one matching point to find the cache extent in one call.

A `cpu.pc` like `$7E:xxxx` always means "running from WRAM"; it never invalidates the patch — just patch the corresponding ROM file offset and the next boot will load the patched version into WRAM.

### 2. Memory-callback gotchas

Things that cost us iterations:

- **`emu.addMemoryCallback` rejects `snesWorkRam`** with "invalid cpu type". Use `snesMemory` (the CPU bus) and the full `$7E:xxxx` address instead.
- **Direct-page writes go through `$00:xxxx`, not `$7E:xxxx`.** Hooking `$7E:0016` to watch `STA $16` fires zero callbacks; hook `$00:0016`.
- **Mesen fires write callbacks twice per write** (once before, once after — the "before" pass has empty register snapshots in our recorder). Filter out entries where the captured DP scratch is `0` if you only want one row per write.
- **Memory callbacks accumulate across `execute_lua` calls.** Always tear down via `emu.removeMemoryCallback` before re-installing, or you'll get exponentially many fires.

### 3. Iterative instrumentation > brute-force search

We never found the cap-99 value by brute-force ROM scans (the bytecode VM doesn't store params as adjacent literals). The path that actually worked: write callback on the parameter-DP slot (`$0016`) → captured the source address (stack-resident bytecode params) → recognised the param block was pushed by a bytecode VM on the fly. At that point the value of chasing further dropped: the patch belongs at the routine itself, not at its caller.

### 4. PRG ROM is writable from Lua

`emu.write(file_offset, value, emu.memType.snesPrgRom)` modifies the in-memory ROM image and is visible to the running CPU on the next read from that bank. This makes live-testing IPS patches trivial:

1. Patch ROM via `emu.write` (persists across save-state reloads).
2. Also patch the live WRAM copy (overwritten by every save-state reload).
3. Reload the save state, re-apply the WRAM patch, trigger the in-game event.

Save the patch byte-arrays in `_G.PATCH_*` Lua globals so step 2 is one call.

### 5. Code-cave hunting

The WRAM-mirrored region is usually packed solid (no `00`/`FF` runs). But the rest of the ROM has plenty: scan for runs of `0xFF` outside `[$008000, $00B27D]` and you'll find dozens of 256-byte sectors of pure padding. We picked file `$003A00` (= CPU `$00:BA00`, LoROM bank 0) which gives us a `JSL`-reachable cave from the WRAM stub via a single 4-byte instruction.

### 6. Test with an absurd cap first

Before flipping the cap to its real value (100), we set it to **2** and verified the protagonist's level didn't budge from 2 after a level-up that would normally bump them to 3 — while HP, MP, and stats *did* update normally. That single test confirmed the discriminator (`$0E == $F0C0`) was correct and the in-place rewrite hadn't broken any sibling stat-bump callers. Then a one-byte change (`$02 → $64` at file `$003A08`) shipped the production cap.

The same pattern repeated when we extended the cap to all 3 party members: we shipped a **`$5A`-cap (level 90)** variant first, validated against a save state with both helpers already at 90, watched the cave fire on all 3 slots (`pc=$00:BA28`), then promoted to `$64` (100) with a single-byte change at cave offset `+$12`. The `level_cap_90.ips` archive (`level_cap_90.ips` in this folder) preserves the test variant — identical to `level_cap_100.ips` except for that one byte.

### 7. The clamped-add primitive handles level writes + 6 secondary stats

The cave is invoked for (a) the level write itself, and (b) six 8-bit secondary-stat writes per character (at `$F0C2..$F0CA` offsets `+1, +2, +3, +6, +7, +8` from the stat-block base — Intel, Speed, Luck, Power, and two unidentified bytes). HP_cur/MP_cur come from `$7E:4B8E`, and HP_max/MP_max + `exp_to_next` come from `$00:A411` — *neither* goes through the cave. Empirically all of HP/MP/visible-stats end up auto-held at cap (HP/MP via level-derivation, visible stats via the game's natural 255 ceiling). We built and then abandoned a stats-freeze extension of the cave — see [§ "What gets capped, what doesn't"](#what-gets-capped-what-doesnt-observed) and the appendix on `level_cap_100_stats_freeze_abandoned_due_to_bad_guess.ips`.

### 8. All 3 party members share the same level-write routine

The original 1-address discriminator implicitly assumed only the protagonist used the clamped-add. Empirically, **all 3 party slots** invoke it with `$0E` set to each slot's level field. Extending the discriminator to a cascading `BEQ/CMP` chain (3 addresses, +10 bytes of cave) caps the whole party simultaneously. Confirmed by tracing level writes during a kill that level'd all 3 members: each fired through `pc=$00:BA28` (the cave's `STA ($0E),Y` site) in sequence.

## What gets capped, what doesn't (observed)

Capping the level field stops the **level number** from climbing past 100, but the level-up *event* still fires on every threshold-crossing kill. What that event does to the rest of the character block was *not obvious* a priori — three different code paths are involved. Empirically (Mesen 2 write callbacks across each character's full HP..stats block, captured during kills at cap):

| field group | write site (PC) | behavior at cap |
| ----------- | --------------- | --------------- |
| Level (`$F0C0` / `$F660` / `$F820`) | `$00:BA28` (our cave) | Clamped to cap. ✓ |
| HP_cur (`+0x16`), MP_cur (`+0x1A`) | `$7E:4B8E` | Recomputed from level — at cap, returns the same value. ✓ |
| HP_max (`+0x18`), MP_max (`+0x1C`) | `$00:A411` | Same — recomputed from capped level, unchanged. ✓ |
| exp_to_next (`+0x1E`) | `$00:A411` | Resets to threshold − excess every level-up. Cosmetic. |
| 6 cave-driven stats at `$F0C2..$F0CA` (offsets +1, +2, +3, +6, +7, +8 from the stat-block base) — these are **Intel, Speed, Luck, Power, and two unidentified bytes** | `$00:BA28` (our cave, called 6× per character) | Each clamps to caller's `$16`. **For Intel/Speed/Luck/Power and the +6 mystery byte, the caller's `$16` is ≥255**, so once the stat reaches 255 it stays. **For the +7 mystery byte, `$16` is `$64` (100), so that byte clamps DOWN to 100 every level-up.** |

So at cap, with just the cap-only patch:

- Level holds at cap. ✓
- HP/MP hold (because they're recomputed from the now-frozen level → same value). ✓
- 5 of the 6 cave-driven stats hold once they reach 255 (the game caps them naturally). ✓
- 1 cave-driven stat (`+7`, unidentified — doesn't appear in the in-game stats menu) clamps to 100 each level-up.
- `exp_to_next` resets cosmetically.

**Earlier we suspected the stats were drifting in a bug-like way and built a stats-freeze cave to lock them.** Empirical testing showed those "drifts" were the game *correctly* normalising stats to their proper per-level values — not a bug. **`level_cap_100_stats_freeze_abandoned_due_to_bad_guess.ips` (formerly `level_cap_100_stats_freeze.ips`) is preserved in the folder for history but is not recommended.** Use `level_cap_100.ips`.

### Per-kill per-character timeline at cap

1. **Preview pass (1 frame).** `$00:A411` writes new max stats for all 3 members at once.
2. **Per-character bump sequence (~275 frames between characters).** For each character:
   1. Level write via cave — `$00:BA28`. Clamped to cap.
   2. HP_cur — `$7E:4B8E`. No-op at cap.
   3. HP_max — `$00:A411`. No-op at cap.
   4. MP_cur — `$7E:4B8E`. No-op at cap.
   5. MP_max — `$00:A411`. No-op at cap.
   6. exp_to_next reset — `$00:A411`, two writes: threshold (`$AFC8` = 45000), then `threshold − excess`.
   7. Six cave invocations for the secondary stats — each clamps to caller's per-level cap, which is ≥255 for 5 of them and 100 for the 6th (`+7`).

### Files

- `level_cap_100.ips` — **production cap, 3-address (caps the whole party)**. 46-byte cave + 25-byte stub, 89 bytes total.
- `level_cap_100_party.ips` — duplicate of the above kept around as a clearly-named copy.
- `level_cap_90.ips` — archive of the L90 validation variant (single-byte difference, cap=`$5A`).
- `level_cap_100_stats_freeze_abandoned_due_to_bad_guess.ips` — earlier stats-freeze attempt that turned out to be solving a non-problem. Not recommended. Documented in the next section for completeness.

## Appendix: the abandoned stats-freeze experiment

Goal at the time: stop the 6 cave-driven stat bytes from changing at cap. Approach: extend the cave from 46 → 107 bytes; when `$0E` is in a party member's stat block and that character is at cap, early-return without writing.

What we learned by actually running it (set the 6 cave-driven bytes to `$FF` and watched a level-up):

- 5 of 6 bytes held at `$FF` *with the unmodified cap-only cave* — the game's per-stat `$16` is ≥255 for these once they're "maxed". The freeze was redundant.
- The 6th byte (`+7`) does get pulled to 100, but it doesn't surface in the in-game stats menu, so locking it has no visible benefit either.
- Below 255, the apparent "drift" (e.g. Intel 189 → 188) was the game **normalising** the stat to its proper level-bound value, not a bug. Freezing actively prevents this normalisation, which is *not* what a player typically wants.

So the freeze cave was technically correct (it does freeze the bytes) but solved a problem that didn't exist. Preserved as `level_cap_100_stats_freeze_abandoned_due_to_bad_guess.ips`. Bytes:

```asm
; CPU $00:BA00 (file $003A00) — 107 bytes
; m=0, x=0 on entry. $0E = target pointer, $12 = gain, $16 = caller's cap.

  LDA $0E
  CMP #$F0C0           ; level field? → doCap
  BEQ doCap
  CMP #$F660
  BEQ doCap
  CMP #$F820
  BEQ doCap

  CMP #$F0B6           ; Gareve stat block?
  BCC nextGT
  CMP #$F0D0
  BCS nextGT
  LDA $F0C0
  BRA gotLvl
nextGT:
  CMP #$F656           ; Tateoka stat block?
  BCC nextTR
  CMP #$F670
  BCS nextTR
  LDA $F660
  BRA gotLvl
nextTR:
  CMP #$F816           ; Rei stat block?
  BCC body
  CMP #$F830
  BCS body
  LDA $F820

gotLvl:
  AND #$00FF
  CMP #$0064           ; cap?
  BCC body             ; level < cap → no freeze, normal body
  ; FREEZE — early-return: skip the STA, set caller's expected outputs.
  LDA ($0E),Y
  SEP #$30
  STA $0A
  TYA
  STA $0B
  RTL

doCap:
  LDA #$0064
  STA $16

body:
  ; original 24-byte clamped-add (unchanged from the 46-byte cave)
```

## Live-patch and IPS recipe

```lua
-- (one-time) write the cave + stub to PRG ROM
for i, b in ipairs(CAVE) do emu.write(0x003A00 + i - 1, b, emu.memType.snesPrgRom) end
for i, b in ipairs(STUB) do emu.write(0x00ABD8 + i - 1, b, emu.memType.snesPrgRom) end
-- (after every save-state reload) re-apply the WRAM stub
for i, b in ipairs(STUB) do emu.write(0x7E4BD8 + i - 1, b, emu.memType.snesMemory) end
```

The standalone IPS at `level_cap_100.ips` is two records — `(offset $003A00, 46 bytes, CAVE)` and `(offset $00ABD8, 25 bytes, STUB)` — totalling 89 bytes. Apply with any IPS tool (Floating IPS, Lunar IPS, `flips`). It caps all 3 party slots at level 100.

For an archive of the L90 variant we used during validation, see `level_cap_90.ips` in this folder — identical to `level_cap_100.ips` except for one byte at cave offset `+$12` (`$5A` instead of `$64`).

# Errata: the SNES version natively caps level at 99

After all of the work above, late in the investigation we set up a clean test: restore the vanilla 25-byte clamped-add primitive at WRAM `$7E:4BD8`, set all three party members to level 99 with `exp_to_next = 5`, and trigger a level-up. We expected to see level go 99 → 100 → 101 and (per secky.org) the game to misbehave at 101. Instead:

```
ENTRY pc=$7E:4BD8  $0E=$F0C0  $12=$0001  $16=$0063  ← caller passes cap = $63 (99)!
WRITE pc=$7E:4BEA  $7EF0C0 <- $63                   ← level stays at 99
```

The orchestrator passes **`$16 = $0063` (= 99)** when it calls the clamped-add for the level field. With current=99 and gain=1, `min(99 + 1, 99) = 99` — the game itself refuses to write 100. Same pattern for Tateoka and Rei.

We then directly poked `$7E:F0C0 = 100` (and then `= 101`) via Mesen and opened the stats menu: both displayed cleanly. So the level *field* tolerates anything 0–255; the cap is purely an upstream "what cap shall I pass to the clamped-add?" decision.

## What this means

- **secky.org's "post-100 crash" claim is for the PC-98 original**, not the SNES port. Koei evidently fixed the level-table overflow when they ported (or restructured the level-up code enough that the bug doesn't reach). The SNES port's level-up bytecode already encodes a hard cap of 99.
- **Our `level_cap_100.ips` doesn't prevent a crash. It raises the cap from 99 to 100** — it lets the player reach one additional level the game would otherwise refuse to give them.
- **Every "post-cap misbehavior" we built logic around (stat decreases, exp_to_next drift, "stats keep climbing") was happening at level 99 — the natural cap — not at any broken level.** Our investigation was solving a non-problem and the "stats freeze" variant was correcting a non-bug; see [§ Appendix](#appendix-the-abandoned-stats-freeze-experiment).

## Did we pollute the cap value?

No. To verify, we dumped the current in-memory PRG ROM (`emu.read` over file `$000000..$0FFFFF`) and byte-diffed it against the on-disk original (SHA1 `0920A7C9A4CF4EC6D80684F35DE275F70DE6B805`). The **only** differences were within file `$003A00..$003A6A` — the unused `$FF` padding region we'd been using as our cave site. Every byte of the orchestrator, the bytecode VM at `$00:A014`, the WRAM-mirrored code at `$008000..$00B27D` (including the stub site at `$00ABD8` after we restored it), and the threshold tables themselves — **all byte-identical to the original**. The `$16 = $0063` we observed comes directly from unmodified Koei code.

## Where does the `99` actually live?

A grep of the original 1 MB ROM for the byte sequence `A9 63 00 85 16` (the canonical `LDA #$0063 ; STA $16`) returned **zero matches**. Same for `A9 64 00 85 16` and `A9 FF 00 85 16`. So the cap value is **not** a 65816 immediate operand anywhere — it must be loaded from a parameter byte that the bytecode VM at `$00:A014` reads from its instruction stream and stores into `$16` indirectly.

Hypothesis (not yet verified): somewhere in the bytecode data table for the level-up sequence there's a literal `63` byte that gets pushed onto the stack and consumed as the cap argument. A **true** "raise level cap" patch would be a **single-byte change** in that bytecode data — find the `63` in context and replace it with whatever cap you want (up to `FF`). That's the surgical fix we never wrote.

## Lessons for next time

1. **Verify the bug exists on the target platform before patching.** secky.org documented the PC-98 version; we never checked that the bug reproduced on SNES. A 30-second test (set a character to 99, exp to 1, trigger a kill, watch what happens) would have revealed the native 99 cap before any cave / stub work.
2. **Trace the data path, then the code path.** Once we saw `$16 = $0063` arriving at the clamped-add, we should have walked back to find *who* set it. That would have led to the bytecode VM and the real cap parameter. Instead we built a cave that hijacked the *primitive* and overrode `$16` from the inside — a much heavier intervention that only works because the orchestrator's value happens to be overridable.
3. **Empirical caps > documented caps.** The byte at file `$F0C9` "caps at 100" only because the bytecode passes `$16 = $0064` to it; the underlying byte is just 8-bit storage. Same story for level: the field can hold 0–255, the cap is policy not capacity.
4. **Patched ROM + original ROM diff is cheap and conclusive.** When in doubt about whether a value is original-game behavior or our pollution, dump-and-diff. Took 60 seconds and resolved the entire "did we cause this?" question definitively.
