#!/usr/bin/env node
// Builds a Postman Collection v2.1 from the fxapis OpenAPI spec.
//
//   node examples/postman/generate.mjs [openapi.json] [out.json]
//
// The spec is, in order: the path or URL given, ../../openapi.json relative to
// this script (inside the fxapis monorepo), or the live spec at
// https://api.fxapis.com/docs/json (in the standalone examples repo). Output is
// fxapis.postman_collection.json next to this script. Node 18+ built-ins only;
// the output is deterministic, so an unchanged spec produces an identical file.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const LIVE_SPEC = "https://api.fxapis.com/docs/json";
const monorepoSpec = resolve(here, "../../openapi.json");
const specSource = process.argv[2] ?? (existsSync(monorepoSpec) ? monorepoSpec : LIVE_SPEC);
const outPath = resolve(process.argv[3] ?? resolve(here, "fxapis.postman_collection.json"));

const spec = /^https?:\/\//.test(specSource)
  ? await fetch(specSource).then((response) => {
      if (!response.ok) throw new Error(`could not fetch ${specSource}: ${response.status}`);
      return response.json();
    })
  : JSON.parse(readFileSync(resolve(specSource), "utf8"));

const METHODS = ["get", "post", "put", "patch", "delete"];
const SCHEMA_URL = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";

// Which collection variable a path's `{id}` stands for, by the segment before it.
const ID_VARIABLE_BY_SEGMENT = {
  accounts: "accountId",
  orders: "orderId",
  "execution-waves": "waveId",
  "api-keys": "keyId",
  invoices: "invoiceId",
  "alert-hooks": "alertHookId",
  webhooks: "webhookId",
  events: "eventId",
};

const IDEMPOTENCY_DESCRIPTION =
  "Postman fills in a fresh UUID on every send. Re-sending the same key (with the same body) " +
  "returns the first answer instead of placing a second order; a new key means a new order. " +
  "To retry safely, replace `{{$guid}}` with a fixed value.";

// ---------------------------------------------------------------------------

function uuidFrom(text) {
  const h = createHash("sha256").update(text).digest("hex");
  // Shape as an RFC 4122 name-based UUID (version 5 nibble, variant 10xx).
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function operations() {
  const ops = [];
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    if (path.startsWith("/internal")) continue;
    for (const method of METHODS) {
      const op = item[method];
      if (!op) continue;
      // Console-only (members, invitations): every API key is refused there.
      if (op["x-fxapis-audience"] === "console") continue;
      const parameters = mergeParameters(item.parameters, op.parameters);
      ops.push({ path, method, op, parameters });
    }
  }
  return ops;
}

function mergeParameters(pathLevel = [], opLevel = []) {
  const byKey = new Map();
  for (const p of [...pathLevel, ...opLevel]) byKey.set(`${p.in}:${p.name}`, p);
  return [...byKey.values()];
}

function pathSegments(path) {
  const segments = path.split("/").filter(Boolean);
  return segments.map((segment, i) => {
    const m = /^\{(.+)\}$/.exec(segment);
    if (!m) return segment;
    const name = m[1];
    if (name !== "id") return `{{${name}}}`;
    const variable = ID_VARIABLE_BY_SEGMENT[segments[i - 1]];
    if (!variable) throw new Error(`No variable mapping for {id} in ${path}`);
    return `{{${variable}}}`;
  });
}

function scalarValue(schema = {}, param = {}) {
  if (param.example !== undefined) return param.example;
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  return undefined;
}

function toQueryString(value) {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function fallbackValue(name, schema = {}) {
  const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== "null") : schema.type;
  if (type === "array") {
    const items = schema.items ?? {};
    if (name === "accountIds" || items.format === "uuid") return ["{{accountId}}"];
    const inner = scalarValue(items);
    return inner !== undefined ? [inner] : [fallbackValue(name, items)];
  }
  if (type === "object") return schema.properties ? buildObject(schema) : {};
  if (type === "integer" || type === "number") return schema.minimum ?? 0;
  if (type === "boolean") return false;
  if (schema.format === "email") return "someone@example.com";
  if (schema.format === "uuid") return "{{accountId}}";
  if (schema.format === "date-time") return "2026-01-01T00:00:00Z";
  return "";
}

