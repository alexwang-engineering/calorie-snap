# Security Policy

## Supported versions

This is an actively developed portfolio project. Security fixes are applied to
the latest state of `main`.

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue for
anything security-sensitive.

- **Preferred:** use GitHub's private vulnerability reporting on this repository
  (**Security → Report a vulnerability**, or
  [open a draft advisory](https://github.com/alexwang-engineering/calorie-snap/security/advisories/new)).
- **Alternatively:** contact the maintainer through their
  [GitHub profile](https://github.com/alexwang-engineering).

Please include the affected commit, a description of the issue, reproduction
steps, and the impact you observed. You can expect an acknowledgement within a
few days.

## Handling secrets

The Anthropic API key is **never** shipped to the client. It is held only by the
local proxy (`server/proxy.mjs`), which the browser calls through a relative
`/api` path.

- Copy `.env.example` to `.env` and put your `ANTHROPIC_API_KEY` there. `.env` is
  gitignored — **never commit it**.
- If a key is ever exposed, rotate it immediately in the Anthropic console.

## Security model

- **Local-first storage.** Meal entries persist in the browser's `localStorage`;
  there is no backend database or account system.
- **Human-in-the-loop AI.** The natural-language parser returns a draft the user
  confirms before anything is saved — model output is never auto-committed.
- A high-severity `npm audit`, lint and production build run in CI
  ([`ci.yml`](.github/workflows/ci.yml)) on every push and pull request.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how the proxy, client and
platform shells fit together.
