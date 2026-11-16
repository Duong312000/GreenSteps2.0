# Header account actions design

## Intent
Remove search fields from the header and make account controls clear for guests and signed-in travelers.

## Goals and constraints
- No search input in the desktop header or mobile navigation drawer.
- Guests do not see the notification bell; signed-in users do, including on mobile.
- Keep registration, login, partner entry, profile access, and existing notification behavior.
- Preserve GreenSteps' existing colors, typography, and responsive header structure.

## Approaches
- Keep the search field and squeeze account controls: rejected because the search currently crowds the right side.
- Remove header searches and give the freed space to account controls: selected because the home page already provides trip search and this fixes both account states.
- Remove account actions and move them all into the mobile drawer: rejected because it hides useful desktop entry points.

## Layout
Desktop guests see registration, a prominent login action, and partner entry. Signed-in users see the notification bell, profile control, and partner entry when eligible. On mobile, the bell remains beside the menu button only for signed-in users; account actions remain in the drawer.

## Out of scope
Search on the tours page and trip-search form behavior remain unchanged.
