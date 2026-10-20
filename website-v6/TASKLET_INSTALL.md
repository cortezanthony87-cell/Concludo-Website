# Tasklet: deploy the Concludo marketing site, v6

Concludo Pty Ltd. 20 October 2026. ACN 701 605 898, ABN 61 701 605 898.

Built against **Concludo Business Plan v6.1, 20 October 2026**, and the
`concludo-handover` package of the same date. Where this package and any earlier brief
disagree, v6.1 wins.

**Read sections 0 and 1 before touching anything. The commercial posture of this site has
changed. It no longer says the Workspace can be bought, because v6.1 says it is not yet
billable. Section 3 is about payments and it is the part most likely to be got wrong.**

---

## 0. What this is

A complete static replacement for `https://www.concludo.au`. Eleven pages, eighteen
images, no build step, no dependencies, no framework. Open `index.html` from a web server
and it works. It is **not** a Wix theme and Wix cannot import it. Section 4 gives the
three real options.

### Five gates. Do not cross one without Anthony's written instruction on the day.

1. **Do not change a price.** Every figure matches Business Plan v6.1 sections 9 and 10.
   If a price looks wrong, stop and ask. Do not correct it from memory, from the Supabase
   catalogue, or from Stripe.
2. **Do not re-add a buy button, a checkout link or a trial signup.** v6.1 section 3:
   "Pre-revenue. The Workspace is built and partly working, but is not yet billable or
   live to customers." Section 3 of this document covers what to do with Stripe.
3. **Do not say AI-powered, AI-generated or AI drafting anywhere.** v6.1 section 4:
   "It will not claim AI until a language model is live and tested. The current outputs
   are rule-based." The site says rule-based in four places. Leave them.
4. **Do not claim a feature marked not built.** Branded PowerPoint export, automatic
   follow-up email drafting, single sign-on, usage limits, seat enforcement, the
   Enterprise plan. The CRM and the Communication Hub are demonstration data.
5. **Do not add a customer, logo, testimonial, review count, result or third-party
   brand logo.**

---

## 1. What changed from v5, and why

This is a content update on the v5 design. The design is unchanged.

| Area | Was | Now | Source |
| --- | --- | --- | --- |
| Workspace plans | Starter AU$12, Pro AU$29, Team AU$25 a seat (5 min) | Starter AU$25 / AU$250 a year, Pro AU$59 / AU$590 a year, Team AU$49 a seat (3 min, from AU$147 a month) / AU$490 a seat a year, Enterprise from AU$18,000 a year by quote | v6.1 s10 |
| Workbooks | Starter AU$49, Standard AU$199, Pro Edition AU$950 to AU$4,800 | Free sample AU$0, Meeting Starter Kit AU$19, Meeting Mastery Workbook AU$59, Team Workbook Licence AU$249, Practice Licence AU$690 a year | v6.1 s9 |
| Commercial posture | "The Workspace is open and can be bought", Stripe named, buy buttons throughout | Not open for sale. Every call to action is now the free tools or `mailto:hello@concludo.au` | v6.1 s3, s5 |
| Capability claims | Branded deck and drafted follow-up email shown as outputs | Both marked not built. A build-state band added to the Workspace page | v6.1 s5 |
| Free tools | Five described in prose | **Five working tools, running in the browser** | the user's instruction |
| Home headline | "The meeting is over. The work is already written." | "Turn every conversation into finished work." | v6.1 s5 |

**The conflict flagged in v4 and v5 is now settled.** The brand guide said no buy buttons;
the September prices document said the Workspace could be bought. v6.1 is later than both
and says it is not yet billable. The site follows v6.1. Do not revert this.

---

## 2. The free tools now actually work

`/free-tools/` carries five working tools, not five descriptions:

| Tool | What it does |
| --- | --- |
| Meeting Cost Calculator | People, hourly cost, length, preparation and frequency in; cost of one sitting and the annual figure out |
| The Ten Questions | Ten checkboxes; a verdict that fails the meeting unless all four of the first four are answered |
| Meeting Audit Scorecard | Eight criteria scored 0 to 3, out of 24, with a verdict in three bands |
| Responsible Capture Checklist | Six consent lines; writes the sentence to say at the top of the call, with a copy button |
| Delegation Script Pack | Six fields; writes the four-line handover, with a copy button |

