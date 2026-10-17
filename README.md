<div align="center">

<img src="https://fxapis.com/logo.png" alt="" width="72" height="72">

# fxapis integrations

**A Postman collection, TradingView alert payloads, and automation templates for the fxapis MetaTrader 5 REST API**

[Website](https://fxapis.com) · [Docs](https://docs.fxapis.com) · [API Reference](https://docs.fxapis.com/api-reference) · [Status](https://status.fxapis.com) · [Support](mailto:support@fxapis.com)

[![License: MIT](https://img.shields.io/badge/license-MIT-22D3D6?style=flat-square)](LICENSE)
[![check](https://img.shields.io/github/actions/workflow/status/FXapis/fxapis-integrations/check.yml?branch=main&style=flat-square&label=check)](https://github.com/FXapis/fxapis-integrations/actions/workflows/check.yml)
[![Postman Collection v2.1](https://img.shields.io/badge/Postman-Collection%20v2.1-FF6C37?style=flat-square&logo=postman&logoColor=white)](postman/)
[![fxapis status](https://status.fxapis.com/badge.svg)](https://status.fxapis.com)

</div>

---

Point-and-click and low-code ways into **[fxapis](https://fxapis.com)**, the hosted MetaTrader 5 REST API — for exploring the API, wiring TradingView alerts to MT5 orders, and automating with n8n. If you're writing code instead, see [`fxapis-examples`](https://github.com/FXapis/fxapis-examples), [`fxapis-typescript`](https://github.com/FXapis/fxapis-typescript) and [`fxapis-python`](https://github.com/FXapis/fxapis-python).

## Table of contents

- [Postman collection](#postman-collection)
- [TradingView alert payloads](#tradingview-alert-payloads)
- [n8n templates](#n8n-templates)
- [The rules that keep money safe](#the-rules-that-keep-money-safe)
- [Related fxapis repositories](#related-fxapis-repositories)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)

## Postman collection

[`postman/fxapis.postman_collection.json`](postman/fxapis.postman_collection.json) — a Postman
Collection v2.1 covering **every public endpoint** of the fxapis REST API: connecting accounts,
bringing them online, balance, equity and margin, live prices, market and pending orders, positions, order and deal history,
multi-account orders (waves), copy trading, webhook endpoints and their delivery logs, billing, API keys and health checks. Generated from the
live [OpenAPI spec](https://api.fxapis.com/docs/json), with one folder per API section and a
ready-to-send example body on every request that takes one.

**Import:** Postman → **Import** → select the file. Then open the collection's **Variables** and
set `apiKey` (your `fx_test_…` or `fx_live_…` key) and the id variables (`accountId`,
`positionId`, `webhookId`, …) as you go. Full setup, and how the pre-request script fills in a fresh
`Idempotency-Key` on every POST/PATCH: [`postman/README.md`](postman/README.md).

Regenerate it any time the API changes: `node postman/generate.mjs` (Node 18+, no dependencies —
fetches the live spec).

## TradingView alert payloads

[`tradingview/`](tradingview/) — ready-to-paste **Message** bodies for a TradingView alert's
webhook, for indicators, strategies and plain text, covering buy/sell, stops and targets, closing
and reversals. See [`tradingview/README.md`](tradingview/README.md) for which template fits your
chart and the full field reference.

```json
{ "action": "buy", "symbol": "{{ticker}}", "volume": "0.20", "sl": "2310.5", "tp": "2385", "id": "{{ticker}}-{{timenow}}" }
```

## n8n templates

[`n8n/`](n8n/) — two importable workflows using n8n's built-in HTTP Request node (fxapis has no
official n8n node yet): a webhook that places a market order from a TradingView-shaped alert, and
a scheduled job that closes every open position on an account. See
[`n8n/README.md`](n8n/README.md) for setup and how to adapt them.

## The rules that keep money safe

- **Idempotency.** The Postman collection and n8n templates always send an `Idempotency-Key`; the
  TradingView templates always send an `id`. The API honours a key for 24 hours — the same key
  with the same body returns the first answer instead of placing a second order.
- **Test keys reach real brokers.** `fx_test_` is a label for your configuration, not a sandbox.
  Build and test every integration here against a broker **demo account**.
- **Volumes and prices are strings** — `"0.01"`, not `0.01`. Stops and targets are absolute
  prices, not pips or points.
- **The alert hook's URL and your API key are credentials.** Keep them out of anything you
  commit, screenshot or share in a template.

## Related fxapis repositories

| Repository | What it is |
|---|---|
| [`fxapis-examples`](https://github.com/FXapis/fxapis-examples) | Runnable code examples: Python, Node/TypeScript, curl |
| [`fxapis-typescript`](https://github.com/FXapis/fxapis-typescript) | The official TypeScript/Node.js SDK |
| [`fxapis-python`](https://github.com/FXapis/fxapis-python) | The official Python SDK |
| [`fxapis-mcp-examples`](https://github.com/FXapis/fxapis-mcp-examples) | Connect AI agents (Claude, Cursor, VS Code) over MCP |
| [`fxapis-nextjs-starter`](https://github.com/FXapis/fxapis-nextjs-starter) | A small working Next.js app |

## Contributing

- **Postman:** change `postman/generate.mjs`, not the collection file directly — it's generated
  and regenerating overwrites hand edits. The `check` workflow regenerates it and fails if the
  committed file doesn't match.
- **TradingView:** a new template should be valid JSON (or valid plain text, for `plain-text/`)
  and quote every `{{placeholder}}`, exactly like the existing ones.
- **n8n:** import your workflow into a real n8n instance and run it against a broker demo account
  before opening a pull request — say which n8n version in the description. fxapis has no
  official n8n node, so these are community HTTP Request-based templates; corrections to match a
  newer n8n node schema are especially welcome.

Found something out of date, or want to add Zapier, Make or Pipedream?
[Open an issue](https://github.com/FXapis/fxapis-integrations/issues) or send a pull request.

## Support

- **Docs:** [docs.fxapis.com](https://docs.fxapis.com)
- **Status:** [status.fxapis.com](https://status.fxapis.com)
- **Bugs:** [open an issue](https://github.com/FXapis/fxapis-integrations/issues)
- **Everything else:** [support@fxapis.com](mailto:support@fxapis.com)

## License

[MIT](LICENSE) © 2026 El Wizard
