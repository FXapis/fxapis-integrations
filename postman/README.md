# fxapis Postman collection

`fxapis.postman_collection.json` is a Postman Collection (v2.1) covering every public endpoint of
the fxapis MetaTrader 5 REST API: connecting accounts, bringing them online, market and pending
orders, positions, order and deal history, multi-account orders (waves), copy trading, billing,
API keys and health checks. It is generated from the fxapis OpenAPI spec (live at <https://api.fxapis.com/docs/json>), with one folder
per API section and a ready-to-send example body on every request that takes one.

Full documentation: https://docs.fxapis.com

## Import

In Postman: **Import** → select `fxapis.postman_collection.json`. (Once the collection is
published, a "Run in Postman" button will do the same in one click.)

## Set up

Open the collection → **Variables** and set:

- `apiKey`: your fxapis key (`fx_test_…` or `fx_live_…`). Every request sends it as
  `Authorization: Bearer {{apiKey}}`, except `/healthz` and `/readyz`, which need no key, and the
  **API keys** folder, which sends `adminKey`.
- `adminKey`: an admin key (`fx_admin_…`), used only by the **API keys** folder. The workspace owner
  makes one in the console; it manages the workspace's API keys and can do nothing else.
- `baseUrl`: defaults to `https://api.fxapis.com`. Change it only if you are pointed elsewhere.
- `accountId`, `positionId`, `orderId`, `waveId`, `keyId`, `invoiceId`, `strategyId`,
  `subscriptionId`: fill these in from
  earlier responses (for example, `accountId` from **Connect an MT5 account**) before calling
  the endpoints that use them.

Member and invitation endpoints are not in the collection: they are console-only and refuse every
API key. They are documented, with that note, in the [API reference](https://docs.fxapis.com/api-reference).

**Copy trading is paused until scheduled maintenance.** The **Copy trading** folder's requests
that start copying (making a strategy, subscribing, resuming a strategy or subscription, and reset)
answer `503 COPY_TRADING_PAUSED` until then; reads, settings, pausing and deleting work.
**Whether copy trading is running** (`GET /v1/copy/status`) says whether it is paused.

**Test keys still reach real brokers.** A test key does not simulate trading: orders go to the
broker behind the connected MT5 account. Connect a broker *demo* MT5 account while you try
things out.

## Idempotency-Key on trading requests

The collection's pre-request script gives every POST and PATCH an `Idempotency-Key` header with a
fresh UUID, unless the request already has one. The order-placing endpoints (market order, pending
order, close position, multi-account order) also show the header explicitly, set to `{{$guid}}`.

What it means: if the server sees the same key again (with the same body), it returns the first
answer instead of placing a second order. A new key means a new order. Because Postman
generates a new key on every send, clicking **Send** twice places two orders. To retry the
same order safely, replace `{{$guid}}` with a fixed value.

## Regenerate

```sh
node postman/generate.mjs
```

It needs only Node 18+ (no dependencies). It reads the spec from `../../openapi.json` when run inside
the fxapis monorepo, and otherwise fetches the live spec from `https://api.fxapis.com/docs/json`. The
output is identical when the spec has not changed. Optional arguments:
`node postman/generate.mjs <path-or-url of openapi.json> <path/to/out.json>`.
