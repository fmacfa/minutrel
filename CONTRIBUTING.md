# Contributing to Minutrel

Minutrel V0.1 is a functional test prerelease. Start with the [English user guide](docs/guide/en/README.md), the [requirements](docs/CAHIER_DES_CHARGES.md) and the [backlog](docs/BACKLOG.md). The latter two documents are currently in French.

## Language

Use **English** for the main README, public issue and pull request titles and descriptions, contribution guidance and new public documentation. French and German translations are welcome. Preserve existing translations and their links. User content, such as project names, subcategories and work descriptions, must never be translated automatically.

## Propose a change

Open an issue for a feature or scope change. Describe the need, user role, affected platforms and relevant F, R or Q requirements. A small documentation correction can go directly into a pull request.

Use a short-lived branch and clear commit messages. A pull request explains the problem, resulting behaviour and checks actually run. Any calculation change must describe its effect on existing time entries and exports. Preserve compatibility with existing `tasks`/`taskId` API data when working on project subcategories.

## Checks

```sh
npm run check
python3 scripts/check_repository.py
python3 scripts/check_brand.py
```

`npm run check` runs formatting, linting, strict types, coverage tests and web/API builds. The Python commands check documentation links, fixtures and brand assets. Native and container checks are described in [CI](docs/CI.md); the [acceptance plan](docs/RECETTE.md) covers critical user journeys. Both are currently in French.

## Data, dependencies and licences

Use fictional examples only. Never commit real databases, tokens, private certificates, team exports or passwords. New dependencies need compatible documented licences and pinned versions.

Contributions use the project’s AGPL-3.0-or-later licence. Third-party resources retain their notices and conditions.
