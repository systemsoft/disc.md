# Upgrading

Behaviour changes that can affect an existing deployment or client, newest first. Each entry says what changed, who notices, and what to do. For the release mechanics see [Releasing](releasing.md); the version you are running is in `version.txt` next to the binary and in `GET /`.

---

## Indexing a missing JSON key raises (breaking)

`x['k']` on a JSON object without `k` raises `InvalidValueError: JSON index 'k' is out of bounds`, as in Gel; it was the empty set, so `<str>item['k']` was empty and a `required` property rejected the row with a not-null error. A JSON index past either end, and indexing the wrong kind of value (`cannot index JSON number`), raise too. A key present with a JSON `null` still reads as empty. Use `json_get(x, 'k')` where a key may be absent. See [EdgeQL → Array Indexing](edgeql.md#:~:text=A%20json%20value%20indexes).

## `^` is power, not bitwise XOR (breaking)

`^` is Gel’s power operator: `2 ^ 3` is `8.0` and `-2 ^ 2` is `-4`. It was PostgreSQL’s bitwise XOR, so `12 ^ 10`, which was `6`, is now `61917364224.0`. Queries and schema computeds that used it for XOR change value; `(a | b) - (a & b)` is the XOR of two integers. See [EdgeQL → Arithmetic Operators](edgeql.md#:~:text=is%20Gel%E2%80%99s%20power%20operator).

## Arrays of arrays are rejected in schema types (breaking)

A property, tuple element or scalar type of `array<array<…>>` is the schema error `nested arrays are not supported`, as in Gel; Disc made it a PostgreSQL array column, which can’t hold arrays of different lengths. A schema with one no longer migrates: store the value as `json` or as `array<tuple<array<…>>>`. Arrays of arrays in queries are unaffected. See [Schema → Arrays](schema.md#:~:text=An%20array%20of%20arrays%20is%20a%20query%20value%20only).

## Error messages name Gel’s types

A value PostgreSQL can’t take fails with Gel’s wording: `invalid input syntax for type std::int64: "x"` (was `… type bigint …`), `value "99999" is out of range for type std::int16`, `std::int64 out of range`. SQLSTATEs are unchanged. Code that matched `bigint`, `numeric` or `integer` in a message should match `extensions.sqlState` or the SDK error class instead. See [Error Codes](error-codes.md#:~:text=worded%20with%20Gel%E2%80%99s%20type%20names).

## `querySingle` of several results raises

Over the binary protocol, `querySingle`, `queryRequiredSingle` and their JSON forms raise `ResultCardinalityMismatchError` for a query that returns more than one element, as in Gel; `querySingleJSON` sent every row. When the result is known to be a set as the query is parsed, nothing runs and nothing is written. Use `query` for many results. See [Server → Protocol Details](server.md#:~:text=querySingle%2C%20queryRequiredSingle%20and%20their%20JSON%20forms).

## An object cast of a missing id raises (breaking)

`<T><uuid>$p` now checks that a `T` with that id exists, as in Gel: a missing id, or another type’s object’s id, raises `CardinalityViolationError: 'default::T' with id '…' does not exist` (SQLSTATE `21000`) in a filter, a `select`, `count`, `in` or a link value of an `insert` or `update`. Before, a filter matched nothing and a link write failed with a foreign-key error (`23503`). Callers that catch `ForeignKeyViolationError` around link writes should also catch the SDK’s new `CardinalityViolationError`. For a filter that should just match nothing, compare the id: `filter .program.id = <uuid>$p`. See [EdgeQL → Linking by id](edgeql.md#:~:text=As%20in%20Gel%2C%20the%20cast%20checks%20that%20the%20object%20exists).

## Indexing past the end raises

An array index past either end — `[10, 20, 30][5]`, `.tags[-4]` on a stored array — raises `InvalidValueError` (`array index 5 is out of bounds`), as in Gel; it returned nothing. Strings and `bytes`, which can now be indexed, raise the same way. Use `array_get(arr, i)` where an index may be out of range. Slices are unaffected: out-of-range slice bounds are clamped. See [EdgeQL → Array Indexing](edgeql.md#:~:text=Array%20Indexing).

## `single` on a computed is checked

A schema computed declared `single` whose expression may yield several values — `single first := (select .<post[is C] order by .created)` — is now a schema error (`possibly more than one element returned by an expression for the computed link 'first' … explicitly declared as 'single'`), as in Gel. Add `limit 1`, filter on `.id` or an `exclusive` property, or wrap it in `assert_single(…)`. See [Schema → Computed Properties](schema.md#:~:text=single%20narrows%20it).

## United tuples with different names are unnamed

Tuples united by an array literal, `++`, a set literal or `union` keep their names only when all have the same ones, as in Gel: `[(a := 1)] ++ [(2,)]` is `[[1], [2]]`, not `[{ "a": 1 }, [2]]`. Code that read `.a` from such a result should read the element by position, or give every tuple the same names. See [EdgeQL → Named Tuple Field Access](edgeql.md#:~:text=Named%20Tuple%20Field%20Access).

## Mutations answer with the set of rows they wrote (breaking)

A bare `insert`, `update`, `delete` or `for … union (insert …)` answers with the set of objects it wrote, as in Gel: `[{ … }, …]`, or `[]` when it wrote none. Before, an insert answered with the row object, an update with its first row or `{ "updated": 0 }`, and a delete with `{ "deleted": n }`. Each row is still the whole stored row (Gel returns only `{ "id" }`).

- Raw `client.query()` callers: read `rows[0]` for an inserted row and `rows.length` for how many objects an update or delete touched.
- Generated clients keep their API — `insert()` resolves to the row, `update()` to the row or `{ updated: 0 }`, `delete()` to `{ deleted: n }` — once regenerated; a client generated before this release misreads the new answers, so regenerate and deploy it with the server. Rust `update` now returns `Option<…>` and Go `Update` a pointer: `None` / `nil` for an id that doesn’t exist.
- REST `PATCH /api/T/{id}` of an id that doesn’t exist is `404`; it answered `200` with `{ "updated": 0 }`.

See [Server → `POST /query`](server.md#:~:text=Response%20shape%20by%20statement%20kind).

## A select of values answers with the values (breaking)

A select of anything other than objects answers with the values themselves, as in Gel: `select User.name` is `["ann"]`, `select count(User)` is `[2]`, `select <str>datetime_current()` is `["…"]`, `select (1, 'a')` is `[[1, "a"]]`, `select {1, 2}` is `[1, 2]`. Before, each value came wrapped in an object keyed by a column name (`[{ "count": 2 }]`). Code that read `Object.values(rows[0])[0]` must read `rows[0]`. Selects of objects are unchanged.

## An empty multi link is `[]`

A multi link selected without a sub-shape (`select User { posts }`) is `[]` when it has no targets; it was `null`. In the typed query builder, `select({ posts: true })` is typed `string[]` (was `string[] | null`).

## Computed fields of objects read as links

A computed field in a query shape that yields objects follows the stored-link convention: a single one is `[{ … }]` (or `null`) with a sub-shape and its target’s id without; a multi one is an array of objects with a sub-shape and of ids without. Before, `x := .posts` gave `[{ "id" }]` and `x := (select … limit 1) { … }` gave the object itself. See [EdgeQL → Computed Fields](edgeql.md#:~:text=A%20computed%20field%20of%20objects).

## Single values from a `with` binding must be provably single

`with n := (select Counter)` followed by `number := n.last` in an `insert` or `update` is now a compile error (`possibly more than one element returned by an expression for a property 'number' declared as 'single'`), as in Gel; it used to compile. Filter the binding on `.id` or an `exclusive` property, add `limit 1`, or wrap the value in `assert_single(…)`. The same holds for bindings of an `update` or `delete`. See [EdgeQL → Insert with Links](edgeql.md#:~:text=A%20single%20link%20holds%20one%20object).

## Invalid string escapes are errors

String literals, in EdgeQL and SDL, read escapes as Gel does. `\xHH`, `\uHHHH`, `\b` and `\f` used to be read as their letters (`'\x41'` was `x41`) and are now decoded; an unknown escape (`'\q'` was `q`), `\x00` and `\x80`–`\xff` are now syntax errors. Write `\\` for a literal backslash, or use a raw (`r'…'`) or dollar-quoted (`$$…$$`) string. See [EdgeQL → String and bytes literals](edgeql.md#:~:text=String%20and%20bytes%20literals).

## Empty values return no row

A statement whose value is empty — `select <json>{}`, `select <str>{}`, an unset global, an `<optional>` parameter given `null`, a `json_get` or `array_get` that finds nothing — answers `[]`, as in Gel. It answered one row holding `null`. Check for an empty array instead of a `null` value.

## `<str>` of a datetime is ISO 8601

`<str>` and `to_str()` of a `datetime` or `cal::local_datetime` give Gel’s ISO text (`2024-01-02T00:00:00+00:00`, `2024-01-02T03:04:05`) instead of PostgreSQL’s (`2024-01-02 00:00:00+00`). Anything that parses these strings sees the new form.

## Casts to constrained scalars are checked

`<PositiveInt>-1` now fails with the scalar’s error (`Minimum allowed value for PositiveInt is 0.`), element by element for `<array<PositiveInt>>`; it used to pass unchecked. A scalar’s `expression` constraint can now be used on a `multi` or array property, where it checks every element; it was a schema error. See [Schema → Custom Scalar Types](schema.md#:~:text=Custom%20Scalar%20Types).

## Expression and scalar-type constraints are enforced

A type-level `constraint expression on (…)` and every constraint on a scalar type (`scalar type EVMAddress extending str { constraint regexp(…); }`) used to be accepted and create nothing. They are now PostgreSQL `CHECK`s, and property-level `expression on (__subject__ …)` compiles through the query compiler instead of being pasted into SQL as text.

- **Before upgrading, check for rows that violate them.** The next `disc migrate` adds the missing checks and fails, applying nothing, if a stored row violates one.
- An expression that can’t be checked on one row (a path through a link, a multi link, a subquery, `datetime_current()`, …) is now a schema error instead of being dropped. So are constraints on links other than `exclusive`, other constraint kinds at type level, and a type-level `exclusive` without `on`.
- Writes that violate one now fail with `ConstraintViolationError`.

See [Schema → `expression on`](schema.md#:~:text=It%20becomes%20a%20PostgreSQL) and [Schema → Custom Scalar Types](schema.md#:~:text=Custom%20Scalar%20Types).

## A skipped insert returns `[]`

A bare `insert … unless conflict` that wrote nothing — a conflict with no `else`, or an `else (update … filter …)` that excluded the row — answered `{ "success": true }`. It now answers `[]`, as in Gel, so a caller can tell “skipped” from “written”. Code that checked for `success` should check for an empty array.

## Durations are ISO 8601

`duration`, `cal::relative_duration` and `cal::date_duration` values come back as Gel’s ISO 8601 text (`PT1H2M`, `P1Y2M3DT4H`, `P3D`, `P0D`) instead of PostgreSQL’s (`01:02:00`, `1 year 2 mons`). `datetime - datetime` no longer folds hours into days (`PT49H`, not `2 days 01:00:00`). Anything that parses or displays duration strings sees the new form; casts still accept both. See [Schema → Date and Time Types](schema.md#:~:text=Durations%20come%20back%20as%20ISO).

## `<json>` casts and `to_json()` follow Gel (breaking)

`<json>'…'` makes a JSON string; it used to parse its text as JSON. `to_json()` takes JSON text and parses it; it used to wrap any value. Replace `<json>'{"a": 1}'` with `to_json('{"a": 1}')`, and `to_json(42)` with `<json>42`. `<json>` of every scalar now works and matches Gel (`bytes` as base64, datetimes in ISO form). `cal::local_date - cal::local_date` is a `cal::date_duration` (`P3D`, was the integer `3`) and `cal::local_date ± cal::date_duration` a `cal::local_date`. See [Functions → `to_json`](functions.md#:~:text=Parses%20JSON%20text).

## Generated client types match what arrives (compile-time)

Regenerating a client can surface type errors that were runtime bugs before:

- A single link selected with a sub-shape is declared `[User]` (`[User] | null` when optional), as it arrives: read `post.author[0].name`. Rust: `Vec<T>` / `Option<Vec<T>>`; Go: `[]T`.
- `insert()` and `update()` return `<Type>MutationResult`, with single links as id strings and no multi links or computed fields. `update()` is typed `<Type>MutationResult | { updated: 0 }`. The Rust and Go clients can now decode these results at all. (The wire format of these results changed later — see [Mutations answer with the set of rows they wrote](#:~:text=Mutations%20answer%20with%20the%20set).)
- In the typed builder, a link picked with `true` is its id (`string`, `string | null`, `string[] | null`); `LinkStub` is deprecated.

See [Codegen](codegen.md#:~:text=MutationResult).

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

With a shape, the result is the projected shape, not every column of `RETURNING *`. With or without a shape, the response is always the row set (`[]` when nothing matched); before, the insert/update forms answered `rows[0] || { success: true }` while the delete form answered an array. The new `select (insert|update|delete …) { … }` form behaves identically. Bare `insert`/`update`/`delete` responses were unchanged at the time (they are now the set of written rows — see [Mutations answer with the set of rows they wrote](#:~:text=Mutations%20answer%20with%20the%20set)), with one correction: a junction-backed multi-link `update` that matched nothing now answers `{ "updated": 0 }` instead of `{ "success": true }`, and a bare insert whose link value is a subselect answers with the row like any other bare insert. See [EdgeQL → Selecting over a mutation](edgeql.md#:~:text=Selecting%20over%20a%20mutation).

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
