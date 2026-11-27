# HashQuiz licensing

> **DRAFT — not yet reviewed by a lawyer.** The texts below describe the intended licensing model.
> They must be reviewed before the repository is made public.

HashQuiz is **fair-code open-core**. The repository contains code under three licenses.
See [`docs/LICENSING.md`](docs/LICENSING.md) for a plain-language FAQ.

| Tier | License | Applies to |
|------|---------|------------|
| Format & tooling | [MIT](packages/parser/LICENSE) | `packages/parser/` (the `.hashquiz.md` format), `.claude/plugins/hashquiz/` (Claude skills and commands), and any future MCP server package marked MIT |
| Product | **HashQuiz Sustainable Use License** (below) | Everything else, unless stated otherwise: `packages/core`, `packages/server`, `packages/transport-*`, `packages/ui`, `packages/theme-default`, `apps/host`, `apps/player`, `decks/`, `examples/` |
| Pro / Enterprise | [HashQuiz Enterprise License](LICENSE_EE.md) | `packages/ee/`, and any file whose name contains `.ee.` or whose path contains a `.ee` directory |

When a directory contains its own `LICENSE` file, that file takes precedence for its contents.

Versions of HashQuiz released before this change (up to and including v2.0.0) remain available under the MIT license.

---

## HashQuiz Sustainable Use License

Version 1.0 (draft)

Copyright (c) 2024-present Maxime Lenne

### Acceptance

By using the software, you agree to all of the terms and conditions below.

### Copyright license

The licensor grants you a non-exclusive, royalty-free, worldwide, non-sublicensable, non-transferable license to
use, copy, distribute, make available, and prepare derivative works of the software, in each case subject to the
limitations below.

### Limitations

1. You may use or modify the software only:
   - for your own internal business purposes;
   - for personal or non-commercial purposes; or
   - to host and run quiz sessions for your own audiences — including paid trainings, courses, workshops,
     conferences and events that you or your organization deliver.
2. You may not provide the software to third parties as a hosted or managed service, where those third parties
   create, host or run their own quizzes or quiz sessions through your deployment of the software, whether or not
   you charge for it.
3. You may not sell, resell, rent, white-label or embed the software, or a derivative work of it, in a product or
   service offered to third parties, except under a separate commercial agreement with the licensor.
4. You may distribute the software or provide it to others only if you do so free of charge for non-commercial
   purposes.
5. You may not alter, remove, or obscure any licensing, copyright, or other notices of the licensor in the
   software, and you may not move, change, disable, or circumvent the license key functionality.

### Notices

You must ensure that anyone who gets a copy of any part of the software from you also gets a copy of these terms.
If you modify the software, you must include in any modified copies a prominent notice stating that you have
modified the software.

### Patents

The licensor grants you a license, under any patent claims the licensor can license or becomes able to license,
to make, have made, use, sell, offer for sale, import and have imported the software, in each case subject to the
limitations and conditions in this license. This license does not cover any patent claims that you cause to be
infringed by modifications or additions to the software. If you or your company make any written claim that the
software infringes or contributes to infringement of any patent, your patent license for the software granted
under these terms ends immediately.

### No other rights

These terms do not imply any licenses other than those expressly granted in these terms.

### Termination

If you use the software in violation of these terms, such use is not licensed, and your license will automatically
terminate. If the licensor provides you with a notice of your violation, and you cease all violation of this
license no later than 30 days after you receive that notice, your license will be reinstated retroactively.
However, if you violate these terms after such reinstatement, any additional violation of these terms will cause
your license to terminate automatically and permanently.

### No liability

As far as the law allows, the software comes as is, without any warranty or condition, and the licensor will not
be liable to you for any damages arising out of these terms or the use or nature of the software, under any kind
of legal claim.

### Definitions

- The **licensor** is the entity offering these terms.
- The **software** is the software the licensor makes available under these terms, including any portion of it.
- **You** refers to the individual or entity agreeing to these terms.
- **Your company** is any legal entity, sole proprietorship, or other kind of organization that you work for, plus
  all organizations that have control over, are under the control of, or are under common control with that
  organization. Control means ownership of substantially all the assets of an entity, or the power to direct its
  management and policies by vote, contract, or otherwise.
- **Your license** is the license granted to you for the software under these terms.
- **Use** means anything you do with the software requiring your license.
- **Trademark** means trademarks, service marks, and similar rights.
