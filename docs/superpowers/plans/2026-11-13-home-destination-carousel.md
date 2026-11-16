# Home Destination Carousel Implementation Plan

**Goal:** Expand the home carousel to nine service-backed Vietnamese destinations, show a locally available landmark photograph for every card, and make transitions smooth and accessible.

**Architecture:** Keep destinations in a small typed data catalog beside the home page, combining the six national catalog records with Hà Giang, Đà Nẵng, and Hội An from service data. Bundle landmark photos under `my-app/public/image/greensteps/`; route every card to `/services?dest=...`.

**Tech Stack:** Angular standalone-compatible home component, TypeScript, component CSS, locally bundled JPEG/WebP photos.

**Spec:** `docs/superpowers/specs/2026-11-13-home-destination-carousel-design.md`

## Global Constraints

- Use the six national catalog destinations plus Hà Giang, Đà Nẵng, and Hội An, which already appear in service data.
- Preserve the current three-card desktop carousel, dots, keyboard-operable buttons, and swipe behavior.
- Add no destination records to Atlas and change no database data.
- Respect reduced-motion settings and keep the cards usable at mobile widths.

## Review Focus

- National catalog or services API is unavailable: retain a usable set of curated destination cards instead of showing placeholders.
- Destination names differ in punctuation/diacritics: normalize only for matching; preserve the display labels.
- Carousel wraps between first and last cards: side positions and center focus remain correct.
- Images fail to load: the bundled asset manifest check catches missing files before finishing.
- Reduced-motion is enabled: transitions become immediate without disabling navigation.

---

### Task 1: Curated landmark data and assets

**Files:**
- Create: `my-app/src/app/pages/home/destination-card-data.ts`
- Reuse: existing Commons-licensed landmark photos and metadata in `my-app/src/app/data/demo-tour-photo-data.ts`
- Reuse: Hà Giang photo `my-app/public/image/greensteps/ha-giang/tu-san-canyon.jpg` and its existing Commons metadata

**Interface:**
- Export `HOME_DESTINATION_CARDS`, a typed array with destination key, display name, filter value, subtitle, image path, alt text, and source/license metadata for the nine destinations.
- Reuse the licensed existing landmark assets referenced by `demo-tour-photo-data.ts` for Đà Lạt, Đà Nẵng – Hội An, Ninh Bình, Phú Quốc, Phú Yên, Sa Pa, Đà Nẵng, and Hội An; use the existing Wikimedia Commons Hà Giang photo and its license metadata.

- [x] Reuse the existing source and license records for each cover; add the Hà Giang source record to the typed catalog.
- [x] Verify all nine existing image paths exist and that each photo and alt text point to the named destination landmark.

### Task 2: Populate the carousel from available destination data

**Files:**
- Modify: `my-app/src/app/pages/home/home.ts`
- Modify: `my-app/src/app/pages/home/home.html`
- Consume: `HOME_DESTINATION_CARDS` from Task 1.

**Interface:**
- Build the carousel from six national destination records, then add the three curated destinations only when the service list contains matching `destination` values.
- Match by normalized Vietnamese text while keeping the curated display title, image, and alt text.
- Card selection navigates to `/services` with the selected destination in the `dest` query parameter.
- Image source comes from the curated data entry, never from the placeholder gate `coverMediaVerified`.

- [x] Replace the current 3-card fallback and 6-card `coverMediaVerified` placeholder mapping with a normalized union capped at the nine curated destinations.
- [x] Preserve destination cards when either API call fails by using curated entries that can be confirmed by the other successful source.
- [x] Set each card image's alt text from the curated entry and keep the existing arrow, pagination, click, and swipe controls keyboard accessible.

### Task 3: Refine transition and responsive states

**Files:**
- Modify: `my-app/src/app/pages/home/home.css`
- Modify: `my-app/src/app/pages/home/home.ts`

**Interface:**
- Retain `rotateDestinations(direction)`, `setActiveDestination(index)`, and `getDestinationPosition(index)` as the carousel controls.
- Animate `left`, scale, slight rotate, opacity, and shadow with one coordinated easing curve; active card stays sharp and visually forward.
- At reduced motion, keep the same states and immediately update position without animated movement.

- [x] Add distinct left, center, and right card transforms and ensure wraparound preserves the visible three-card arrangement.
- [x] Keep one active card on small screens, allow touch swipe, and prevent hover-only behavior from hiding content.
- [x] Add focus-visible styling to arrows/dots and expose the active destination state to screen readers.

### Task 4: Manual verification

**Files:** No additional changes expected.

- [x] Open `http://localhost:4200` and verify nine pagination controls, accurate images, and three visible desktop cards.
- [x] Use pagination to traverse all nine destinations and confirm each active landmark image loads.
- [x] Verify a card opens `/services?type=all&dest=...`.
- [x] Check a mobile viewport and `prefers-reduced-motion: reduce`.
- [x] Confirm all nine active landmark images load successfully from port 4200.

**Manual verification result:** Chrome against the running frontend on port 4200 showed all nine destinations with opacity 1 and successful image loads; the destination click opened the services filter route. At 390px with reduced motion enabled, one active card remained visible and pagination changed immediately. Angular production build completed successfully.
