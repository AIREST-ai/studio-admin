import { ARABIC_PDF_FONT } from "./invoice-pdf-font";

/**
 * Lays out one line of invoice text that holds Arabic for the PDF (T-87): letters take their joined forms (Arabic
 * Presentation Forms), and the line is put in visual order by the Unicode bidirectional algorithm (rules W1-W7,
 * N1-N2, I1, L1-L2 and L4 mirroring; one paragraph without explicit embeddings; base direction left-to-right like
 * the on-page preview). Latin text stays in the PDF's Courier, Arabic glyphs come from the embedded Noto Sans Arabic.
 * Widths are in em (multiply by the font size).
 */

export const LATIN_CHAR_EM = 0.6;

export interface PdfGlyph {
  gid: number;
  /** The logical text this glyph stands for (ToUnicode). */
  text: string;
  /** Pen shift to the left before the glyph, in font units; a mark is moved back over its letter, then forward. */
  shift?: number;
}

export type PdfRun =
  /** `mirrored`: brackets drawn mirrored inside right-to-left text (their ToUnicode must swap them back). */
  | { font: "latin"; text: string; width: number; mirrored?: boolean }
  | { font: "arabic"; glyphs: PdfGlyph[]; width: number };

type BidiClass = "L" | "R" | "AL" | "EN" | "AN" | "ES" | "ET" | "CS" | "NSM" | "WS" | "ON";

interface Unit {
  font: "latin" | "arabic";
  text: string;
  glyphs: PdfGlyph[];
  width: number;
  bidi: BidiClass;
  level: number;
}

// Base letter, first presentation form, number of forms (isolated, final, initial, medial).
const FORMS: Array<[number, number, number]> = [
  [0x621, 0xfe80, 1],
  [0x622, 0xfe81, 2],
  [0x623, 0xfe83, 2],
  [0x624, 0xfe85, 2],
  [0x625, 0xfe87, 2],
  [0x626, 0xfe89, 4],
  [0x627, 0xfe8d, 2],
  [0x628, 0xfe8f, 4],
  [0x629, 0xfe93, 2],
  [0x62a, 0xfe95, 4],
  [0x62b, 0xfe99, 4],
  [0x62c, 0xfe9d, 4],
  [0x62d, 0xfea1, 4],
  [0x62e, 0xfea5, 4],
  [0x62f, 0xfea9, 2],
  [0x630, 0xfeab, 2],
  [0x631, 0xfead, 2],
  [0x632, 0xfeaf, 2],
  [0x633, 0xfeb1, 4],
  [0x634, 0xfeb5, 4],
  [0x635, 0xfeb9, 4],
  [0x636, 0xfebd, 4],
  [0x637, 0xfec1, 4],
  [0x638, 0xfec5, 4],
  [0x639, 0xfec9, 4],
  [0x63a, 0xfecd, 4],
  [0x641, 0xfed1, 4],
  [0x642, 0xfed5, 4],
  [0x643, 0xfed9, 4],
  [0x644, 0xfedd, 4],
  [0x645, 0xfee1, 4],
  [0x646, 0xfee5, 4],
  [0x647, 0xfee9, 4],
  [0x648, 0xfeed, 2],
  [0x649, 0xfeef, 2],
  [0x64a, 0xfef1, 4],
  [0x67e, 0xfb56, 4],
  [0x686, 0xfb7a, 4],
  [0x698, 0xfb8a, 2],
  [0x6a9, 0xfb8e, 4],
  [0x6af, 0xfb92, 4],
  [0x6cc, 0xfbfc, 4],
];
const FORM_INDEX = new Map(FORMS.map(([base, first, count]) => [base, { first, count }]));
// Lam followed by one of these alefs becomes one ligature glyph (isolated, final).
const LAM_ALEF = new Map([
  [0x622, 0xfef5],
  [0x623, 0xfef7],
  [0x625, 0xfef9],
  [0x627, 0xfefb],
]);
const LAM = 0x644;
const TATWEEL = 0x640;
const ZWNJ = 0x200c;
const ZWJ = 0x200d;
const BRACKETS = new Map([
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
]);
const MIRROR = new Map(
  ["()", ")(", "[]", "][", "{}", "}{", "<>", "><", "«»", "»«"].map((pair) => [pair[0], pair[1]] as [string, string]),
);

