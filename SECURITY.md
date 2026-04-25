# Security policy

## Supported versions

Security fixes are applied to the **default branch** (`main`) and released according to [Releasing](docs/releasing.md). There is no separate LTS line while the project is **v0.x**.

## Reporting a vulnerability

Please **do not** file a public GitHub issue with exploit details.

1. Open a **[GitHub Security Advisory](https://github.com/kadireren7/Torqa/security/advisories/new)** for this repository (preferred), **or**
2. Contact repository maintainers through a **private** channel if one is published in the org or user profile.

Include: affected **version** or **commit**, **reproduction** steps, and **impact** (e.g. arbitrary code execution vs. information disclosure). We aim to acknowledge reasonable reports within a few business days; depth of triage depends on maintainer capacity.

## Scope notes

Torqa is a **local CLI and library** — it does **not** execute workflows, open network listeners, or host a service in this repository. Reports about **third-party integrations** (CI, PyPI, dashboards) should name the component and reproduction path clearly.
