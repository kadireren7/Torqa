# Launch plan (0.1.6 growth sprint)

## Target users

- Automation teams operating n8n or JSON-based workflow stacks
- Platform / Ops teams responsible for workflow governance before release
- Security-minded engineering teams needing deterministic, inspectable pre-runtime checks

## One-sentence pitch

Torqa is a governance gate for automation workflows that scans exports before production and gives deterministic risk/policy decisions your team can act on.

## Product Hunt / Hacker News 5-sentence blurb

Torqa helps teams catch risky workflow changes before they reach production.  
Instead of executing automations, it analyzes workflow definitions and produces deterministic findings, trust score, and policy outcome.  
It works well for n8n users and platform teams that need explainable governance checks in CI or dashboard flows.  
You can scan, review, share reports, schedule recurring checks, and alert teams on high-risk outcomes.  
v0.1.6 also improves onboarding and release readiness for a cleaner first-user experience.

## 10 post ideas (X / LinkedIn)

1. "We built Torqa to answer one question before every automation release: should this workflow ship?"
2. "Torqa is intentionally not a runtime. We focus on deterministic workflow governance before execution."
3. "n8n users: scan your exported workflow JSON, get risk + policy summary, and share a report with your team."
4. "If your team reviews PRs but not workflow risk, Torqa gives you a repeatable pre-runtime gate."
5. "New in v0.1.6: first-user flow from upload › scan › report › schedule › alerts."
6. "Why deterministic matters: same workflow input should always produce the same governance result."
7. "Torqa demo report now includes risk score, policy status, findings, recommendations, and PDF export."
8. "We added TestPyPI-ready packaging so `pip install torqa` can become the default onboarding path."
9. "Platform teams: centralize workflow governance decisions without turning your tool into an orchestrator."
10. "Looking for 10 design partners using n8n/automation JSON at scale — we want blunt feedback."

## First 10-user feedback questions

1. What triggered you to try Torqa today?
2. Was it obvious what Torqa does in the first 15 seconds?
3. Which step felt unclear: upload, scan, review, share, schedule, or alerts?
4. Did the risk score and policy status feel trustworthy? Why or why not?
5. Which finding/recommendation was most actionable?
6. What blocked you from using this in a real workflow review?
7. Which integration or alert destination do you need next?
8. Would your team use share links or PDF export for stakeholder communication?
9. What would make Torqa worth paying for in a team context?
10. What is missing for production confidence?

## Launch checklist

- [ ] Landing copy aligns with "governance gate before production".
- [ ] Demo report page is reachable from landing and includes clear CTA to run own scan.
- [ ] Onboarding flow covers upload › scan › review › share › schedule/alert.
- [ ] Empty states provide first action on scan history, workflow library, alerts, schedules.
- [ ] README install and trust messaging are updated.
- [ ] Release docs include TestPyPI and manual publish checklist.
- [ ] Accessibility, lint, tests, and build checks are green.
- [ ] Founder/maintainer can run 2-minute demo script without setup surprises.
