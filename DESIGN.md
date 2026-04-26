# Design system

## Palette
- Page background: #F1F5F9 (slate-100)
- Card surface: #FFFFFF
- Subtle surface (banners, chart bg): #F8FAFC
- Border: 0.5px solid #E2E8F0
- Border emphasis: #CBD5E1
- Text primary: #0F172A
- Text secondary: #64748B
- Text tertiary / hints: #94A3B8

## Semantic colors (do not swap to cool tones)
- Success / positive lift: #16A34A on #DCFCE7, text #166534
- Danger / violation: #DC2626 on #FEE2E2, text #991B1B
- Warning / flagged diagnostic: #C2410C (use sparingly, icon only)
- Neutral verdict banner: slate, not yellow

## Typography
- Font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
- Weights: 400 regular, 500 medium. No 600/700.
- Sentence case. No ALL CAPS, no Title Case.
- Sizes: 22px display number, 14px section title, 13px body, 12px label, 11px metadata, 10px axis

## Layout
- Border radius: 12px on cards, 8px on inline elements, 999px on pills
- Card padding: 12px 14px
- Two-column results layout: minmax(0, 1fr) minmax(0, 1.1fr), 12px gap
- Left column: verdict + metric cards + diagnostics (scrolls with page)
- Right column: persistent chat panel, scrolls independently

## Components
- Metric card: big number in semantic color (22px/500), supporting stats inline below at 11px
- CI bar: 22px tall, neutral track #F1F5F9, semantic-colored fill, center tick at 0
- Status pill: 11px, rounded 999px, light semantic bg + dark semantic text
- Diagnostic row: label left (secondary), status right (semantic color + glyph)
- Suggested-prompt chip: 11px, slate bg, full-radius pill
- Send button: dark slate (#0F172A) bg, white text — primary action only

## Rules
- No vertical stepper on the Results screen — collapse to header strip
- One verdict callout per result, not three (no banner + tag + caveat trio)
- Run diagnostics automatically (SRM, novelty, day-of-week, segment); chat is for "why," not "did you check"
- Inline charts in chat must have a "Pin to results" affordance

## When generating UI
Match the palette and typography above exactly. Do not introduce new colors without asking. Do not add gradients, shadows, or warm/yellow surfaces. If a design choice isn't specified here, ask before inventing one.