# EVE Frontier — Intrusion Detection System (IDS)

A 24/7 base monitoring tool for **EVE Frontier** that alerts you when your base is under attack — even when you are offline.

## Features

- 🚨 **Player attack detection** — instant alerts when a player attacks you or your base
- 🔫 **Turret firing alerts** — know when your base defences engage an intruder
- 🏗️ **Structure monitoring** — detects when structures go offline or are unanchored
- ⛽ **Fuel warnings** — alerts before your network node runs out of fuel
- 💥 **Killmail detection** — notified if a structure is destroyed
- 📡 **Discord integration** — get phone notifications even while offline
- ⛓️ **Blockchain powered** — reads directly from the Sui testnet, works 24/7
- 🔐 **Secure login** — connect via EVE Vault wallet, no passwords or seed phrases needed

## Download

### Latest Release — v0.1.0

| Platform | Download |
|----------|----------|
| Linux | [eve-frontier-ids-linux-v0.1.0.zip](https://github.com/Neural-Weave/eve-frontier-ids/releases/download/v0.1.0/eve-frontier-ids-linux-v0.1.0.zip) |
| Windows | [eve-frontier-ids-windows-v0.1.0.zip](https://github.com/Neural-Weave/eve-frontier-ids/releases/download/v0.1.0/eve-frontier-ids-windows-v0.1.0.zip) |

## Quick Start

### Linux
1. Download and unzip the Linux release
2. Open a terminal in the extracted folder
3. Run: chmod +x START.sh
4. Run: ./START.sh
5. Your browser will open automatically
6. Install EVE Vault extension (see Requirements)
7. Click Connect EVE Vault and approve the connection

### Windows
1. Download and unzip the Windows release
2. Double click START.bat
3. If Windows Defender warns you click More info then Run anyway
4. Your browser will open automatically
5. Install EVE Vault extension (see Requirements)
6. Click Connect EVE Vault and approve the connection

## Requirements

### EVE Vault Browser Extension
Required for secure wallet authentication. No passwords or seed phrases ever needed.

1. Download from: https://github.com/evefrontier/evevault/releases/latest/download/eve-vault-chrome.zip
2. Unzip the file
3. Open brave://extensions or chrome://extensions
4. Enable Developer Mode (top right)
5. Click Load unpacked and select the unzipped folder
6. Sign in with your EVE Frontier account and set your PIN

Works in Brave, Chrome, Chromium, and any Chromium-based browser.

## Discord Alerts (Optional)

Get phone notifications when your base is attacked even while offline.

1. In Discord go to your server, pick a channel, then Settings, Integrations, Webhooks, New Webhook
2. Copy the webhook URL
3. Open .env in the app folder with a text editor
4. Add your URL: DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
5. Save and restart the app

## How It Works

The IDS monitors your base through two data sources:

Blockchain 24/7 — Polls the EVE Frontier Sui testnet every 30 seconds for turret aggression events, structure status changes, killmail events and fuel levels.

Game Logs when online — Reads your local EVE Frontier log files for real-time combat events, NPC and player damage and weapon fire events.

When you connect your EVE Vault wallet the app automatically discovers all your deployed structures with no manual configuration needed.

## Building from Source

Requirements: Node.js 20+, npm

git clone https://github.com/Neural-Weave/eve-frontier-ids.git
cd eve-frontier-ids
npm install
cd frontend && npm install && npm run build && cd ..
npm start

Then open http://localhost:3001/vault/ in your browser.

## Roadmap

- v0.2.0 — Discord settings UI (no manual .env editing)
- v0.3.0 — Electron desktop app (no browser needed)
- v0.4.0 — System tray integration
- v0.5.0 — Per-channel Discord alerts by severity
- v0.6.0 — Structure HP/damage tracking (pending CCP API)
- v0.7.0 — Corp/alliance shared alert channels
- v1.0.0 — Full release with auto-updater

## Contributing

Pull requests welcome. Please open an issue first to discuss what you would like to change.

## Disclaimer

This is an unofficial community tool and is not affiliated with CCP Games. EVE Frontier is a trademark of CCP hf. Use at your own risk.

## License

MIT
