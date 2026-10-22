# Phase 1 dependency freeze

Verified 2026-10-22, Asia/Kuala_Lumpur, against the official Node release index and public npm registry package metadata. The user approved the existing Next.js/TypeScript/PostgreSQL, Auth.js/Drizzle, validation, testing and lint/format tool choices. These exact package pins implement that choice; no new application feature or hosted service is selected.

## Exact versions for the first install

| Runtime package       | Version       |
| --------------------- | ------------- |
| Node.js               | 24.22.1 LTS   |
| next                  | 16.4.2        |
| react / react-dom     | 19.3.1        |
| next-auth             | 5.0.0-beta.32 |
| @auth/drizzle-adapter | 1.11.3        |
| drizzle-orm           | 0.45.4        |
| pg                    | 8.23.1        |
| zod                   | 4.6.7         |
| server-only           | 0.0.1         |

| Development package             | Version |
| ------------------------------- | ------- |
| typescript                      | 6.0.3   |
| @types/node                     | 24.19.2 |
| @types/react / @types/react-dom | 19.3.0  |
| @types/pg                       | 8.23.1  |
| drizzle-kit                     | 0.31.11 |
| prettier                        | 3.9.10  |
| vitest                          | 5.0.5   |
| @playwright/test                | 1.64.1  |
| eslint                          | 10.13.0 |
| typescript-eslint               | 8.72.0  |
| @next/eslint-plugin-next        | 16.4.2  |

Vite is Vitest's required peer; npm will resolve and lock its compatible transitive version. No separate script runner is needed: the approved Node 24 runtime can execute the limited TypeScript syntax used by local scripts.

## Compatibility decisions and evidence

Auth.js beta 32 accepts Next 16/React 19; it and adapter 1.11.3 depend on `@auth/core 0.41.3`. Its beta status remains the approved risk. [Auth metadata](https://registry.npmjs.org/next-auth/5.0.0-beta.32), [adapter metadata](https://registry.npmjs.org/@auth%2fdrizzle-adapter/1.11.3).

TypeScript 7 is outside typescript-eslint's `<6.1.0` peer range. Version 6.0.3 satisfies that range. ESLint 9 is EOL, while `eslint-config-next 16.4.2` pulls React/import/accessibility plugins whose peer ranges stop at 9. The approved design requires ESLint but does not prescribe `eslint-config-next`; use supported ESLint 10 with compatible TypeScript rules and the Next plugin directly. This resolves configuration within the approved tooling without a stack change or forced peer override. Actual install/lint/typecheck still must demonstrate compatibility. [TypeScript rules metadata](https://registry.npmjs.org/typescript-eslint/8.72.0), [ESLint support](https://eslint.org/version-support/), [Next plugin metadata](https://registry.npmjs.org/@next%2feslint-plugin-next/16.4.2).

Next 16.4.2 is beyond the 16.4.1 release fixing the October 14 security issues. A read-only npm advisory query found no results for the selected direct versions and a few known transitive versions; that is not a complete dependency audit. Audit the actual lockfile after installation. [Official security update](https://nextjs.org/blog/nextjs-security-update-october-14-2026), [Node release index](https://nodejs.org/dist/index.json).

No application package has been installed at this freeze checkpoint. Keep exact direct versions and commit the resulting lockfile; do not silently upgrade versions during later tasks.