function buildObject(schema) {
  const required = new Set(schema.required ?? []);
  const body = {};
  for (const [name, prop] of Object.entries(schema.properties ?? {})) {
    if (name === "accountIds") {
      body[name] = ["{{accountId}}"];
      continue;
    }
    const value = scalarValue(prop);
    if (prop.example !== undefined) body[name] = prop.example;
    else if (required.has(name)) body[name] = value !== undefined ? value : fallbackValue(name, prop);
  }
  return body;
}

function requestBody(op) {
  const content = op.requestBody?.content;
  if (!content) return undefined;
  const media = content["application/json"] ?? Object.values(content)[0];
  if (!media) return undefined;
  let value;
  if (media.example !== undefined) value = media.example;
  else if (media.schema?.example !== undefined) value = media.schema.example;
  else if (media.examples && Object.keys(media.examples).length) {
    const first = Object.values(media.examples)[0];
    value = first?.value ?? first;
  } else if (media.schema) value = buildObject(media.schema);
  else value = {};
  return {
    mode: "raw",
    raw: JSON.stringify(value, null, 2),
    options: { raw: { language: "json" } },
  };
}

function buildUrl(path, parameters) {
  const segments = pathSegments(path);
  const query = parameters
    .filter((p) => p.in === "query")
    .map((p) => {
      const q = { key: p.name, value: toQueryString(scalarValue(p.schema, p)), disabled: true };
      if (p.description) q.description = p.description;
      return q;
    });
  const url = {
    raw: `{{baseUrl}}/${segments.join("/")}`,
    host: ["{{baseUrl}}"],
    path: segments,
  };
  url.query = query;
  return url;
}

function buildHeaders(op, parameters, hasBody) {
  const headers = [];
  if (hasBody) headers.push({ key: "Content-Type", value: "application/json" });
  for (const p of parameters.filter((x) => x.in === "header")) {
    if (p.name.toLowerCase() === "idempotency-key") {
      headers.push({
        key: "Idempotency-Key",
        value: "{{$guid}}",
        description: IDEMPOTENCY_DESCRIPTION,
      });
    } else {
      const h = { key: p.name, value: toQueryString(scalarValue(p.schema, p)) };
      if (p.description) h.description = p.description;
      if (!p.required) h.disabled = true;
      headers.push(h);
    }
  }
  return headers;
}

function savedResponses(op, request) {
  const out = [];
  for (const [code, response] of Object.entries(op.responses ?? {})) {
    for (const [contentType, media] of Object.entries(response.content ?? {})) {
      const examples = [];
      if (media.example !== undefined) examples.push(["example", media.example]);
      else if (media.schema?.example !== undefined) examples.push(["example", media.schema.example]);
      for (const [name, ex] of Object.entries(media.examples ?? {})) {
        examples.push([ex?.summary ?? name, ex?.value ?? ex]);
      }
      for (const [name, value] of examples) {
        const status = Number(code);
        out.push({
          name: `${code} ${response.description ?? ""}`.trim() + (name === "example" ? "" : ` — ${name}`),
          originalRequest: request,
          status: response.description ?? code,
          code: Number.isFinite(status) ? status : 200,
          _postman_previewlanguage: contentType.includes("json") ? "json" : "text",
          header: [{ key: "Content-Type", value: contentType }],
          body: typeof value === "string" ? value : JSON.stringify(value, null, 2),
        });
      }
    }
  }
  return out;
}

function buildItem({ path, method, op, parameters }) {
  const upper = method.toUpperCase();
  const body = requestBody(op);
  const description = [op.description?.trim(), `\`${upper} ${path}\``].filter(Boolean).join("\n\n");
  const request = {
    method: upper,
    header: buildHeaders(op, parameters, Boolean(body)),
  };
  if (body) request.body = body;
  request.url = buildUrl(path, parameters);
  request.description = description;
  if (Array.isArray(op.security) && op.security.length === 0) request.auth = { type: "noauth" };

  const item = { name: op.summary?.trim() || `${upper} ${path}`, request };
  const responses = savedResponses(op, { method: upper, header: request.header, url: request.url, ...(body ? { body } : {}) });
  item.response = responses;
  return item;
}

// ---------------------------------------------------------------------------

const ops = operations();

const tagOrder = (spec.tags ?? []).map((t) => t.name);
const tagDescriptions = Object.fromEntries((spec.tags ?? []).map((t) => [t.name, t.description ?? ""]));
const byTag = new Map(tagOrder.map((t) => [t, []]));
/** Per folder: how many of its requests need an admin key. */
const adminCount = new Map();
for (const entry of ops) {
  const tag = entry.op.tags?.[0] ?? "Other";
  if (!byTag.has(tag)) byTag.set(tag, []);
  byTag.get(tag).push(buildItem(entry));
  if (entry.op["x-fxapis-audience"] === "admin") adminCount.set(tag, (adminCount.get(tag) ?? 0) + 1);
}

