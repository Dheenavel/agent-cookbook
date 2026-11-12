# JEV Page Search

A Chrome extension that adds semantic search to any webpage using [JEV](https://typesafe.ai) — TypeSafeAI's decision model. Press `Ctrl+Shift+F` (or `Cmd+Shift+F` on Mac), type a question or phrase, and jump directly to the most relevant section on the page.

**Why this over Ctrl+F:** Ctrl+F matches exact keywords. This matches meaning. Ask "how do I handle authentication errors" and it finds the right section even if those exact words aren't there.

---

## How it works

1. You press the shortcut and type a query
2. The extension extracts text sections from the current page
3. Each section is scored by JEV: "how relevant is this to the query?"
4. The top 5 results appear ranked — click any to scroll directly to it
5. Only subject text is sent to JEV — no credentials, no personal data, no page metadata

---

## Setup

### What you need

- Chrome browser (or any Chromium-based browser)
- A JEV API token from [typesafe.ai](https://typesafe.ai)

### Step 1 — Get a JEV API token

1. Go to [typesafe.ai](https://typesafe.ai) and sign up
2. Navigate to **API Keys** in your dashboard
3. Click **Create key** — copy the token (starts with `ts_`)

### Step 2 — Load the extension in Chrome

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked**
4. Select the `jev/page-search/` folder from this repo
5. The JEV Page Search icon appears in your toolbar

### Step 3 — Add your token

1. Click the JEV Page Search icon in the Chrome toolbar
2. Paste your JEV API token into the field
3. Click **Save Token**

Done. Navigate to any page and press `Ctrl+Shift+F` to search.

---

## Usage

| Action | How |
|---|---|
| Open search | `Ctrl+Shift+F` (Windows/Linux) or `Cmd+Shift+F` (Mac) |
| Run search | Type query → press `Enter` or click **Search** |
| Navigate to result | Click the result row |
| Move between results | `↑` / `↓` arrow keys |
| Close | `Esc` or click outside the overlay |

If nothing relevant is found on the page, a "Search the web instead" link opens a Google search in a new tab.

---

## Shortcut conflict

`Ctrl+Shift+F` may conflict with browser DevTools or other extensions. To change it:

1. Go to `chrome://extensions/shortcuts`
2. Find **JEV Page Search**
3. Set a custom shortcut for **Toggle JEV page search overlay**

---

## Privacy

- Only the **text content of sections on the current page** (headings + body text) and your **query** are sent to the TypeSafeAI API for scoring
- Your token is stored in `chrome.storage.sync` — it syncs across your Chrome profile but never leaves Google's infrastructure unencrypted
- No browsing history, no personal data, no page URLs are sent to JEV

---

## Setting up with an AI assistant

If you get stuck, paste this entire README into Claude Code (or any AI assistant) and ask:

> "Help me set up the JEV Page Search Chrome extension. I'm on [Mac/Windows]. Walk me through each step."

The assistant can guide you through the Google Developer Mode toggle, loading unpacked, and troubleshooting shortcut conflicts.

---

## Troubleshooting

**Shortcut does nothing**
→ Check `chrome://extensions/shortcuts` — the shortcut may not be registered. Reassign it manually.

**"No API key set" error**
→ Click the extension icon and save your token. If you already did, try removing and re-adding it.

**"No readable content found"**
→ The page may be an SPA that hasn't fully rendered, or uses a canvas/iframe for content. Try waiting for the page to fully load.

**JEV API error 401**
→ Your token is invalid or expired. Generate a new one at [typesafe.ai](https://typesafe.ai).

**Results don't seem relevant**
→ Try rephrasing your query as a question or using more specific terms. JEV scores semantic relevance — the more specific the query, the better the results.
