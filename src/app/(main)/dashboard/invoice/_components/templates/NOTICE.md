# Invoice templates — source and license

The 13 layouts in `layouts/`, and `parts.tsx`, `template-frame.tsx`, `invoice-theme.ts`, `invoice-labels.ts` and
`registry.ts`, come from Invoify by Ali Abbasov (https://github.com/al1abb/invoify), commit
`3859b3cbae28ca4ec559db5ef87e41b798740340`, `app/components/templates/invoice-pdf/`, under the MIT License below.

Changes made for the studio:
- The phone number in the party blocks is isolated as left-to-right text (`<bdi dir="ltr">`, two places), the fix
  accepted in T-160 so an Arabic invoice does not print "+974 4000 0000" reversed.
- Import paths and file names (kebab-case); `registry.ts` imports the layouts directly.
- Viewport breakpoints (`sm:`, `lg:`) became container breakpoints of the same width (`@min-[640px]:`,
  `@min-[1024px]:`), and the sheet is the studio's 816 x 1056 paper, so the preview, a phone and print match.
- `parts.tsx`: each part's root can carry an optional manual offset (`movable`). Off by default.
- `helpers.ts` and `types.ts` hold the few Invoify helpers and types the templates import; `invoice-labels.ts` holds
  the `invoiceDocument` strings of Invoify's `en.json` and `ar.json`.
- `fonts.ts` holds Invoify's embedded @font-face rules for Outfit and Noto Sans Arabic only. Both fonts are under the
  SIL Open Font License 1.1 (full text: `../NotoSansArabic-OFL.txt`). Outfit: Copyright 2021 The Outfit Project
  Authors (https://github.com/Outfitio/Outfit-Fonts). Noto Sans Arabic: Copyright 2022 The Noto Project Authors
  (https://github.com/notofonts/arabic).

---

MIT License

Copyright (c) 2023 Ali Abbasov

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
