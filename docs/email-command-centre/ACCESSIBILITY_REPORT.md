# Email Command Centre: accessibility report

Concludo Workspace. Final, Stage 7. Tested 12 October 2026.

**Target:** WCAG 2.2 Level AA.
**Result:** meets AA across all eleven views at three widths, with one
exception recorded in section 7 and three defects found and fixed during this
stage.

Seven of the brief's eight checks are automated and run in a real browser. The
eighth, a screen reader, cannot be driven from a test runner; what is automated
is the semantic structure a screen reader depends on, and section 5 records the
manual pass that still has to happen with an actual screen reader.

---

## 1. How it was tested

| Check | Method | Coverage |
|---|---|---|
| Keyboard only | Playwright, real Tab presses, focus and indicator measured at each stop | 11 views |
| Screen reader semantics | Heading order, landmarks, live regions, accessible names, table headers, `aria-pressed` values, decorative icons | 11 views |
| 200 per cent zoom | 640 CSS pixel viewport at device scale 2, which is what SC 1.4.10 Reflow actually asks about | 11 views |
| Contrast | Every text node sampled, backgrounds composited, ratio computed against the SC 1.4.3 thresholds | 11 views, up to 160 samples each |
| High contrast | `forced-colors: active` | Backlog and badges |
| Reduced motion | `prefers-reduced-motion: reduce`, looping animations counted | Loading state |
| Mobile portrait | 390 by 844, touch | 11 views |
| Tablet | 834 by 1112 | 11 views |
| Desktop | 1440 by 1000 | 11 views |

546 checks, all passing. The suite is
`app/tests/browser/emailCommandCentre.accessibility.test.mjs` and it is run the
same way as any other test, which is the point: an accessibility pass that
happens once before a release is a snapshot, and this one is a gate.

## 2. Keyboard

- Every control in all eleven views carries an accessible name. The suite
  resolves `aria-label`, `aria-labelledby`, a `label` element, a wrapping
  label, `title` and `placeholder`, and counts anything with none. The count is
  zero.
- Nothing visible is removed from the tab order.
- Twelve tab stops per view were walked and focus moved on every one, stayed
  inside the module, and showed a focus indicator.
- The eleven module tabs are reachable by Tab alone, in order, and the seventh
  is Clear Backlog.
- Backlog mode was driven start to finish with the keyboard: start a session,
  decide with Enter, confirm the position advanced, pause, resume. No page
  errors through the whole flow.
- The skip link is the first stop and goes to the dashboard region.

### The in-page tabs

The eight analysis panes on a thread are a proper tablist: `role="tablist"`,
one selected, roving tabindex, arrow keys, Home and End.

The eleven module tabs are deliberately **not** a tablist. They are links in a
`nav` with `aria-current` on the active one, because each one changes the URL. A
tablist would promise arrow-key behaviour a router cannot sensibly provide and
would tell a screen reader the wrong thing about what pressing one does. This
was worth getting wrong once in the test suite to settle properly.

## 3. Screen reader semantics

Per view, verified: exactly one `h1`; a real heading structure with no skipped
level; at least one landmark; at least one live region; no empty `aria-label`;
every table has header cells; `aria-pressed` is always `true` or `false`, never
a word; and every decorative SVG is `aria-hidden`.

Every action that changes a list the person may not be looking at announces
itself through a live region, because a deferral that silently removes a row is
indistinguishable from a bug.

Nothing depends on colour alone. Every status badge carries a word, every
warning carries a heading word, and every date chip says in text whether the
date was stated in the email or worked out.

## 4. Contrast

Measured, not asserted. Every text node is sampled with its computed colour and
a **composited** background, and the ratio is computed against 4.5:1, or 3:1
for large text as SC 1.4.3 defines it.

Compositing is the part that matters. An early version of this suite read the
first ancestor with a declared background, which for the application's own
button style is `rgba(255, 255, 255, 0.04)` over a near-black page. Read as an
opaque white background, white text on it looks like a 1.05:1 failure when it
actually renders at better than 12:1. That produced eleven false failures. A
contrast suite that cries wolf gets switched off, so the fix was to measure the
right thing rather than to raise the threshold.

### The Workspace token that fails, and the module's answer