let fontTables: { cmap: Map<number, number>; widths: Map<number, number>; marks: Map<number, number> } | null = null;

function pairs(values: readonly number[]) {
  const map = new Map<number, number>();

  for (let index = 0; index < values.length; index += 2) map.set(values[index], values[index + 1]);

  return map;
}

function arabicFont() {
  fontTables ??= {
    cmap: pairs(ARABIC_PDF_FONT.cmap),
    widths: pairs(ARABIC_PDF_FONT.widths),
    marks: pairs(ARABIC_PDF_FONT.marks),
  };

  return fontTables;
}

function isArabicScript(code: number) {
  return (
    (code >= 0x600 && code <= 0x6ff) ||
    (code >= 0x750 && code <= 0x77f) ||
    (code >= 0x8a0 && code <= 0x8ff) ||
    (code >= 0xfb50 && code <= 0xfdff) ||
    (code >= 0xfe70 && code <= 0xfeff)
  );
}

/** True when the text holds a character the embedded Arabic font draws (the rest of the PDF stays Courier). */
export function hasArabicText(value: string) {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;

    if (isArabicScript(code) && arabicFont().cmap.has(code)) return true;
  }

  return false;
}

function bidiClass(char: string): BidiClass {
  const code = char.codePointAt(0) ?? 0;

  if ((code >= 0x30 && code <= 0x39) || (code >= 0x6f0 && code <= 0x6f9)) return "EN";
  if ((code >= 0x660 && code <= 0x669) || code === 0x66b || code === 0x66c || (code >= 0x600 && code <= 0x605)) {
    return "AN";
  }
  if (/\p{Mn}/u.test(char)) return "NSM";
  if (code === 0x2b || code === 0x2d) return "ES";
  if ("#$%°±¢£¤¥€‰٪".includes(char)) return "ET";
  if (",./: ،".includes(char)) return "CS";
  if (/\s/u.test(char)) return "WS";
  if (code >= 0x590 && code <= 0x5ff && /\p{L}/u.test(char)) return "R";
  if (isArabicScript(code)) return "AL";
  if (/[\p{L}\p{N}]/u.test(char)) return "L";

  return "ON";
}

type Joining = "D" | "R" | "C" | "U" | "T";

function joining(code: number): Joining {
  if (code === TATWEEL || code === ZWJ) return "C";
  if (/\p{Mn}/u.test(String.fromCodePoint(code))) return "T";

  const forms = FORM_INDEX.get(code);

  if (!forms || forms.count === 1) return "U";

  return forms.count === 4 ? "D" : "R";
}

function glyphFor(code: number) {
  const { cmap, widths } = arabicFont();
  const gid = cmap.get(code) ?? 0;

  return { gid, width: (widths.get(gid) ?? 0) / ARABIC_PDF_FONT.unitsPerEm };
}

