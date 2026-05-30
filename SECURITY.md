# Security Policy

## Supported Versions

EVE Frontier IDS is currently in early access. Only the latest release is supported.

| Version | Supported |
|---------|-----------|
| v0.1.x  | ✅ Yes    |
| < v0.1  | ❌ No     |

> **Note:** This tool runs against the EVE Frontier testnet (Stillness). It is not yet intended for production or high-security environments.

---

## Reporting a Vulnerability

If you discover a security vulnerability in EVE Frontier IDS, please **do not open a public GitHub issue**.

Instead, use GitHub's built-in private reporting:

**[Report a vulnerability →](https://github.com/Neural-Weave/eve-frontier-ids/security/advisories/new)**

Please include:
- A description of the vulnerability and its potential impact
- Steps to reproduce
- Any suggested fixes if you have them

I'll aim to respond within **7 days** and will keep you updated as the issue is investigated and resolved.

---

## Scope

**In scope:**
- The EVE Frontier IDS application (backend, frontend, chain poller, log parser)
- The wallet connect flow and how wallet addresses are stored locally

**Out of scope:**
- EVE Frontier itself (report to CCP Games)
- The Sui blockchain or EVE Vault extension (report to Mysten Labs / CCP)
- Third-party dependencies (report upstream)

---

## Notes

EVE Frontier IDS is a solo open-source project. There is no bug bounty programme, but all genuine reports are appreciated and will be taken seriously. Credit will be given to reporters in release notes unless anonymity is requested.
