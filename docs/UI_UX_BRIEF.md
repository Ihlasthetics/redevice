# ReDevice UI/UX brief

## Experience goal

The product should feel like a trustworthy device-inspection report, not a
crypto dashboard. A buyer should understand the result before noticing that Sui
is involved.

## Required screens

### Public passport

- device model and product image placeholder
- masked serial number
- current lifecycle condition
- verification level with plain-language explanation
- "verified history begins here" coverage date
- repair timeline
- evidence link and Sui Explorer link per verified record
- visible warning that earlier history is unknown
- no wallet requirement

### Repair workspace

- connected-wallet identity and authorization status
- selected device summary
- repair type, notes, previous/new lifecycle state
- optional battery health
- public-evidence file selection with privacy warning
- transaction states: ready, uploading, awaiting signature, submitting,
  confirmed, rejected

### Unauthorized result

- clearly say the wallet lacks permission
- show that the Move contract rejected the update
- do not frame it as a generic application error

## Visual direction

- editorial, calm and credible
- warm off-white background, near-black green text, restrained emerald accent
- generous spacing, clear hierarchy, subtle borders
- no neon gradients, crypto coins, chain illustrations, glassmorphism overload,
  or dense admin-dashboard grids
- badges must pair color with text/icon; color cannot be the only signal
- use sentence case, plain language and short labels

## Responsive and accessibility requirements

- support 375 px mobile through desktop
- minimum 44 px interactive targets
- keyboard-visible focus styles
- semantic headings and labels
- sufficient contrast
- reduced-motion friendly
- no horizontal scroll

## Integration boundary

Keep mock data in one typed file or adapter. Do not hard-code it throughout
components. The integration owner will replace that adapter with Sui object
queries later.

Do not change:

- `move/`
- root workspace configuration
- `web/src/dApp-kit.ts`
- `web/src/constants.ts`

without coordinating with the contract/integration owner.
