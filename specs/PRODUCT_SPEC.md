# ReDevice MVP specification

## Problem

A refurbished-device buyer often sees repair claims but cannot tell who made
them, whether the repairer was authorized to make a verified claim, or whether
the supporting evidence was later replaced.

## Product promise

ReDevice proves which authorized repairer attested to a repair, when the
attestation occurred, and which public evidence supports it. It does not claim
to cryptographically prove that physical work happened.

## Users

- Refurbished laptop seller: creates or presents a passport.
- Authorized repairer: appends verified service records.
- Buyer: reads the public passport without a wallet.
- Prototype administrator: grants and revokes repairer authorization.

## Required demo flow

1. Scan a QR code on a physical laptop.
2. Open the passport without connecting a wallet.
3. See the model, masked serial, verified coverage date, current condition,
   verification level, and repair timeline.
4. Connect an authorized repairer wallet.
5. Add a battery replacement with 96% health.
6. Attach public, non-sensitive evidence stored on Walrus.
7. Confirm a real Sui testnet transaction.
8. Refresh the passport and see the new record.
9. Attempt the same action with an unauthorized wallet.
10. Show Move rejecting it and open the successful transaction in Sui Explorer.

## Trust boundaries

- A repair record proves an attestation, not the physical repair itself.
- History before the coverage start date is explicitly unknown.
- A copied QR remains possible; the buyer compares the masked serial with the
  physical device.
- Walrus evidence must never contain full serial numbers, invoices, customer
  names, addresses, private documents, recovery phrases, or private keys.

## Out of scope for the hackathon MVP

- marketplace
- AI features
- backend database
- zkLogin, Seal or unrelated sponsor integrations
- production manufacturer onboarding
- ownership transfer unless the core demo is complete