The application's `--text-muted` (`#64748b`) measures **4.05:1** on the module's
base ground and **3.41:1** on an elevated card. Both fail AA for body text. The
module introduced `--ecc-text-quiet` (`#8593a9`), which holds **4.77:1 or
better** on every surface it uses, and uses it everywhere small secondary text
appears.

**This is worth raising beyond this module.** The same token is used across the
rest of the application, so the same failure almost certainly exists on other
pages. Auditing it application-wide is its own change with its own review; it
was not done here because rolling a colour change across every page from inside
one module is how an unrelated regression gets shipped.

## 5. The screen reader pass that still has to happen

Automated semantics are necessary and not sufficient. Before the module is
enabled for anybody, one pass with a real screen reader, which no test
substitutes for:

| Platform | Reader | Status |
|---|---|---|
| macOS | VoiceOver, Safari | **Not done** |
| Windows | NVDA, Firefox | **Not done** |
| iOS | VoiceOver, Safari | **Not done** |
| Android | TalkBack, Chrome | **Not done** |

What to listen for specifically, because these are the places the structure is
unusual:

1. The eleven-item nav. Does it announce "list, eleven items" and the current
   one as current?
2. A decision in backlog mode. Is the recorded state announced, and is the next
   item's heading reached without hunting?
3. A date chip. Does "suggested date, confirm" get read, or does the visual
   question-mark icon carry the meaning alone?
4. A security warning. Is it reached before the summary it warns about?
5. The eight analysis panes. Do arrow keys move between them and does the panel
   content follow?
6. An empty view. Does it read as an outcome rather than as a failure?
7. The approvals table in Settings. Do the row headers associate on a phone,
   where the table becomes stacked blocks?

Recorded here as not done, rather than left out, because an accessibility report
that lists only the passing checks is marketing.

## 6. Defects found and fixed in Stage 7

**1. The focus ring faded in over 200 milliseconds.** The application's
`.btn-secondary` carries `transition: all 0.2s ease`, which includes the
outline. Measured immediately after a Tab keypress, the focused button had an
outline width of zero. For somebody moving quickly through the header with the
keyboard, the ring is behind them, and it is also motion a person who asked for
less of it did not ask for. Fixed by `transition: none` on
`.ecc-module :focus-visible`: focus is not a decorative state and does not
animate. (SC 2.4.7.)

**2. The panel "View all" links were 62 by 20 pixels.** Standalone controls in
a panel header, not links inside a sentence, so the 24 pixel minimum applies
and the inline exception does not. Raised to 24, and 44 at touch widths.
(SC 2.5.8.)

**3. The backlog checkboxes were 17 by 17 pixels.** Clicking the label works and
the label is large enough, but a person aiming at the box is aiming at a 17
pixel target. Making the box the right size is simpler than relying on everyone
knowing the label is clickable. Raised to 24, and 26 at touch widths.
(SC 2.5.8.)

Carried over from earlier stages and still asserted: five contrast failures
from `--text-muted`, header selects and the search input below 44 pixels on a
phone, inline extraction buttons at 20 pixels, sorting impossible at 390 pixels
because the table headers vanish with the table, and a collapsed action group
hidden from screen readers while visible to everybody else because a CSS
`display` rule beat the `hidden` attribute.

## 7. Known exceptions

**The tab strip scrolls horizontally at narrow widths and at 200 per cent
zoom.** Eleven tabs do not fit in 640 CSS pixels. The page itself does not
scroll sideways, which is what SC 1.4.10 Reflow requires; the strip scrolls
inside itself and every tab is reachable by Tab, which brings it into view.
This is a deliberate exception and it is why the reflow test excludes content
inside containers that scroll on purpose.

The alternative, a dropdown of eleven destinations on a phone, was considered
and rejected: it hides the map of the module behind a control, and the module's
shape is the thing a new person needs most.

## 8. What is not claimed

- **AAA.** Not targeted. Several text colours meet AA and not AAA.
- **A screen reader pass.** See section 5.
- **Voice control.** Untested. The controls have visible labels that match
  their accessible names, which is most of what voice control needs, but
  nobody has tried it.
- **Switch access and alternative input.** Untested.
- **Cognitive accessibility beyond plain language.** The module writes in plain
  words, labels every inferred value, and refuses shame framing. That is a
  starting position, not an evaluation.
- **The rest of the application.** This report covers the eleven Email Command
  Centre views. The `--text-muted` finding in section 4 suggests the
  application-wide picture is worse, and nobody has measured it.
