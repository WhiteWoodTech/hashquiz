# @quizv/ee

Pro, Business and Enterprise features for QuizV, licensed under the [QuizV Enterprise License](LICENSE).

**Production use requires a valid license key.** Development and testing are free. See
[`docs/LICENSING.md`](../../docs/LICENSING.md).

## Status

Placeholder: no feature is implemented yet. This directory reserves the location and the license of the paid
features so that they never mix with the fair-code or MIT code.

## Planned features

| Feature | Plan |
|---------|------|
| Offline license key verification (signed file, public key) | All paid plans |
| Game history and persistence | Pro |
| Post-quiz analytics and results export (JSON/CSV) | Pro |
| Branding and white-label | Pro |
| Multi-host workspace and shared deck library | Business |
| Assessment reports (Qualiopi evidence) | Business |
| SSO/SAML, LMS/LTI, audit logs | Enterprise |

## Rules

- Enterprise code lives in this package, or in files named `*.ee.ts` / `*.ee.vue`.
- Fair-code and MIT packages must not import from `@quizv/ee` directly: they expose extension points that
  `@quizv/ee` plugs into when a valid license key is present.
- The MIT packages (`@quizv/parser`, skills, MCP) must never depend on fair-code or Enterprise code.
