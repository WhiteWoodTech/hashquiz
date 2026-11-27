# Licensing

How HashQuiz is licensed, in plain language. The legal texts are in [`LICENSE.md`](../LICENSE.md) and
[`LICENSE_EE.md`](../LICENSE_EE.md).

> **Status: draft.** The model below is decided; the legal wording still has to be reviewed by a lawyer.

---

## The model: fair-code open-core

HashQuiz follows the same approach as n8n, Baserow and Strapi: one codebase, a free edition you can self-host,
and paid features unlocked by a license key.

| Tier | License | What it covers | Cost |
|------|---------|----------------|------|
| **Format & tooling** | MIT | `@hashquiz/parser` and the `.hashquiz.md` format, Claude skills and commands, MCP server | Free, no restrictions |
| **Product (Community)** | HashQuiz Sustainable Use License (fair-code) | Game engine, server, CLI, transports, UI, host and player apps | Free for the uses listed below |
| **Pro / Business / Enterprise** | HashQuiz Enterprise License | `packages/ee/` and `*.ee.*` files | License key required in production |
| **HashQuiz Cloud** | Terms of service | Hosted service (credits and subscriptions) | Paid |

Why this split:

- **The format is open** so that any tool (Slidev, editors, other quiz platforms, AI agents) can read and write
  `.hashquiz.md` files.
- **The product is fair-code** so that HashQuiz can be self-hosted for free, while nobody can resell it as a hosted
  service competing with HashQuiz Cloud.
- **Advanced features are licensed** to fund development.

## Wording

The product tier is **not** "open source" in the OSI sense, because it restricts commercial hosting. Say
"fair-code" or "source-available" for the server and apps. Only the MIT tier is open source.

---

## FAQ

### Can I self-host HashQuiz for free?

Yes. Running the Community edition on your laptop, on your LAN or on your own servers is free, with no limit on
players, quizzes or sessions.

### I'm a freelance trainer. Can I use HashQuiz in paid training sessions?

**Yes.** Hosting quiz sessions for your own audiences is allowed, including paid trainings, courses, workshops,
conferences and events that you deliver. You are selling your training, not HashQuiz.

### We are a training organization / school / company. Can we use it internally?

Yes. Using HashQuiz for your own trainers, students or employees is an internal business purpose.

### What is not allowed without a commercial agreement?

- Offering HashQuiz as a hosted or managed service where other people create and run their own quizzes on your
  deployment (a "HashQuiz-as-a-service"), paid or free.
- Selling, white-labeling or embedding HashQuiz in a product you offer to third parties.
- Removing or bypassing the license key checks.

Contact the licensor if you need one of these.

### Can I build a tool that reads or writes `.hashquiz.md` files?

Yes, and you are encouraged to. The parser and the format are MIT: you can use them in any project, including
commercial and closed-source ones.

### Can I modify the code?

Yes. You can modify the Community edition for any allowed use. You can modify Enterprise files for development and
testing; production use of Enterprise features needs a license key.

### What do the paid features include?

Planned for `packages/ee/`: game history and persistence, post-quiz analytics, results export, branding and
white-label, multi-host workspaces and shared deck libraries, assessment reports (Qualiopi evidence), SSO/SAML,
LMS/LTI integration, audit logs.

### Does the license key need internet access?

No. HashQuiz's main use case is offline LAN play. License keys are signed files (`license.txt` or the `HASHQUIZ_LICENSE`
environment variable) verified locally against a public key, with no network call.

### What about older versions?

Versions up to and including v2.0.0 were released under MIT and remain available under MIT.

### How do I contribute?

Contributions require signing the [Contributor License Agreement](../CLA.md), which lets the project keep offering
the code under these licenses.

---

## Open tasks

- [ ] Legal review of `LICENSE.md`, `LICENSE_EE.md` and `CLA.md`
- [ ] Decide the licensor entity (individual or company) and transfer the IP to the company before fundraising
- [ ] Implement offline license key verification in `packages/ee/`
- [ ] Set up a CLA bot on pull requests
- [ ] Write HashQuiz Cloud terms of service
