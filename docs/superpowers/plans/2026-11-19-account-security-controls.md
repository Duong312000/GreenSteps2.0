# Account Security Controls Implementation Plan

**Goal:** Complete the requested account security controls using the existing MongoDB session, passkey, audit, and email services.

**Architecture:** Keep existing bcrypt, JWT reset-token, session registry, WebAuthn, and audit services. Add OAuth password setup and verified email-change records; use a one-time email link for password recovery. Render the existing persisted API state in the profile security dashboard.

**Tech Stack:** Angular, Express, MongoDB model adapter, bcrypt, existing JWT/email services, WebAuthn.

## Scope

- P0: change password with current/new/confirm; set password for OAuth accounts; password reset email link; add/rename/delete passkeys; view/revoke sessions; revoke others or all sessions.
- P1: verify new email before changing it; full paginated login history with device, time, IP, and result; persisted security alert preference.
- Preserve all existing account, tour, booking, and session data. Keep MFA removed as directed.
- Reuse existing auth and session ownership checks; never accept request-supplied user IDs for account mutations.

## Tasks

1. Add regression tests for OAuth password setup, all-session revoke, and session detail fields; implement the API.
2. Add tests and implementation for hashed, expiring password reset links delivered by email; add the public reset-link route/page.
3. Add tests and implementation for account-scoped pending email changes, reauthentication, and verification email.
4. Add tests and UI wiring for full audit pagination, device detail, password confirmation/setup, reset-link status, and revoke-all. Verify the Angular build and account-security test suite.

## Review Focus

- Reset and email-change tokens are one-time, expiring, and stored only as hashes.
- Duplicate target emails never overwrite another account.
- Revoking every session also clears the current HttpOnly cookie.
- Failed email delivery does not report a successful request to a known account.
- Existing passkey, session, and alert preference ownership rules remain enforced.