All five run in the visitor's browser. **Nothing is sent anywhere, stored, or logged**, and
the page says so. There is no backend, no analytics call and no form post. Do not add one
without Anthony's instruction, and if you ever do, the privacy sentence on that page has
to change in the same commit.

The tool code lives in the `<script>` block at the bottom of each page. It is the same
block on every page and is inert where the tool markup is absent.

---

## 3. Payments. Read this twice.

**The website no longer links to a checkout. That is deliberate and it is not a sign that
anything should be torn out.**

Anthony's instruction: the Stripe connection and every other payment method already set up
must stay connected and working. So:

### 3.1 Do not disconnect anything

- **Do not** delete, archive or disable the Stripe account, its API keys, its webhook
  endpoint, its products or its price objects.
- **Do not** remove the Supabase billing tables, the billing edge functions, or
  `app/src/lib/billing/billingClient.ts`.
- **Do not** remove `/checkout` from the Workspace app.
- **Do not** remove any other payment method, wallet or payout account already configured.

The marketing site and the billing stack are separate. Taking the buy buttons off a
brochure site does not mean the plumbing behind the app should be touched.

### 3.2 Verify the plumbing, and report what you find

v6.1 section 5 marks billing amber and says: "Checkout screens and billing tables are
used, but the server billing functions and Stripe webhook are not in the handover. Live
status unknown. [To Verify]" So verify it, in **test mode only**:

1. Confirm the Stripe account is live and reachable, and say whether it is in test or live
   mode today.
2. List the Stripe products and price objects that exist, with their IDs and amounts.
3. Confirm the webhook endpoint exists, what events it is subscribed to, and when it last
   received one successfully.
4. Confirm the Supabase product catalogue rows and their `stripe_price_id` values, and say
   whether each one resolves to a real Stripe price.
5. Run one end-to-end test-mode purchase: checkout, webhook, licence issue, refund. Report
   where it breaks.
6. List every other payment method configured, and whether each is still connected.

### 3.3 The prices will not match. Do not fix them yet.

The catalogue and Stripe still hold the old prices (AU$12, AU$29, AU$25 a seat, AU$49,
AU$199, AU$950). This site shows the v6.1 prices. **That mismatch is expected and you must
not silently resolve it in either direction.**

Report the gap as a table: product, price in Stripe, price in Supabase, price on the site.
Then stop. Repricing live Stripe objects is Anthony's decision, it affects anyone already
holding a payment link, and the v6.1 prices are explicitly indicative and are being tested
with buyers at Days 45 to 60 before they are published as final.

### 3.4 Before the first real payment

v6.1 lists these as blockers and so does this package:

- GST registration before the first sale (v6.1 section 10, Commercial rules).
- A written refund policy. There is none today, and the site does not claim one.
- Privacy policy and terms reviewed by an Australian commercial lawyer. The privacy policy
  currently overstates the build and the terms are a placeholder.
- Server-enforced trial expiry. It is enforced only in the browser today.
- The two feature-gating tables that currently disagree, reconciled.

---

## 4. Where this site can go

**This will not work as stated if the instruction is "put it on Wix", because Wix hosts its
own page structure and cannot import eleven hand-built HTML documents.** A Wix HTML embed
is a sandboxed fixed-height iframe and would break the navigation, the layout, every
internal link and the five free tools.

### Option A, recommended. GitHub Pages on the existing account

1. New repository, for example `cortezanthony87-cell/concludo-marketing`.
2. Copy the package contents to the repository root.
3. Keep `.nojekyll` and `CNAME`. Delete `_redirects` and `vercel.json`.
4. Settings, Pages, source: deploy from branch `main`, folder `/`.
5. DNS at Crazy Domains: `www` CNAME to `cortezanthony87-cell.github.io`, apex
   `concludo.au` to the four GitHub Pages A records. **Leave the `app` record alone.**
6. Wait for the certificate, then tick "Enforce HTTPS".

The one real cost of Option A is that the section 5 redirects must be done upstream.

### Option B. Netlify or Vercel

Drag the folder in, or `vercel deploy`. The redirects ship in the package: Netlify reads
`_redirects`, Vercel reads `vercel.json`. Delete `.nojekyll` and `CNAME`.

