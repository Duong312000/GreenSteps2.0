# GreenSteps Help Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive Vietnamese Help Center with real search, topic filters, locally authored guides, article routes, and working support navigation.

**Architecture:** Add a typed static article catalog and a customer-facing Angular page that renders index, filtered/search results, and article detail states from `/help-center` and `/help-center/:slug`. Add a minimal `/contact` destination that opens the existing AI chat, and integrate Help Center into the existing user header/footer without backend or database changes.

**Tech Stack:** Angular 21, TypeScript, Angular Router, standalone-independent components following `AppModule`, FormsModule, CSS, Vitest/Angular test setup.

**Spec:** `tmp/help-center-archive/GreenSteps_HelpCenter_Codex/CODEX_PROMPT.md`

## Global Constraints

- Use Vietnamese copy with correct accents and GreenSteps Travel branding.
- Recreate the supplied mockup with HTML/CSS; do not embed the mockup bitmap.
- Keep the six specified support topics and author 8–12 typed articles grounded in actual app behavior.
- Do not add a backend API, CMS, database, fabricated policy, fake popularity metrics, or dead `#` Help Center links.
- Preserve existing booking, account, wallet, tour, and chat behavior; avoid global styling changes.
- Follow responsive breakpoints: desktop, tablet, and mobile; support keyboard access and visible focus.

## Review Focus

- Vietnamese accent-insensitive search, including `đ` normalization and empty/no-results states.
- Unknown article slug and browser back/forward navigation.
- Topic filtering combined with search and reset-to-all navigation.
- Contact CTA accurately describes the existing AI chat and does not imply a human ticket was submitted.
- Responsive layouts and keyboard operation of search, topic cards, and article navigation.

---

### Task 1: Typed help content and search behavior

**Files:**
- Create `my-app/src/app/pages/help-center/help-center-content.ts`
- Create `my-app/src/app/pages/help-center/help-center-content.spec.ts`

**Interfaces:** Export `HelpTopicId`, `HelpArticle`, `HELP_TOPICS`, `HELP_ARTICLES`, `normalizeHelpText(value: string): string`, and `searchHelpArticles(query: string, articles?: readonly HelpArticle[]): HelpArticle[]`.

- [ ] Write tests for Vietnamese normalization, keyword/body matching, empty query, and all six topics having 8–12 categorized articles.
- [ ] Run focused tests and confirm they fail before implementation.
- [ ] Implement typed content and accent-insensitive search, including `đ`/`Đ` normalization.
- [ ] Run focused tests and confirm they pass.

### Task 2: Help Center routes and page interactions

**Files:**
- Create `my-app/src/app/pages/help-center/help-center.ts`
- Create `my-app/src/app/pages/help-center/help-center.html`
- Create `my-app/src/app/pages/help-center/help-center.css`
- Create `my-app/src/app/pages/help-center/help-center.spec.ts`
- Modify `my-app/src/app/app-module.ts`
- Modify `my-app/src/app/app-routing-module.ts`

**Interfaces:** The page consumes `HELP_TOPICS`, `HELP_ARTICLES`, `searchHelpArticles`; routes are `/help-center`, `/help-center/:slug`, and `/contact`.

- [ ] Test topic filtering, result selection, no-results state, article detail, and unknown slug handling.
- [ ] Run focused tests and confirm they fail before implementation.
- [ ] Implement responsive hero, topic cards, featured guide cards, search suggestions/results, detail view, and valid navigation links.
- [ ] Run focused tests and confirm they pass.

### Task 3: Contact destination and shared navigation

**Files:**
- Create `my-app/src/app/pages/help-center/contact.ts`
- Create `my-app/src/app/pages/help-center/contact.html`
- Create `my-app/src/app/pages/help-center/contact.css`
- Create `my-app/src/app/services/support-chat-launcher.service.ts`
- Modify `my-app/src/app/components/greensteps-chat/greensteps-chat.component.ts`
- Modify `my-app/src/app/components/header/header.html`
- Modify `my-app/src/app/components/footer/footer.html`

- [ ] Test that the contact CTA emits a request to open the existing chat and navigation links point to valid routes.
- [ ] Run focused tests and confirm they fail before implementation.
- [ ] Implement the accurate contact destination and add header/footer links with active route state.
- [ ] Run focused tests and confirm they pass.

### Task 4: Project verification

**Files:** No additional files.

- [ ] Run `npm run build` from `my-app`.
- [ ] Run focused Help Center tests and the project test script if feasible.
- [ ] Check available scripts; report that no lint script exists if still absent.
- [ ] Review changed files for route validity, dead Help Center links, incorrect Vietnamese accents, and unintended changes to other modules.
