---
page: Meeting Cost Calculator
slug: /meeting-cost-calculator
status: draft (not published)
created: 7 Aug 2026
background: Light, #F4F6FA, deliberately different from the navy used across the rest of the site, because the embedded tool has a light base and would otherwise read as a floating white box.
seo_title: Not set yet. Page title currently auto-fills as "Meeting Cost Calculator | Concludo 1".
meta_description: Not set. Empty sitewide, pending approval.
implementation: |
  The whole page is a single Wix HTML embed element (comp-msij1kn8) containing one self contained
  HTML file. Source of truth for that file is meeting-cost-calculator.html in this folder.
  Wix re-hosts the code at its own filesusr.com/html/... URL and mints a NEW filename on every
  save, so never rely on a cached embed URL.
  Embed size: 921 x 3300 desktop, 329 x 5885 mobile. Those heights are set so that BOTH
  collapsible panels ("Work it out from a yearly salary" and "Assumptions you can change") can be
  open at once without an inner scrollbar. Measured worst case was 3240 desktop and 5825 mobile,
  plus a 60px margin. Extra height is invisible because the embed's own background is #F4F6FA,
  exactly matching the page.
links_wired_into_the_embed:
  worksheet_pdf: https://540d2ec6-f5c7-4bfa-9db6-3704a22adc51.usrfiles.com/ugd/c3e69e_f90442d20389463d827c302ea276908c.pdf
  article: https://elcortez87.wixsite.com/notewright-1/meeting-to-action-gap
  signup: https://elcortez87.wixsite.com/notewright-1/
linked_from: Free Tools (/modules), card 01 of the first grid.
notes: |
  Australian English. All figures in AUD. No pricing, no checkout, no store.
  Two deliberate edits were made to the supplied HTML, both functional rather than editorial:
  1. target="_top" added to the article and signup links, and target="_blank" to the worksheet
     link. A Wix HTML embed is a sandboxed cross origin iframe, so without a target the click
     would navigate inside the small frame instead of the page.
  2. .prefix input padding-left changed from 34px to 48px. The "AU$" label is about 31px wide and
     starts at 13px, so at 34px padding it overlapped the first digit and rendered as a mangled
     "AU$250". Now measures a clean 4.6px gap at 3, 4 and 6 digit values.
  Not a word of the visible copy was changed.
rebrand: Renamed Notewright to Concludo, 24 Aug 2026 (new entity Concludo Pty Ltd; live Wix site not yet updated)
---

# What a meeting really costs

A free calculator that prices any meeting before you book it, in dollars, for one sitting and for a year.

## The tool

Inputs: people in the meeting, value of each person's time per hour, meeting length in minutes
(with 15 / 30 / 45 / 60 / 90 minute shortcuts), and how often it runs (just once, weekly,
fortnightly, monthly).

Outputs, all updating live as you type: cost per year, cost of this one meeting, cost per month,
a plain English sentence restating the result, and a bar showing one meeting against the year.
Choosing "just once" hides the yearly and monthly figures, since they would be meaningless.

A helper panel works the hourly figure out from a yearly salary, and an "assumptions you can
change" panel exposes the working weeks a year (default 46).

Nothing is saved or sent. All calculation happens in the visitor's own browser.

## Buttons on the page

- **Download the printable worksheet**, linking to the one page PDF worksheet in Wix media.
- **Print my result**, which prints the visitor's own figures.
- **Read: the meeting to action gap**, linking to `/meeting-to-action-gap`.
- **Join the list for the next tools**, linking to the Home page signup form. Never to a checkout.

## Independence

Concludo is an independent product and is not affiliated with any meeting, device, or software
maker. Figures shown depend entirely on the numbers entered and are for planning only. All amounts
are in Australian dollars unless stated otherwise.
