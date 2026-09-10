# GmailBurner CLI

A lightweight command-line utility for generating disposable email inboxes, streaming incoming messages in real-time, and automatically extracting verification codes (OTPs) to the system clipboard.

---

## Features

- **Instant Provisioning**: Generates a functional disposable inbox in ~200ms with zero configuration or API keys required.
- **Real-Time Stream Listener**: Monitors the inbox continuously and surfaces new emails as they arrive.
- **OTP Extraction**: Scans subjects and message bodies for 4 to 8-digit verification codes and security PINs.
- **Clipboard Synchronization**: Automatically copies the generated email address upon creation, and copies detected OTP codes as soon as an email arrives.
- **Verification Link Detection**: Identifies and isolates email confirmation and magic login URLs.
- **Session Continuity**: Preserves the active inbox token locally in `.session.json` to allow restarting the tool without losing the active address.

---

## Prerequisites

- **Node.js**: v18.0.0 or higher
- **Windows / macOS / Linux**

---

## Installation & Usage

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the interactive listener:
   ```bash
   npm start
   ```
   *(Or double-click `Run-GmailBurner.bat` on Windows).*

The tool will:
1. Provision a disposable email address.
2. Copy the address to your clipboard.
3. Begin listening for incoming mail.
4. Extract verification codes and copy them to your clipboard when received.

---

## Commands

| Command | Description |
| :--- | :--- |
| `node index.js` | Resumes active session or provisions a new inbox and starts listening |
| `node index.js new` | Forces generation of a new burner inbox |
| `node index.js new <name>` | Provisions an inbox with a custom username prefix |
| `node index.js list` | Displays a table of all messages in the active inbox |
| `node index.js read <id>` | Displays message content, extracted OTP, and links |
| `node index.js copy` | Copies the active email address to your clipboard |
| `node index.js clear` | Discards the current session |

---

## Architecture

- `api.js`: Client for the disposable mail backend (account provisioning, auth tokens, message retrieval).
- `otp.js`: Regex engine for extracting verification codes and confirmation URLs.
- `clipboard.js`: Interface for clipboard synchronization.
- `index.js`: Terminal interface, polling loop, and message formatting.

---

## License

MIT License. For testing, privacy preservation, and development workflows.
