# n8n templates

fxapis has no official n8n node yet, so these use n8n's built-in **HTTP Request** node to call the
REST API directly. Import either JSON file: **Workflows → Add workflow → ⋯ → Import from File**.

| Template | Trigger | What it does |
|---|---|---|
| [`tradingview-webhook-to-market-order.json`](tradingview-webhook-to-market-order.json) | Webhook | Receives a TradingView-shaped alert body, places a market order, responds with the result |
| [`scheduled-flat-all.json`](scheduled-flat-all.json) | Schedule (cron) | Every weekday at 21:00 UTC, lists an account's positions and closes each one |

## Before you run either one

1. **Set the environment variables your n8n instance reads**, not n8n credentials — the
   expressions use `{{ $env.FXAPIS_API_KEY }}` so the key never lives inside the workflow JSON.
   Self-hosted: add to n8n's `.env` or container environment and restart. n8n Cloud and some
   self-hosted setups disable `$env` in expressions by default
   ([`N8N_BLOCK_ENV_ACCESS_IN_NODE`](https://docs.n8n.io/hosting/configuration/environment-variables/))
   — if the HTTP Request node's Authorization header comes through empty, switch it to an
   **HTTP Header Auth** credential (`Authorization` / `Bearer fx_live_…`) instead.
2. **Test keys reach real brokers.** Point `FXAPIS_ACCOUNT_ID` / the webhook body at a broker
   **demo account** first.
3. The webhook template's `Idempotency-Key` defaults to the alert's `id` field (or the n8n
   execution id as a fallback) — every field TradingView's own message templates send, see
   [`../tradingview/`](../tradingview/). If your trigger's payload doesn't include an `id`, add
   one so a webhook retry can never open a second position.

## Adapting these

Both are deliberately minimal — two or three HTTP Request nodes, no retry logic, no queue. Treat
them as a starting point: the comments in each node's `url` and `jsonBody` expression show
exactly which REST endpoint and fields they map to, so extending them (adding a stop loss field
from your trigger, multi-account orders, Slack notification on rejection) is editing one
expression, not learning a new framework. The [REST API reference](https://docs.fxapis.com/api-reference)
and [idempotency guide](https://docs.fxapis.com/trading) cover every field these endpoints take.

**Found these out of date with a newer n8n node version, or want to add one (Zapier, Make,
Pipedream)?** [Open an issue](https://github.com/FXapis/fxapis-integrations/issues) or send a
pull request — see [Contributing](../README.md#contributing).