### Option C. Keep Wix and rebuild the eleven pages by hand

Slowest, most likely to lose the design, and **the five free tools will not survive it**.
They are JavaScript on the page. **Do not attempt a hybrid.**

---

## 5. Routes

Five existing Wix paths are preserved exactly: `/`, `/free-tools`,
`/meeting-mastery-workbook`, `/workspace`, `/about`.

Three need a redirect: `/workshops` to `/pricing/`, `/faq` to `/`, `/contact` to `/about/`.

**The legal pages are the thing most likely to break this deploy.** The footer links are
absolute to `https://www.concludo.au/privacy-policy`, `/terms-of-service` and
`/refund-policy`, and those pages are **not in this package**. v6.1 says all three need
legal review before the first transcript or payment anyway. Either migrate them or keep
Wix serving those paths. **Raise this with Anthony before cutting DNS.**

Five paths are new: `/ai-agents/`, `/workflow-builder/`, `/pricing/`, and the three
workbook pages under `/meeting-mastery-workbook/`.

---

## 6. Install order

1. Serve the folder locally. `python3 -m http.server 8099`, then
   `http://127.0.0.1:8099/`. Click every navigation item.
2. **Use all five free tools.** Type into each one and confirm the output changes. The
   copy buttons on the consent and delegation tools must copy.
3. Confirm no page offers a purchase, a checkout, a trial signup or a card field.
4. Confirm every image loads. There are 18.
5. Do section 3. Report before changing anything in Stripe or Supabase.
6. Resolve the legal page question in section 5 with Anthony. In writing.
7. Deploy by the option chosen in section 4, then set the redirects.
8. Submit `sitemap.xml` in Google Search Console once the domain resolves.

---

## 7. Report back

State what you observed. Do not mark one done unless you ran it and looked at the result.

1. Which option in section 4 was used, and why.
2. All eleven pages load at their paths. Paste the list.
3. All five free tools work. Say what you typed into each and what came back.
4. All 18 images load. Say how you checked.
5. The three legal links in the footer resolve. Paste their status codes.
6. The three redirects are in place.
7. Section 3.2, items 1 to 6, each answered.
8. Section 3.3, the price gap table. Nothing changed in Stripe or Supabase.
9. At 390px: nothing clipped, no sideways scroll, every tool usable with a thumb.
10. You changed no price, added no buy button, claimed no AI, and added no customer claim.

---

## 8. Do not touch

- Any price, anywhere on the site.
- The Stripe account, its keys, its webhook, its products or its prices. Section 3.
- Any other configured payment method.
- The free tools script. It is the same block on every page.
- The footer independence paragraph, or the caption under any product shot.
- The connection names in the workflow shots. They are generic on purpose: brand names
  there would need the independence disclaimer inside an image, and logos are forbidden.
- `app.concludo.com.au` or its DNS record.
- The three legal pages. Not in this package, not yours to move.
- The `img/` filenames. Referenced from eleven files.

---

## 9. Checks already run on this package

- All eleven pages plus `404.html` at 1920, 1440, 1180, 834 and 390 px: no horizontal
  overflow, one `h1` per page, one current navigation item per page, no dangling hash
  links, no JavaScript errors.
- The five free tools tested in the built site. Arithmetic verified by hand: ten people,
  one hour, AU$100 an hour returns AU$1,000. Verdict thresholds checked at both ends.
- A page with no tool markup raises no JavaScript error.
- Internal link integrity: every root-relative link resolves. Eleven unique.
- All 18 images load on every page that references them, each with alt text.
- Price scan: the twelve figures on the site are exactly the v6.1 set and nothing else.
- Copy scan: no dashes, no US spellings, no unearned traction, no placeholders, no retired
  product names, no bare "Pro" or "Starter", no AI-powered claim.
- Contrast: every text pair at or above 4.5:1.

---

Concludo Pty Ltd, ACN 701 605 898, ABN 61 701 605 898. Pre-revenue, in build, not yet
billable. Prices referenced anywhere in Concludo remain indicative until validated with
real buyers. Concludo is an independent product and is not affiliated with, endorsed by,
or partnered with any device maker, meeting platform or note-taking service.