/** Logical units: one Latin character, or one Arabic letter (or lam-alef) with the marks that follow it. */
function shape(value: string, isLatin: (code: number) => boolean) {
  const chars = Array.from(value);
  const codes = chars.map((char) => char.codePointAt(0) ?? 0);
  const types = codes.map(joining);
  const neighbour = (from: number, step: number) => {
    for (let index = from + step; index >= 0 && index < codes.length; index += step) {
      if (types[index] !== "T") return index;
    }

    return -1;
  };
  const units: Unit[] = [];

  for (let index = 0; index < chars.length; index++) {
    const char = chars[index];
    const code = codes[index];

    if (code === ZWJ || code === ZWNJ) continue;

    const arabic = isArabicScript(code) && arabicFont().cmap.has(code);

    if (!arabic) {
      const last = units[units.length - 1];

      if (types[index] === "T" && last?.font === "arabic") {
        last.text += char;
        last.glyphs.push(markGlyph(code, char, last));
        continue;
      }
      units.push({
        font: "latin",
        text: isLatin(code) ? char : "?",
        glyphs: [],
        width: LATIN_CHAR_EM,
        bidi: bidiClass(char),
        level: 0,
      });
      continue;
    }

    if (types[index] === "T") {
      const last = units[units.length - 1];

      if (last?.font === "arabic") {
        last.text += char;
        last.glyphs.push(markGlyph(code, char, last));
        continue;
      }
    }

    const previous = neighbour(index, -1);
    const next = neighbour(index, 1);
    const joinsPrevious = previous >= 0 && /[DC]/.test(types[previous]) && /[DRC]/.test(types[index]);
    let joinsNext = next >= 0 && /[DRC]/.test(types[next]) && /[DC]/.test(types[index]);
    let text = char;
    let formCode = code;

    const ligature = code === LAM && next === index + 1 ? LAM_ALEF.get(codes[next]) : undefined;

    if (ligature !== undefined) {
      formCode = ligature + (joinsPrevious ? 1 : 0);
      text += chars[next];
      index = next;
      joinsNext = false;
    } else {
      const forms = FORM_INDEX.get(code);

      if (forms && forms.count > 1) {
        // Forms are stored isolated, final, initial, medial.
        const form = (joinsNext ? 2 : 0) + (joinsPrevious ? 1 : 0);

        if (form < forms.count) formCode = forms.first + form;
      } else if (forms) formCode = forms.first;
    }

    let glyph = glyphFor(formCode);

    if (!glyph.gid) glyph = glyphFor(code);
    units.push({
      font: "arabic",
      text,
      glyphs: [{ gid: glyph.gid, text }],
      width: glyph.width,
      bidi: bidiClass(char),
      level: 0,
    });
  }

  return units;
}

function markGlyph(code: number, char: string, base: Unit): PdfGlyph {
  const { marks } = arabicFont();
  const { gid } = glyphFor(code);
  const centre = marks.get(gid) ?? 0;
  const baseWidth = base.width * ARABIC_PDF_FONT.unitsPerEm;

  return { gid, text: char, shift: Math.round(baseWidth / 2 + centre) };
}

