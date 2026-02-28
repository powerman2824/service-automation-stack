# Service Automation Stack (Demo-First)

A modern, responsive website template for local service businesses with a **quote form**, **automation-ready payloads**, and a **session-only demo CRM portal** (no backend required).

This repo is designed to be:
- **Safe to host publicly** (Demo Mode sends nothing by default)
- **Easy to rebrand** (single `SITE_CONFIG` block)
- **Easy to upgrade** (Live Mode: Formspree / webhooks / future “Pro Mode”)

## Live Demo
- Public site: https://powerman2824.github.io/service-automation-stack/

---

## What’s Included

### ✅ Customer-facing site
- Responsive landing page
- Services section
- Quote form with clean UX
- Automation-friendly hidden fields:
  - `compiledMessage` (human readable)
  - `payload_json` (machine readable)

### ✅ Admin Portal (Demo)
A fake CRM dashboard at `frontend/admin.html` that shows leads **only from the current browser session**.

**Important:** Demo leads are stored in `sessionStorage` only.
- No database
- No server
- No PII exposed publicly
- Closing the tab clears the demo “CRM”

---

## Demo Mode vs Live Mode

### Demo Mode (default)
- Form action is `__DEMO__`
- Submissions are captured into session-only “CRM”
- **Nothing is sent externally**

Use this when hosting publicly or sharing as a template.

### Live Mode (optional)
Change the endpoint to Formspree (or a webhook):
- Update `window.SITE_CONFIG.formEndpoint`
- Update the `<form action="...">`

In Live Mode the form:
1) still saves the session demo lead (so the Admin Portal works)
2) also sends the submission to Formspree

---

## Quick Start (Local)

### Option A: VS Code Live Server
1. Open the repo in VS Code
2. Install the “Live Server” extension
3. Right click `frontend/index.html` → **Open with Live Server**

### Option B: Python simple server
From repo root:
```bash
cd frontend
python3 -m http.server 8080