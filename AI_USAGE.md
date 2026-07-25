# AI usage disclosure

ReDevice uses ChatGPT Codex as a development assistant. The two team members
direct product decisions, review the generated work, run and verify the
application, test real wallet flows, and present the project.

## Initial scaffold

AI-assisted on 25 July 2026:

- repository and workspace structure
- conversion of the official Sui starter into the ReDevice monorepo
- placeholder landing shell and design tokens
- initial Move package boundary
- documentation, product specification and contribution workflow

The frontend began with Mysten Labs'
`@mysten/create-dapp@0.7.11` `react-e2e-counter` template. Reused setup:

- React, TypeScript, Vite and Tailwind configuration
- Mysten dApp Kit provider and wallet connection pattern
- Sui TypeScript code generation configuration
- small button/card utility patterns

Removed or replaced:

- all counter-specific Move and React behavior
- counter package IDs and generated bindings
- starter README and example copy

## Ongoing rule

For each AI-assisted milestone, append:

```text
Date:
Tool:
Human direction and decisions:
Files assisted:
Human verification:
```

Prompts that materially direct implementation belong in `specs/prompts/`.
Never include secrets or wallet recovery information in prompts or commits.
