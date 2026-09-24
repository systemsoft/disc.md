# Upgrading

Behaviour changes that can affect an existing deployment or client, newest first. Each entry says what changed, who notices, and what to do. For the release mechanics see [Releasing](releasing.md); the version you are running is in `version.txt` next to the binary and in `GET /`.

---

## `bytes` is base64 on the wire (server + SDK together)

`bytes` values are base64 (RFC 4648, no line breaks) in JSON, both directions. Before, a shape rendered `bytea` as PostgreSQL hex text (`"\\x1f8b…"`), a bare insert/update result rendered a `Uint8Array` as an index map (`{"0": 31, …}`), and a base64 string sent to a `<bytes>$p` variable was stored as its ASCII characters.

- Anyone reading hex or index maps now gets base64. Anyone who sent base64 text on purpose now stores the decoded bytes.
- A non-string or non-base64 value for a `bytes` variable is now a `400` `VALIDATION_ERROR` naming the variable; before, it was stored as JSON text. A string starting with `\x` still passes through as PostgreSQL hex input.
- `std::base64_encode` no longer inserts a newline every 76 characters.
- A new SDK against an old server stores base64 as ASCII; an old SDK against a new server gets `400`s for `Uint8Array` variables. Ship both.
- The debug log now truncates long variable values.

See [EdgeQL → Bytes on the wire](edgeql.md#:~:text=Bytes%20on%20the%20wire) and [Client SDK → Bytes](client-sdk.md#:~:text=Bytes).

## Cast precedence follows Gel (breaking)

A cast now applies to the whole postfix expression after it: `<str>item['k']` is `<str>(item['k'])`, and `<str>f(x)` / `<str>.a.b` parse. `<json>$x['a']` used to mean `(<json>$x)['a']`; it is now a subscript on the *uncast* parameter. Write `(<json>$x)['a']`. Operators are unaffected: `<str>x ++ 'a'` is still `(<str>x) ++ 'a'`. See [EdgeQL → Cast Precedence](edgeql.md#:~:text=Cast%20Precedence).

## Unknown functions are a compile error (breaking)

A call to a function the compiler does not know is rejected (`Unknown function '…'`). Before, the name was passed through to PostgreSQL, which is how `lower()`, `coalesce()` and `now()` happened to work. Use `str_lower()`, `??` and `datetime_current()`. Built-ins with or without `std::`, SDL `function` declarations and extension functions all resolve. `disc_uuidv7()` is registered. `range_unpack` now executes (it compiled to a nonexistent `unnest(range)` before).

## `with u := (mutation) select u { … }` projects its shape and always returns rows

With a shape, the result is the projected shape, not every column of `RETURNING *`. With or without a shape, the response is always the row set (`[]` when nothing matched); before, the insert/update forms answered `rows[0] || { success: true }` while the delete form answered an array. The new `select (insert|update|delete …) { … }` form behaves identically. Bare `insert`/`update`/`delete` responses are unchanged, with one correction: a junction-backed multi-link `update` that matched nothing now answers `{ "updated": 0 }` instead of `{ "success": true }`, and a bare insert whose link value is a subselect answers with the row like any other bare insert. See [EdgeQL → Selecting over a mutation](edgeql.md#:~:text=Selecting%20over%20a%20mutation).

## Variables bind by name; an extra variable is a `400`

Variables were bound positionally, in the order the query first mentions them; a `variables` object in a different key order bound the wrong values. They now bind by name. A missing variable and an unknown one are each a `400` `VALIDATION_ERROR` naming the variable (an extra variable used to fail with a PostgreSQL bind-count error). Remove stray keys from your `variables` objects.

## Default protocol handler is `full`

`disc serve` already defaulted to the full compiler; `new DiscServer({})` with no `protocol` option selected the simple handler, which enforces no access policies. Both now default to `full`. Pass `protocol: "simple"` or set `DISC_PROTOCOL=simple` to opt into the simple handler. See [Server → Protocol Handlers](server.md#:~:text=Protocol%20Handlers).

## The SDK reports every failure as a failure

- `query()` used to resolve `undefined` on a `413` and `transaction()` used to resolve when the commit `404`ed. Every non-OK response is now an error: `DiscAuthError` (401/403), `DiscServerError` (5xx), a typed `DiscQueryError` for an `errors` envelope, `DiscProtocolError` otherwise.
- A failed statement poisons its transaction, as in PostgreSQL. `commit()` and further `query()` calls throw `DiscTransactionError`; `transaction(fn)` rolls back and rejects even when `fn` caught the error and returned. Code that caught a `UniqueViolationError` inside the callback and carried on was never committing what it thought — it now sees the rejection. Retry the whole `transaction()` call.
- No retries inside transactions (`/transaction/*` or any request carrying `X-Transaction-ID`), whatever `retries` is set to.
- The generated `delete(id)` is typed `Promise<{ deleted: number }>` — which is what it always resolved to.

See [Client SDK → Transactions](client-sdk.md#:~:text=A%20failed%20statement%20poisons).

## Server-side transaction changes

- `POST /transaction/commit` on a transaction poisoned by an earlier failed statement answers `409` `TRANSACTION_ABORTED` and rolls it back; it used to answer `{ "ok": true }` while PostgreSQL silently rolled back.
- A `COMMIT` PostgreSQL rejects answers `500` with `sqlState`; the id is gone afterwards, so a repeated commit is `404`, never `{ "ok": true }`.
- Execution errors carry `extensions.sqlState` (plus `constraint`, `table`, `detail` when sent).
- `extensions.queryHash` is a 64-character SHA-256 hex digest (was a 32-bit hash).

## Type-level `constraint exclusive on ((.a, .b))` is enforced

It was parsed and validated but created no index. It now creates `CREATE UNIQUE INDEX uk_<table>_<cols>`, and `disc migrate` backfills it on deployments whose stored schema already declared it. **Before upgrading a deployment that declares one, check for rows that violate it** — the migration fails (before applying anything) with a query that lists the duplicates. `disc migrate --create` previews the backfill. `index on (.link)` alone is now skipped as redundant with the auto-created FK index. See [Schema → Type-level `exclusive`](schema.md#:~:text=Type%2Dlevel%20exclusive) and [Migrations → Index backfill](migrations.md#:~:text=Index%20backfill).

## Access policies reach nested mutations

Policies used to be applied to the top-level statement only, so `with u := (update …) select u`, `for … union (insert …)` and multi-link writes ran unfiltered for ordinary users. They are now applied inside every insert/update/delete wherever it sits, and `select default::T` is filtered like `select T`. An upsert (`unless conflict … else (update …)`) on a type with a row-level update policy is now a compile error. Read-only mode rejects nested writes. Workloads that relied on the gap should use the [service credential](access-policies.md#:~:text=Service%20credential).

## Other

- `DISC_MAX_CONNECTIONS` now sizes the pool that `/query` and transactions use (it was hard-coded to 10), and the cap is enforced under concurrent load: callers beyond it queue instead of opening extra connections, and past `DISC_MAX_CONNECTIONS + 50` waiters a request fails with `Connection pool wait queue is full`.
- `DISC_MAX_REQUEST_BODY_BYTES` configures the `/query` body cap (default 4 MiB; `disc.toml` wins).
- `DISC_SERVICE_TOKEN` / `--service-token` add a service credential; the per-request bypass header is now honored for `admin` **or** `superuser` roles.
- The compiled-query cache is keyed per user id as well as role.
