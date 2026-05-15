# Demo script (2 minutes)

## Goal

Show an early technical user what Torqa does, help them reach a first meaningful report quickly, and end on the obvious next step: connect a real source.

## Recommended pages

1. Landing (`/`)
2. Overview (`/overview`)
3. Demo scan (`/scan?sample=customer_support_n8n&source=n8n`)
4. Optional: Demo report (`/demo/report`)
5. Sources (`/sources`)

## 2-minute flow

### 0:00 - 0:20 � Problem framing on landing

Talk track:

> Torqa scans automation workflows before they run. It does not execute them. It gives a deterministic report with findings, trust score, and policy outcome so teams can decide before rollout.

Point to the two public-alpha actions:

- **Connect a source**
- **Try demo**

### 0:20 - 0:40 � Overview as the starting point

- Open `/overview`
- Show the one-sentence explanation
- Show the start paths: `Connect n8n`, `Connect GitHub Actions`, `Try demo workflow`, `Advanced manual scan`

Talk track:

> A first user should understand the product in one screen and choose between a real integration path and a demo path.

### 0:40 - 1:20 � Demo scan to first report

- Click **Try demo scan**
- Show the preloaded sample and the notice that tells the user what to do next
- Click **Run scan**
- Open one finding and show the recommendation

Talk track:

> This is the fastest route to value: load a sample, run the scan, review the report, and see the next action. Same input, same result.

### 1:20 - 1:40 � Report output

- Point at trust score, policy result, findings, and recommendation panel
- If useful, show `/demo/report` as the static public example

Talk track:

> Torqa is trying to be useful, not magical. It shows why a workflow is risky and what to do next.

### 1:40 - 2:00 � Move to a real source

- Open `/sources`
- Show `n8n` and `GitHub Actions` as the main real paths
- Mention local demo mode honestly if cloud setup is missing

Talk track:

> After the first report, the next step is to connect a real source so scans and reports keep updating automatically.

## Close line

> Torqa helps automation, platform, and security teams review workflows before production with deterministic findings and clear policy decisions.
