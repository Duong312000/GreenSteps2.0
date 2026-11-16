# Home Destination Carousel Design

## Intent

Expand the home page destination carousel from six catalog destinations to nine places that already have service data. Replace the mountain placeholders with photographs of each place's best-known landmark and make card changes feel smooth on desktop and touch screens.

## Scope and constraints

- Use the six destinations in the national catalog plus Hà Giang, Đà Nẵng, and Hội An, which already appear in service data.
- Curate one locally bundled cover photograph per destination. Keep image source, license, and alt text in a small local metadata catalog where available.
- Preserve the current three-card desktop carousel, dots, keyboard-operable buttons, and swipe behavior. Each selected destination opens the matching service filter.
- Add no destination records to Atlas and change no other database data.
- Respect reduced-motion settings and keep the cards usable at mobile widths.

## Approaches

1. Keep six cards and only repair the images. This stays exactly aligned to the destination catalog but does not add the requested places.
2. Add all nine places already backed by service records, using curated landmark photos and a matching services filter. **Selected:** it adds useful places without introducing destinations that have no matching GreenSteps inventory.
3. Add twelve editorial destinations, including places without service records. This gives a longer carousel but can send users to empty results, so it is out of scope.

## Design direction

Keep GreenSteps' forest, warm limestone, and editorial serif identity. Let the real landmark photograph carry the card. Animate position, scale, and a slight perspective shift together; keep side cards quieter than the active center card. Use a restrained easing curve, preserve the existing arrows and pagination, and remove movement when reduced motion is enabled.

## Content and navigation

The nine cards are Đà Lạt, Đà Nẵng – Hội An, Ninh Bình, Phú Quốc, Phú Yên, Sa Pa, Hà Giang, Đà Nẵng, and Hội An. Select an iconic location for each cover: local verified assets for destinations already represented in the image library, and licensed Wikimedia Commons photos for missing landmark imagery. Use a services destination filter so each new card can show the services already present for that place.

## Acceptance

- Nine cards are reachable using arrows, dots, keyboard, and horizontal swipe.
- The three visible desktop cards and single active mobile card show the correct destination photograph and alt text.
- Transitions remain fluid at wraparound and follow `prefers-reduced-motion`.
- Every card opens its matching service results; no destination records or business data are changed.
