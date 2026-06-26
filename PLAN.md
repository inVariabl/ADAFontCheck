Here's the plan:

---

## Plan: Full opentype.js Elimination

### Phase 1 — Measure first (1 hour)

Fix `looksEmpty` so you know your real fallback rate before writing any code:

```js
function looksEmpty(result) {
  return !result || !result.i || !result.h || !result.o ||
    (result.stroke.ratio === 0 && result.body.ratio === 0);
}
```

Run a large diverse font collection and read the console output. This tells you exactly what you're dealing with — if fallback count is already near zero, the remaining phases collapse significantly.

---

### Phase 2 — Variable fonts (1–2 days)

**Step 1: Remove the `fvar` early-out**

```c
// Delete this line in analyze_font():
if (stbtt__find_table(font_data, offset, "fvar")) { out->error = -3; return -3; }
```

This makes variable fonts fall through to your existing TrueType or CFF1 parser and analyze the default instance. Test against a handful of variable fonts — stb_truetype handles the default glyph table fine.

**Step 2: Read named instances from `fvar`**

Add a new C function that parses the `fvar` table and returns the list of named instances:

```c
// Returns count of named instances, fills out a name/index array
int get_variable_instances(const unsigned char *fc, int offset, 
                           char names[][64], int *count);
```

The `fvar` table structure is straightforward — axis records followed by instance records, each with a `nameID` you look up in the `name` table (which you already know how to parse).

**Step 3: Add `gvar` delta interpolation**

This is the main C work. For each named instance you need to:

1. Read the `gvar` table header to find per-glyph delta data
2. For I, H, and O glyphs, fetch their delta tuples for the given axis values
3. Apply scalar interpolation to the default glyph coordinates
4. Pass the blended coordinates through your existing metrics extraction

Roughly 300–400 lines of C. The spec (OpenType 1.9, `gvar` section) is the reference. The tricky parts are tuple variation encoding and scalar computation — worth getting right since errors produce subtly wrong coordinates rather than obvious crashes.

**Step 4: Update the WASM JS wrapper**

Add a new export and reader in `adaAnalyzer.js`:

```js
export async function getVariableInstances(buffer) { ... }
export async function analyzeFontInstance(buffer, axisValues) { ... }
```

**Step 5: Update `fontWorker.js`**

When a font has named instances, analyze each one separately and return an array of results rather than a single result. The worker message shape stays the same — just potentially more results per file.

**Step 6: Update `+page.svelte`**

Group results by filename when a font produces multiple instances. Display them as sub-rows or an expandable section under the font name. Each instance gets its own pass/fail row.

---

### Phase 3 — CFF2 fonts (2–3 days)

This is the last remaining gap. CFF2 is the variable font equivalent of CFF1 — used in newer Adobe and Google fonts. Your existing `cffr_exec` handles CFF1 charstrings; CFF2 is a subset of that with some differences:

**Key differences from CFF1:**
- No `seac` operator
- No `endchar` with arguments  
- `blend` operator (you can ignore the variation part — just consume the operands and use the default values)
- Different subroutine bias (same formula, just verify)
- Width is stored in `hmtx`, not the charstring

**Implementation steps:**

1. Detect CFF2: `stbtt__find_table(font_data, offset, "CFF2")` — you already do this, just remove the early-out
2. Add a `analyze_cff2_font()` function modeled on your existing `analyze_cff_font()` 
3. Add CFF2 charstring handling to a `cffr2_exec()` — mostly the same as `cffr_exec` with the `blend` operator consuming and discarding variation deltas
4. For named instances in CFF2 variable fonts, the variation data lives in `ItemVariationStore` inside the CFF2 table itself rather than `gvar` — this is the complex part if you want full instance support, but for default instance analysis you can skip it entirely

Realistically if you just want default instance support for CFF2, it's closer to 100–150 lines since your CFF1 runner already does the heavy lifting.

---

### Phase 4 — Cleanup (2–3 hours)

Once Phases 2 and 3 are done and tested:

1. Delete `src/lib/opentypeAnalyzer.js`
2. Remove the fallback branch from `fontWorker.js`
3. Remove `analyzeFontWithOpenType` import
4. `npm uninstall opentype.js`
5. Update the "About" modal text
6. Fix the `ceil()` and `pow()` math stubs while you're in the C file
7. Cache the `TextDecoder` instance in `adaAnalyzer.js`
8. Run `npm run build` and verify bundle size drop

---

### Summary

| Phase | Work | Payoff |
|---|---|---|
| 1 — Measure | 1 hour | Know exactly what's left |
| 2 — Variable fonts | 1–2 days | Covers ~95% of real-world fallback cases, adds named instance support as a feature |
| 3 — CFF2 | 2–3 days | Closes the last gap, mostly rare fonts |
| 4 — Cleanup | 2–3 hours | opentype.js gone, bundle smaller, worker starts faster |

The variable font work is the interesting one because it turns a limitation into an actual feature — instead of "this font isn't supported," you get "here are all 12 instances of this font and which ones pass." That's genuinely more useful than what static font checkers do.