const folders = [];
for (const [tag, items] of byTag) {
  if (!items.length) continue;
  const folder = { name: tag };
  if (tagDescriptions[tag]) folder.description = tagDescriptions[tag];
  const admin = adminCount.get(tag) ?? 0;
  if (admin > 0) {
    // Folder-level auth: these requests send the admin key, every other folder the ordinary one.
    if (admin !== items.length) throw new Error(`Folder ${tag} mixes admin-key and ordinary requests`);
    folder.auth = { type: "bearer", bearer: [{ key: "token", value: "{{adminKey}}", type: "string" }] };
    folder.description = `${folder.description ?? ""}\n\nThis folder sends \`{{adminKey}}\` (an \`fx_admin_…\` key), not \`{{apiKey}}\`.`.trim();
  }
  folder.item = items;
  folders.push(folder);
}

const intro = [
  "The fxapis MetaTrader 5 REST API: connect MT5 accounts, place market and pending orders,",
  "manage positions, read orders and deals, and place one order across many accounts at once.",
  "",
  "Full documentation: https://docs.fxapis.com",
  "",
  "**Set `apiKey`** (collection variables) to your key. Test keys (`fx_test_…`) still reach real",
  "brokers — connect a broker *demo* MT5 account while you try things out.",
  "",
  "**Set `adminKey`** to an admin key (`fx_admin_…`) to use the *API keys* folder. Only the workspace",
  "owner can make one, in the console; it manages keys and can do nothing else.",
  "",
  "Every POST and PATCH gets an `Idempotency-Key` automatically (see the collection pre-request",
  "script): re-sending the same key returns the first answer, a new key means a new order.",
].join("\n");

const prerequest = [
  "// Give every POST/PATCH an Idempotency-Key unless the request already has one.",
  "// Re-sending the same key returns the first answer; a new key means a new order.",
  "const method = pm.request.method.toUpperCase();",
  "if (method === 'POST' || method === 'PATCH') {",
  "  const hasKey = pm.request.headers.all().some(",
  "    (h) => !h.disabled && String(h.key).toLowerCase() === 'idempotency-key' && h.value",
  "  );",
  "  if (!hasKey) {",
  "    const value =",
  "      typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function'",
  "        ? crypto.randomUUID()",
  "        : pm.variables.replaceIn('{{$guid}}');",
  "    pm.request.headers.upsert({ key: 'Idempotency-Key', value });",
  "  }",
  "}",
];

const variable = [
  { key: "baseUrl", value: spec.servers?.[0]?.url ?? "https://api.fxapis.com", type: "string" },
  { key: "apiKey", value: "fx_test_replace_me", type: "string" },
  { key: "adminKey", value: "fx_admin_replace_me", type: "string" },
  { key: "accountId", value: "", type: "string" },
  { key: "positionId", value: "", type: "string" },
  { key: "orderId", value: "", type: "string" },
  { key: "waveId", value: "", type: "string" },
  { key: "keyId", value: "", type: "string" },
  { key: "invoiceId", value: "", type: "string" },
  { key: "alertHookId", value: "", type: "string" },
  { key: "webhookId", value: "", type: "string" },
  { key: "eventId", value: "", type: "string" },
  { key: "eventId", value: "", type: "string" },
];

const collection = {
  info: {
    _postman_id: uuidFrom(`${spec.info?.title ?? ""}@${spec.info?.version ?? ""}`),
    name: "fxapis — MetaTrader 5 REST API",
    description: `${intro}\n\n---\n\n${spec.info?.description ?? ""}`.trim(),
    schema: SCHEMA_URL,
  },
  item: folders,
  auth: { type: "bearer", bearer: [{ key: "token", value: "{{apiKey}}", type: "string" }] },
  event: [{ listen: "prerequest", script: { type: "text/javascript", exec: prerequest } }],
  variable,
};

const requestCount = folders.reduce((n, f) => n + f.item.length, 0);
if (requestCount !== ops.length) {
  throw new Error(`Collection has ${requestCount} requests but the spec has ${ops.length} operations`);
}

writeFileSync(outPath, JSON.stringify(collection, null, 2) + "\n");
console.log(`Wrote ${outPath}: ${folders.length} folders, ${requestCount} requests.`);
