import { Font } from '@react-pdf/renderer';

/**
 * The typeface for PDFs that print customer-entered text.
 *
 * Labels are written in English from here on, and Helvetica — a standard PDF
 * font that costs no bytes — would be the obvious choice for that. It is not
 * the safe one: names and addresses already in the database were typed by
 * customers, and some of them are in Bangla. Helvetica has no glyphs for it, so
 * those would print as blank boxes, and nobody would notice because the preview
 * renders in the browser, where the system fonts cover it. A blank address is
 * an undeliverable parcel.
 *
 * Hind Siliguri covers Latin and Bangla in one family. Fonts are subsetted on
 * embed, so an all-English label carries only the Latin glyphs it used and the
 * file stays small; the Bangla is there only for the rows that need it.
 *
 * Bangla also needs real shaping, not just glyphs — the vowel sign in বিধি is
 * typed after its consonant and drawn before it. fontkit (which
 * @react-pdf/renderer uses) declares the `beng`/`bng2` scripts and performs
 * that reordering; this was verified against the font before adopting it.
 *
 * Vendored into public/fonts rather than fetched from Google at print time: a
 * label sheet must not depend on a CDN reachable from the shop floor, and a
 * font that arrives late produces a silently mis-set page.
 *
 * Licence: SIL Open Font License 1.1 — see HindSiliguri-OFL.txt beside the
 * files, which permits bundling.
 */

export const PDF_FONT = 'HindSiliguri';

/**
 * The monospace for codes under a barcode.
 *
 * Courier was tried first, because it is one of the 14 standard PDF fonts and
 * embeds nothing. It looks wrong: Courier is a typewriter face with unusually
 * light stems, so at label sizes it breaks up into grey mush rather than
 * reading as text. The POS receipt looks right because a browser's generic
 * `monospace` resolves to a modern mono — Consolas, DejaVu Sans Mono — with
 * normal stem weight and a large x-height.
 *
 * JetBrains Mono is that kind of face, and it is already the admin's own code
 * font (see `.ops-code` in globals.css), so a code reads the same on screen and
 * on paper. Regular weight, like the receipt. Licence: SIL OFL 1.1.
 */
export const MONO_FONT = 'JetBrainsMono';

let registered = false;

/**
 * Idempotent: @react-pdf/renderer keeps one font registry per page load, and
 * re-registering a family on every print throws away the parsed, cached font.
 */
export function registerPdfFonts() {
  if (registered) return PDF_FONT;

  Font.register({
    family: PDF_FONT,
    fonts: [
      { src: '/fonts/HindSiliguri-Regular.ttf', fontWeight: 400 },
      { src: '/fonts/HindSiliguri-SemiBold.ttf', fontWeight: 600 },
      { src: '/fonts/HindSiliguri-Bold.ttf', fontWeight: 700 }
    ]
  });

  Font.register({
    family: MONO_FONT,
    fonts: [{ src: '/fonts/JetBrainsMono-Regular.ttf', fontWeight: 400 }]
  });

  // The default hyphenation callback splits long words to fit a line. On an
  // address that breaks a street name mid-word for no reason. Never break one.
  Font.registerHyphenationCallback((word) => [word]);

  registered = true;
  return PDF_FONT;
}