/** Resolves embedding levels for one left-to-right paragraph (no explicit embeddings). */
function resolveLevels(units: Unit[]) {
  const types = units.map((unit) => unit.bidi);
  const strongBefore = (index: number) => {
    for (let at = index - 1; at >= 0; at--) {
      if (types[at] === "L" || types[at] === "R" || types[at] === "AL") return types[at];
    }

    return "L";
  };

  // W1
  types.forEach((type, index) => {
    if (type === "NSM") types[index] = index === 0 ? "L" : types[index - 1];
  });
  // W2, W3
  types.forEach((type, index) => {
    if (type === "EN" && strongBefore(index) === "AL") types[index] = "AN";
  });
  types.forEach((type, index) => {
    if (type === "AL") types[index] = "R";
  });
  // W4
  for (let index = 1; index < types.length - 1; index++) {
    const before = types[index - 1];
    const after = types[index + 1];

    if (types[index] === "ES" && before === "EN" && after === "EN") types[index] = "EN";
    else if (types[index] === "CS" && before === after && (before === "EN" || before === "AN")) types[index] = before;
  }
  // W5
  for (let index = 0; index < types.length; index++) {
    if (types[index] !== "ET") continue;

    let end = index;

    while (end < types.length && types[end] === "ET") end++;
    if (types[index - 1] === "EN" || types[end] === "EN") types.fill("EN", index, end);
    index = end - 1;
  }
  // W6, W7
  types.forEach((type, index) => {
    if (type === "ES" || type === "ET" || type === "CS") types[index] = "ON";
  });
  types.forEach((type, index) => {
    if (type === "EN" && strongBefore(index) === "L") types[index] = "L";
  });
  const direction = (type: BidiClass | undefined) => {
    if (type === undefined || type === "L") return "L";

    return type === "R" || type === "EN" || type === "AN" ? "R" : null;
  };

  // N0: both brackets of a pair take the direction of the text inside: left-to-right if any, else right-to-left when
  // the text before the pair is right-to-left too.
  const openers: number[] = [];

  units.forEach((unit, index) => {
    if (types[index] !== "ON") return;
    if (BRACKETS.has(unit.text)) {
      openers.push(index);
      return;
    }

    let at = openers.length - 1;

    while (at >= 0 && BRACKETS.get(units[openers[at]].text) !== unit.text) at--;
    if (at < 0) return;

    const open = openers[at];
    const inside = types.slice(open + 1, index).map(direction);

    openers.length = at;
    if (!inside.includes("L") && !inside.includes("R")) return;

    let before = "L";

    for (let back = open - 1; back >= 0; back--) {
      const strong = direction(types[back]);

      if (strong) {
        before = strong;
        break;
      }
    }
    types[open] = types[index] = inside.includes("L") || before === "L" ? "L" : "R";
  });

  // N1, N2: neutrals take the direction around them when both sides agree (numbers count as R), else LTR.

  for (let index = 0; index < types.length; index++) {
    if (types[index] !== "ON" && types[index] !== "WS") continue;

    let end = index;

    while (end < types.length && (types[end] === "ON" || types[end] === "WS")) end++;

    const before = index === 0 ? "L" : direction(types[index - 1]);
    const after = end === types.length ? "L" : direction(types[end]);

    types.fill(before === after && before !== null ? before : "L", index, end);
    index = end - 1;
  }
  // I1, L1
  units.forEach((unit, index) => {
    const type = types[index];

    if (type === "R") unit.level = 1;
    else unit.level = type === "AN" || type === "EN" ? 2 : 0;
  });
  for (let index = units.length - 1; index >= 0 && units[index].bidi === "WS"; index--) units[index].level = 0;
}

function reorder(units: Unit[]) {
  const visual = [...units];
  const highest = Math.max(0, ...units.map((unit) => unit.level));

  for (let level = highest; level >= 1; level--) {
    for (let index = 0; index < visual.length; index++) {
      if (visual[index].level < level) continue;

      let end = index;

      while (end < visual.length && visual[end].level >= level) end++;
      visual.splice(index, end - index, ...visual.slice(index, end).reverse());
      index = end - 1;
    }
  }

  return visual;
}

/** One line in visual order, split into Courier and Arabic-font runs. `isLatin`: the character is WinAnsi. */
export function layoutLine(value: string, isLatin: (code: number) => boolean) {
  const units = shape(value, isLatin);

  resolveLevels(units);

  const runs: PdfRun[] = [];

  for (const unit of reorder(units)) {
    const last = runs[runs.length - 1];

    const mirrored = unit.font === "latin" && unit.level % 2 === 1 && MIRROR.has(unit.text);
    const char = mirrored ? (MIRROR.get(unit.text) ?? unit.text) : unit.text;
    const code = char.codePointAt(0) ?? 0;

    // Inside right-to-left text, spaces, digits and punctuation the Arabic font has are drawn with it: the phrase stays
    // one run in one font, spaced like Arabic, as browsers print it.
    if (unit.font === "latin" && unit.level > 0 && arabicFont().cmap.has(code)) {
      const glyph = glyphFor(code);

      unit.font = "arabic";
      unit.glyphs = [{ gid: glyph.gid, text: char }];
      unit.width = glyph.width;
    }

    if (unit.font === "latin") {
      if (last?.font === "latin" && Boolean(last.mirrored) === mirrored) {
        last.text += char;
        last.width += unit.width;
      } else runs.push({ font: "latin", text: char, width: unit.width, ...(mirrored ? { mirrored } : {}) });
    } else if (last?.font === "arabic") {
      last.glyphs.push(...unit.glyphs);
      last.width += unit.width;
    } else runs.push({ font: "arabic", glyphs: [...unit.glyphs], width: unit.width });
  }

  return { runs, width: runs.reduce((sum, run) => sum + run.width, 0) };
}
