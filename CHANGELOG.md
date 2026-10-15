# Changelog

Notable changes to the integrations in this repository. The Postman collection is generated from
the live API reference (`node postman/generate.mjs`), so it follows the API.

## 2026-10-15

- **Postman: admin keys.** The *API keys* folder now authenticates with a new `adminKey` collection
  variable. Managing API keys needs an admin key (`fx_admin_…`), which the workspace owner makes in
  the console under **API keys → Admin keys**. An ordinary key gets `403 ADMIN_KEY_REQUIRED` there.
- **Postman: team management removed.** The *Members* folder (members and invitations) and the
  `memberId` / `invitationId` variables are gone. The API never accepted API keys for them; manage
  your team in the console.

## 2026-10-14

- **Postman:** the event log (`GET /v1/events`, `GET /v1/events/{id}`, with an `eventId` variable),
  replay to a webhook endpoint, and paged delivery logs with each attempt's request and response.
- **Postman:** multi-account orders can name an `instrument` instead of a broker symbol, and API keys
  can carry limits (`limits` on create and update).

## 2026-10-08

- **Postman:** the webhook endpoints, with `webhookId` and `eventId` variables.
