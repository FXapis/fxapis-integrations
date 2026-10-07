# TradingView alert payloads

Ready-to-paste **Message** bodies for a TradingView alert's **Webhook URL**, pointed at an
fxapis TradingView hook (`https://api.fxapis.com/hooks/tradingview/<secret>` — create one in
**Console → TradingView → Create a TradingView hook**, or `POST /v1/alert-hooks`). TradingView
fills in the `{{…}}` placeholders when the alert fires; fxapis reads the result as JSON or plain
text.

> [!WARNING]
> An alert hook places real orders on whatever account it points at. Point your first hook at a
> **broker demo account** and fire a test alert before using a real-money account.

## Indicators and drawings ([`indicators/`](indicators/))

An indicator alert knows nothing about open positions, so it sends a fixed action — make one
alert per direction:

- [`buy.json`](indicators/buy.json) / [`sell.json`](indicators/sell.json) — at the hook's default volume
- [`buy-with-levels.json`](indicators/buy-with-levels.json) / [`sell-with-levels.json`](indicators/sell-with-levels.json) — with a volume, stop loss and take profit
- [`close.json`](indicators/close.json) — closes every open position on the symbol
- [`close-all.json`](indicators/close-all.json) — closes every open position on the hook's accounts, every symbol

## Strategies ([`strategy/`](strategy/))

One alert on **Any alert() function call** covers every entry, exit and reversal of a Pine
strategy: [`entry-exit-reversal.json`](strategy/entry-exit-reversal.json). `position` (the
market position **after** the order) and `prev_position` decide what actually happens:

| `position` after the order | `prev_position` | What fxapis does |
|---|---|---|
| `flat` | anything | Closes every open position on the symbol |
| `short` | `long` (a reversal) | Closes the symbol's positions, then sells |
| `long` | `short` (a reversal) | Closes the symbol's positions, then buys |
| same side as the order | `flat` or the same side | Opens (an entry, or adding to one) |
| opposite side to the order | the same | **Ignored** — a partial exit, logged but not traded |

> [!WARNING]
> TradingView sizes strategies in **units** (`{{strategy.order.contracts}}` is `100000` for one
> MT5 lot). The template sends no `volume`, so the hook's default lots are used. Only add
> `volume` if you are sending it in lots already — anything above 1000 lots is refused as a
> units mistake.

## Plain text ([`plain-text/`](plain-text/))

Action, symbol, optional volume, then optional `key=value` pairs — for when JSON is more than
you need: [`buy.txt`](plain-text/buy.txt), [`sell-with-levels.txt`](plain-text/sell-with-levels.txt),
[`close.txt`](plain-text/close.txt), [`close-all.txt`](plain-text/close-all.txt).

## Fields

| Field | Also accepted as | Meaning |
|---|---|---|
| `action` | `side`, `signal` | `buy`/`long`, `sell`/`short`, `close`/`exit`, `close_long`, `close_short`, `flat`, `close_all` |
| `symbol` | `ticker` | Usually `{{ticker}}`. Not needed for `close_all` |
| `volume` | `qty`, `lots`, `contracts` | Lots, e.g. `"0.10"`. Default: the hook's volume |
| `sl` | `stopLoss`, `stop_loss` | Absolute price. `0` means none |
| `tp` | `takeProfit`, `take_profit` | Absolute price. `0` means none |
| `id` | `alert_id` | Unique per alert — see **Duplicates** below |
| `position` | `market_position` | `{{strategy.market_position}}` |
| `prev_position` | `prev_market_position` | `{{strategy.prev_market_position}}` |
| `comment` | | Written on the MT5 order (first 17 characters). Default `TradingView` |

Useful placeholders: `{{ticker}}`, `{{exchange}}`, `{{close}}`, `{{time}}`, `{{timenow}}`,
`{{interval}}`, and in strategies `{{strategy.order.action}}`, `{{strategy.order.contracts}}`,
`{{strategy.order.id}}`, `{{strategy.market_position}}`, `{{strategy.prev_market_position}}`.

> [!IMPORTANT]
> Quote every placeholder: `"volume": {{strategy.order.contracts}}` is valid JSON only once the
> placeholder fills in. Quoted (`"{{…}}"`), it always is. Every template here already does this.

## Duplicates

Include `id` (the templates above use `{{ticker}}-{{timenow}}` or `{{strategy.order.id}}-{{timenow}}`,
which TradingView fills in once per fire). fxapis takes each `id` **once**: a resend — a dropped
connection, an accidental duplicate alert — is answered `200 duplicate` and not traded again, even
if both copies arrive at the same instant. Without an `id`, the same message twice within 60
seconds is treated as one alert instead (and two genuinely separate identical alerts within a
minute are traded once).

## Setting it up in TradingView

1. On the chart, open **Create alert** (the alarm-clock icon, or <kbd>Alt</kbd>+<kbd>A</kbd>).
2. **Condition:** your indicator, drawing or strategy.
3. **Message:** paste one of the templates above.
4. **Notifications → Webhook URL:** paste the hook's URL.
5. Save. Fired alerts appear under **Console → TradingView → your hook** within a second, with
   their result.

Requires a TradingView plan with **webhook alerts** (not on Basic) and **two-factor
authentication** on your TradingView account — TradingView sends webhooks only from 2FA accounts.

Full reference, including the symbol-mapping rules, the TradingView IP allowlist and every HTTP
status code: [docs.fxapis.com/guides/tradingview](https://docs.fxapis.com/guides/tradingview).
