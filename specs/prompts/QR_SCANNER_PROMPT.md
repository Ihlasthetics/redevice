# QR passport scanner direction

Date: 25 July 2026

The frontend owner requested a camera-based QR scanner for both public users and
repairers.

Required behavior:

- request browser camera access only when the user starts scanning
- read a device QR code and show its ReDevice passport in the website
- allow public users to see only public device information
- use the connected wallet identity as the future source of the repairer role
- show additional technical repair details only after the wallet is confirmed as
  an authorized repairer
- keep the implementation frontend-only until the authorization and data backend
  are integrated

Security/product decision:

The QR code should carry only a device identifier or passport URL, not
repairer-only information. The frontend must not treat a connected wallet as
authorized until the real contract or API check confirms it.
