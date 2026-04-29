# Demo script (2 minutes)

## Goal

Show a first-time user how Torqa gives confidence before workflow release.

## Pages to show

1. Landing (`/`)
2. Demo report (`/demo/report`)
3. Scan page (`/scan`)
4. Scan history (`/scan/history`)
5. Schedules (`/schedules`) or Alerts (`/alerts`)

## 2-minute flow

### 0:00 - 0:20 — Problem framing on landing

"Torqa is a governance gate for automation workflows before production. We do not run your workflows; we analyze them and explain risk and policy outcomes."

### 0:20 - 0:55 — Demo report walkthrough

- Open `/demo/report`
- Point at risk score + policy status + findings list
- Open one finding and show recommendation
- Click **Export PDF** to show stakeholder-friendly output

Talk track:
"This is the format teams review before rollout: deterministic score, explainable findings, and clear next actions."

### 0:55 - 1:25 — Run your own workflow

- Jump to `/scan`
- Mention upload/paste JSON input and source selector
- Trigger scan and show status outcome

Talk track:
"You can test any n8n or generic workflow JSON. Torqa gives the same result for the same input, so reviews stay stable."

### 1:25 - 1:45 — Save/share + history

- Open `/scan/history`
- Show saved report and reopen behavior

Talk track:
"Reports are not throwaway logs. Teams can reopen and share the same snapshot for triage or release review."

### 1:45 - 2:00 — Automate monitoring

- Open `/schedules` (or `/alerts`)
- Show recurring scan or destination setup CTA

Talk track:
"After first scan, teams usually set schedules and alerts so risky changes are caught automatically."

## Close line

"Torqa helps automation, n8n, and platform teams decide before production — with deterministic analysis and inspectable reasons."
