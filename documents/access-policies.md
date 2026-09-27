# Access Policies

Access policies are declarative, row-level security rules defined directly in your SDL schema. They control which rows a user can select, insert, update, or delete based on the authenticated user’s identity, role, or any other context you define.

Access policies are Disc’s equivalent to Gel’s object-level access control. They compile down to SQL WHERE clauses that are injected into every query touching the protected type.

---

## Enabling Access Policies

Access policies must be explicitly enabled on the server:

```bash
disc serve --enable-access-policies --jwt-secret "your-secret" --enable-auth
```

Or via environment variables:

```bash
export DISC_ENABLE_ACCESS_POLICIES=1
export DISC_JWT_SECRET="your-secret"
export DISC_ENABLE_AUTH=1
disc serve
```

Access policies work best with [authentication](auth.md) enabled, since most policies reference the authenticated user. However, you can use policies without auth for public/anonymous access patterns.

Policies are enforced by the `full` protocol handler, which is the default for `disc serve` and for `new DiscServer({})`. The `simple` handler (an explicit opt-in via `DISC_PROTOCOL=simple` / `protocol: "simple"`) enforces nothing.

**Where policies apply.** Policies reach every mutation wherever it sits in the query — a bare `update`, a `with u := (update …) select u`, the operand of `select (delete …) { id }`, the body of `for … union (insert …)` (including the [bulk insert](edgeql.md#:~:text=Bulk%20insert%20from%20JSON) form), the CTE a multi-link write compiles to, and the statement under `explain analyze`. An update or delete reaches only the objects the caller may both select and update or delete: the policy predicate goes inside its own `WHERE`, and an unconditional `deny` leaves nothing to modify, without an error. Inserted and updated objects are checked after the write, in the same statement: an object that fails the type’s insert or update write policies raises `access policy violation on insert of <Type>` (or `update`) and nothing is written. Select policies narrow every read of a protected type — the top-level select, `with` bindings, `for` iterators, path roots and hops, link and backlink sub-shapes, aggregates and `exists`, and the shape over a mutation’s result. Policies are looked up by the type’s declared name, so `select default::Doc` is filtered exactly like `select Doc`, and a subtype is filtered by its ancestors’ policies as well as its own. Read-only mode (`DISC_READ_ONLY`) likewise rejects nested writes.

**Upsert and row-level update policies.** In `insert … unless conflict on … else (update …)`, the `else` branch updates the conflicting object only when the caller may select and update it; otherwise the object is left as it is. Both branches are checked against the type’s write policies.

**Callers without an identity.** Queries over a WebSocket and over the [binary protocol](server.md#:~:text=Binary%20Protocol) compile as an anonymous caller: no JWT is read there, so a policy that depends on `global current_user` denies them, and the service credential is not honored. Use `POST /query` for anything that depends on who is asking.

---

## SDL Syntax

Access policies are defined inside type declarations in your `.disc` schema files:

```
module default {
  type Post {
    required author: User;
    required body: str;
    published: bool { default := false; };
    required title: str;

    access policy public_read {
      allow select;
      using (.published = true);
    };

    access policy author_full_access {
      allow all;
      using (.author ?= global current_user);
    };
  };
};
```

Each policy has three parts:

1. **Name** -- a unique identifier within the type (`public_read`, `author_full_access`)
2. **Action** -- `allow` or `deny`, followed by the operations it applies to
3. **Using expression** (optional) -- a boolean condition that determines which rows the policy covers

---

## Policy Actions

### Allow vs Deny

- **`allow`** grants access to matching rows
- **`deny`** blocks access, overriding any allow policies

```
access policy editors_can_update {
  allow update;
  using (.editor ?= global current_user);
};

access policy no_delete {
  deny delete;
};
```

### Operations

Policies apply to one or more operations:

| Operation | Description                       |
| :-------- | :-------------------------------- |
| `select`  | Reading rows                      |
| `insert`  | Creating new rows                 |
| `update`  | Modifying existing rows           |
| `delete`  | Removing rows                     |
| `all`     | Shorthand for all four operations |

You can list multiple operations:

```
access policy owner_write {
  allow insert, update, delete;
  using (.owner ?= global current_user);
};
```

---

## Using Expressions

The `using` clause defines a boolean condition evaluated against each row. Only rows where the condition is `true` are accessible.

### Object Property References

Use `.property` syntax to reference the current object’s properties:

```
access policy published_only {
  allow select;
  using (.published = true);
};
```

### Link Traversal

Follow links with dot notation:

```
access policy author_only {
  allow update;
  using (.author ?= global current_user);
};
```

### Coalescing Comparison

The `?=` operator is a coalescing equality check. It returns `false` when either side is empty (rather than returning an empty set), making it safe for comparing optional values and globals:

```
using (.owner.id ?= global current_user_id);
```

### Unconditional Policies

Omit the `using` clause for policies that apply to all rows:

```
access policy public_read {
  allow select;
};

access policy no_delete {
  deny delete;
};
```

### `when` Conditions

`when (<condition>)` limits the objects a policy applies to, as in Gel. The policy applies where both its `when` and its `using` hold. Gel’s one-line form and Disc’s block form are both accepted:

```
access policy admins
  when (global current_role ?= "admin")
  allow all;

access policy no_locked
  when (.locked ?= true)
  deny update, delete;

access policy editors {
  when (global current_role ?= "editor");
  allow select;
};
```

The one-line form can end in a body for `errmessage` and annotations: `access policy p allow select using (…) { errmessage := "…"; };`.

---

## Globals in Policies

Globals provide context values from the authenticated session. These are the primary mechanism for connecting auth identity to row-level security.

### Built-in Globals

| Global                   | Description                                          | Source                     |
| :----------------------- | :--------------------------------------------------- | :------------------------- |
| `global current_user`    | Authenticated user’s ID (empty when unauthenticated) | JWT `sub` claim            |
| `global current_role`    | User’s primary role                                  | First entry in roles array |
| `global current_session` | The authenticated session payload (the JWT claims)   | Verified JWT               |

These three are the only globals Disc resolves directly from the request. The canonical owner check compares the object’s owner link against `current_user`:

```
using (global current_user ?= .owner);
```

> `current_user_id` is **not** a built-in. It is a [custom global](#:~:text=mechanism%20%E2%80%94%20see%20below.-,Custom%20Globals,-You%20can%20define) you declare yourself (`global current_user_id: uuid;`) and is resolved at query time via PostgreSQL’s `current_setting()` mechanism — see below.

### Custom Globals

You can define custom globals in your schema and set them via session variables:

```
module default {
  global current_tenant_id: uuid;

  type Project {
    required name: str;
    required tenant_id: uuid;

    access policy tenant_isolation {
      allow all;
      using (.tenant_id ?= global current_tenant_id);
    };
  };
};
```

Custom globals are resolved at query time using PostgreSQL’s `current_setting()` mechanism, which means they can be set per-session or per-transaction.

---

## Deno-Permission-Aware Policies

Access policies can gate on the running Disc process’s `--allow-*` permission set as a defense-in-depth layer. Even an authorized application user gets an empty result when the runtime sandbox lacks the corresponding permission — useful for restricting whole categories of access (e.g. "this read endpoint must not run on a process without filesystem read") without re-engineering the auth layer.

### `runtime::has_permission(<spec>)`

A built-in policy function that pre-evaluates against `Deno.permissions.querySync(...)` at SQL emission time and inlines the result as `TRUE`/`FALSE` in the generated WHERE clause. Postgres can’t call back into Deno; the permission set is fixed for the life of the process, so caching at SQL emission is correct.

### Spec grammar

| Spec form                            | Maps to                           | Example                           |
| :----------------------------------- | :-------------------------------- | :-------------------------------- |
| `read`                               | `{name: "read"}`                  | `runtime::has_permission("read")` |
| `read:/path`                         | `{name: "read", path: "/path"}`   | `read:/etc/secrets`               |
| `write` / `write:/path`              | `{name: "write", ...}`            | `write:/var/disc/uploads`         |
| `net` / `net:host` / `net:host:port` | `{name: "net", host?: "..."}`     | `net:api.example.com`             |
| `env` / `env:VAR`                    | `{name: "env", variable?: "VAR"}` | `env:DATABASE_URL`                |
| `run` / `run:cmd`                    | `{name: "run", command?: "cmd"}`  | `run:git`                         |
| `sys` / `sys:KIND`                   | `{name: "sys", kind?: "KIND"}`    | `sys:hostname`                    |
| `ffi` / `ffi:/lib`                   | `{name: "ffi", path?: "..."}`     | `ffi:/usr/lib/libfoo.so`          |

The spec parser is strict — unknown names (`"filesystem"`, `"admin"`) and empty scopes (`"read:"`) throw a `ValidationError` at policy-load time so SDL typos fail fast rather than silently always-denying.

### Example

```
module default {
  type SecretDoc {
    required title: str;
    required body: str;

    access policy filesystem_required {
      allow select;
      using (
        global current_user
        and runtime::has_permission("read:/etc/disc/secrets")
      );
    };
  };
};
```

A SELECT against `SecretDoc` returns rows only when (a) the request is authenticated **and** (b) the Disc process was started with `--allow-read=/etc/disc/secrets`. Drop the flag and the same query — same user, same JWT — returns an empty set.

### Composition

`runtime::has_permission(...)` composes with every other policy expression. The spec argument **must** be a string literal — non-literal arguments are rejected at policy parse time with a `ValidationError`, since arbitrary expression args have undefined semantics.

### Test seam

Production code calls `Deno.permissions.querySync(...)` via the `defaultPermissionChecker`. Tests inject a `PermissionChecker` mock through `AccessContext.permissionChecker` to assert deterministic `granted`/`denied`/`prompt` outcomes without depending on the test runner’s `--allow-*` flags. See `access/runtime-permissions.test.ts` for the pattern.

---

## Evaluation Order

For each operation (`select`, `insert`, `update`, `delete`), a type’s policies decide object by object, as in Gel:

1. **No policies on the type** — the `defaultAllow` setting decides. The server runs with `defaultAllow: true`, so a type without policies is unrestricted.
2. **Allow policies form a union.** An object is accessible when at least one `allow` policy for the operation applies to it: its `when` and `using` both hold (a policy with neither applies to every object). When the type has policies but none allows the operation, nothing is accessible — `defaultAllow` is not consulted.
3. **Deny policies subtract.** An object a `deny` policy for the operation applies to is removed, even if an allow covers it. For a select, update or delete the deny becomes a filter, so an unconditional deny leaves nothing to read or modify, without an error; for an insert or update, the write check fails each object it applies to.

Conditions are decided for each object by PostgreSQL, never in memory: an SDL `using` or `when` compiles through the query compiler, so it can follow links and backlinks, call functions and read globals. The objects a condition reads are not narrowed by their own types’ policies.

`AccessEvaluator` also takes a `mode`. `permissive` (what the server uses) and `restrictive` reach the same verdicts; `restrictive` stops at the first deny that applies to every object and reports that policy’s errmessage.

Configure the mode programmatically:

```typescript
const evaluator = new AccessEvaluator({
  defaultAllow: false,
  enableAudit: false,
  enableRLS: true,
  mode: "permissive" // or "restrictive"
});
```

---

## Service credential

A trusted backend — your own API server, a job runner, a migration script — usually needs to read and write everything and authorize in its own code. Rather than minting a user JWT for it (which needs a live session row and expires), configure a **service credential**: a static token the server knows, presented as a bearer.

```bash
# At least 32 bytes; the server refuses to start with a shorter one.
export DISC_SERVICE_TOKEN="$(openssl rand -base64 48)"
disc serve --enable-access-policies

# Or on the command line — visible in `ps`, so prefer the env var.
disc serve --service-token "$TOKEN"
```

```bash
curl -X POST http://127.0.0.1:5656/query \
  -H "Authorization: Bearer $DISC_SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "select Locked { id }"}'
```

What the server does with it:

- **Identity.** A request that presents the token resolves to `userId` `"service"`, roles `["service"]`, with **every** access policy bypassed — select, insert, update and delete, including nested, `with`-form, `select (mutation)` and bulk-insert mutations. No `X-Disc-Apply-Access-Policies` header is needed. Inside a service query, `global current_user` is the string `"service"`, so do not compare it with a uuid column.
- **Only the header.** The token is matched on `Authorization: Bearer <token>` only — never a cookie, URL parameter or body field. A wrong bearer is not the service: it falls through to ordinary JWT verification, so a near-miss is simply anonymous (or `401` under `DISC_REQUIRE_AUTH=true`). Comparison is a constant-time compare of SHA-256 digests.
- **Scope.** `POST /query`, `POST /transaction/{begin,commit,rollback}` and `/config` only; it is an administrator there, so it may run persistent `configure` (see [EdgeQL → Who may configure](edgeql.md#:~:text=Who%20may%20configure)). REST (`/api/*`), WebSocket, `/schema`, `/stats`, extension routes and the binary listener do **not** honor it; there it is an invalid JWT.
- **Auth on or off.** It works with auth disabled (`DISC_ENABLE_AUTH=false`, or no JWT secret) and with `DISC_REQUIRE_AUTH=true` — the service needs no JWT and is accepted even when no auth provider is configured.
- **Transactions.** A transaction the service opens is owned by `"service"`: a user cannot query into, commit or roll it back, and the service cannot drive a user’s.
- **Configuration.** `DISC_SERVICE_TOKEN` or `--service-token` only; it is deliberately not a `disc.toml` key because that file is committed. Minimum 32 bytes (UTF-8), else `disc serve` exits with `DISC_SERVICE_TOKEN (--service-token) must be at least 32 bytes; got N`. The server warns at boot when a token is set but `DISC_ENABLE_ACCESS_POLICIES` is off, because the bypass then means nothing. SIGHUP does not rotate or drop it; restart to change it.
- **Observability.** `/stats` → `queries.bypassed` counts `/query` requests run with policies bypassed (service or admin header). A debug log line `Service credential query` carries a query hash and request id. The token never appears in `/config`, `/stats`, `/`, logs or error messages.
- **Transport.** It is a long-lived bearer with full bypass: send it only over TLS or a loopback/private interface (`DISC_HOST=127.0.0.1`), keep it out of browsers, and rotate by restart. See [Production Deployment](production-deployment.md#:~:text=Service%20credential%20for%20backends).

From the SDK, derive a client that carries the token without touching the credentials of the client your users’ requests go through:

```typescript
const service = client.withToken(Deno.env.get("DISC_SERVICE_TOKEN")!);

await service.transaction(async tx => {
  await tx.query("insert Locked { name := <str>$n }", { n: "audit" });
});
```

`withToken(token)` and `withHeaders(headers)` return derived clients sharing base URL, timeout, headers, retries, logger, schema epoch and generated builders — but not credentials — and a `Transaction` uses the credential of the client that opened it. This is preferred over `setAuthToken` on a shared client.

---

## Per-request bypass (admin-only)

Admin-role callers can opt out of policy injection on a single request via the `X-Disc-Apply-Access-Policies: false` header. This mirrors Gel’s session-level `apply_access_policies := false` and is useful for support tooling that needs to read across tenants, or admin scripts that intentionally want unfiltered output. For a backend that always needs unfiltered access, use the [service credential](#:~:text=Service%20credential) instead.

```bash
curl -X POST http://localhost:5656/query \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "X-Disc-Apply-Access-Policies: false" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT User { name, email }"}'
```

**Gating.** The HTTP layer reads the JWT’s `roles` claim and only honors the header when `roles` includes `"admin"` or `"superuser"` (the role `disc admin create-superuser` grants). Other callers who set the header have it silently dropped at the boundary — there is no way for a regular user to escalate by setting the header. Bypassed requests are counted in `/stats` → `queries.bypassed`.

**Cache safety.** The compilation cache key embeds the bypass flag so a bypassed result is never served to a non-bypassed call (and vice versa). Two requests with the same EdgeQL but different bypass state compile independently.

**Truthy values.** The header value is normalized: `false`, `0`, and `no` (case-insensitive, trimmed) all opt out. Any other value (including absent, empty, `true`, `1`) keeps policies enforced.

The implementation lives in [`server/http-handlers.ts:handle_query`](https://github.com/systemsoft/disc/blob/primary/server/http-handlers.ts#:~:text=protected%20async%20handle_query) (header parsing + role gate) and the compiler (`restrictObjectReads` in `compiler/compiler-base.ts` for reads, `mutationAccessCondition` in `compiler/compiler.ts` for insert/update/delete; both short-circuit on `AccessContext.bypass`). ([gh/geldata#6358](https://github.com/geldata/gel/issues/6358))

## Per-policy disable (admin-only) ([gh/geldata#6432](https://github.com/geldata/gel/issues/6432) slice 3)

When you want to test how _one_ policy behaves without nuking the whole stack, the `X-Disc-Disable-Policies` header takes a comma-separated list of qualified policy names (`<TypeName>.<policy_name>`) and silently skips them in the evaluator. The evaluator behaves as if those policies weren’t declared at all — same fall-back to `defaultAllow` semantics.

```bash
# Disable a single policy, leave the rest in force
curl -X POST http://localhost:5656/edgeql \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "X-Disc-Disable-Policies: Doc.owner_only" \
  -d '{"query": "select Doc { id, title }"}'

# Disable several at once
curl -X POST http://localhost:5656/edgeql \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "X-Disc-Disable-Policies: Doc.owner_only, User.admin_check" \
  -d '{"query": "select Doc { id, title, author: { name } }"}'
```

Same gate as the apply-bypass header (`admin` or `superuser` role): any other caller setting the header has it dropped at the boundary, never reaching the compiler. The compilation cache key embeds the disabled set so a disabled-policies call can’t share a cache slot with a regular call.

This is the surgical alternative to the all-or-nothing `X-Disc-Apply-Access-Policies: false` bypass — useful when you’re isolating one policy at a time during testing or debugging an authorization regression.

The implementation lives in `server/http-handlers.ts:handle_query` (header parsing + role gate), `server/edgeql-protocol.ts:handleRequest` (threading into AccessContext + cache-key embedding), and `access/evaluator.ts:evaluate` (qualified-name filter before policy evaluation).

## Run-in-isolation: `disc admin test-policy` ([gh/geldata#6432](https://github.com/geldata/gel/issues/6432) slice 4)

When you want to debug _why_ a specific policy is denying a specific user — without spinning up the server or wiring an admin token — the `disc admin test-policy` CLI runs a single policy (or every policy on a type) against a synthetic `AccessContext` built from flags. Pure SDL + in-memory evaluator; no DB hookup.

```bash
# Evaluate one policy against a synthetic user
disc admin test-policy Doc.owner_only \
  --action select \
  --user-id u1 \
  --global current_user=u1

# Output:
#   Doc.owner_only (select): ALLOW (12µs)
#     reason: Allowed by permissive policy
#     sql: ($1 = u1)

# --all mode: walk every policy on the type
disc admin test-policy Doc --all \
  --action delete \
  --user-id u1 \
  --user-role admin \
  --global is_admin=true

# Output:
#   Doc.owner_only (delete): DENY (8µs)
#     reason: No allowing policy found
#   Doc.admin_override (delete): ALLOW (5µs)
#     reason: Allowed by permissive policy
#     sql: ($1 = true)
```

Flags:

| Flag                 | Meaning                                                                 |
| :------------------- | :---------------------------------------------------------------------- |
| `<Type>.<policy>`    | The policy to evaluate (positional). Use `<Type>` with `--all` instead. |
| `--all`              | Evaluate every policy on the type                                       |
| `--action <op>`      | `select` (default), `insert`, `update`, `delete`, or `all`              |
| `--user-id <id>`     | `AccessContext.userId`                                                  |
| `--user-role <role>` | `AccessContext.userRole`                                                |
| `--global key=value` | Add to `AccessContext.globals` (repeatable)                             |
| `--schema <file>`    | Override default `./dbschema/default.disc`                              |

Each policy runs through a fresh `AccessEvaluator` so global mode/defaultAllow don’t muddy the per-policy verdict. The output includes the verdict (ALLOW/DENY), the reason, the policy’s errmessage if it carries one, the generated SQL condition, and the evaluation time in microseconds.

This complements the `X-Disc-Disable-Policies` header above:

- **Disable header** — debug behavior of a live query with one policy turned off.
- **`test-policy`** — debug a single policy itself in isolation, no live query needed.

The implementation lives in `cli/admin.ts:testPolicyImpl` (pure function exported for testing) and `cli/main.ts` (CLI routing). The exported `collectAccessPolicyAst(sdl)` helper exposes the raw AST shape for tests that don’t want to drive the evaluator path.

---

## Auth + Access Flow

When a request arrives, Disc builds the access context from the authenticated JWT:

```plain
Request with JWT
    ↓
AuthMiddleware.authenticate()
    ⏐  extracts and verifies JWT
    ↓
AuthContext { userId, roles, permissions, jwtClaims }
    ↓
authContextToAccessContext()
    ⏐  bridges server auth to access module
    ↓
AccessContext { userId, userRole, globals, sessionData }
    ↓
AccessEvaluator.evaluate(objectType, operation, context)
    ⏐  checks all registered policies
    ↓
AccessDecision { allowed, sqlConditions }
    ↓
EdgeQLCompiler (restrictObjectReads, mutationAccessCondition, write checks)
    ⏐  narrows every read, scopes each update/delete, checks each written object
    ↓
PostgreSQL executes filtered query
```

The bridge function maps auth claims to access context:

```typescript
function authContextToAccessContext(
  auth: AuthContext,
  sessionGlobals?: Map<string, unknown>
): AccessContext {
  return {
    globals: sessionGlobals,
    sessionData: auth.jwtClaims,
    userId: auth.userId,
    userRole: auth.roles.length > 0 ? auth.roles[0] : undefined
  };
}
```

---

## SQL Injection

Access policies are enforced by injecting SQL WHERE clauses into compiled queries. This happens transparently -- you write EdgeQL as normal, and the access layer modifies the generated SQL before it reaches PostgreSQL.

For SELECT queries, conditions filter which rows are returned:

```sql
-- Original compiled SQL
SELECT jsonb_build_object('title', p.title, 'body', p.body)
FROM posts p

-- After access policy injection
SELECT jsonb_build_object('title', p.title, 'body', p.body)
FROM posts p
WHERE (p.published = true) AND (p.author_id = 'd290f1ee-...')
```

For `UPDATE` and `DELETE` queries, conditions restrict which rows can be modified. If a policy denies the operation entirely, the statement modifies nothing, without an error (as in Gel). The predicate is added inside the mutation itself, so it travels with the statement into a `with` binding, a `select (update …) { … }` wrapper or a multi-link CTE:

```sql
-- select (update Doc filter .id = <uuid>$id set { title := "x" }) { id }
WITH m AS (
  UPDATE doc SET title = 'x' WHERE (owner_id = 'd290f1ee-...') AND (doc.id = CAST($1 AS uuid)) RETURNING *
) SELECT jsonb_build_object('id', m_1.id) FROM m AS m_1
```

For `INSERT` queries, and for the objects an `UPDATE` writes, each written object is checked against the write policies (and any `with check`) after the write, in the same statement. An object that fails raises `access policy violation on insert of <Type>` (or `update`) — `ACCESS_POLICY_ERROR`, HTTP `403` — and nothing is written; this covers inserts nested in `for … union (insert …)` and in link assignments too.

---

## Examples

### Owner-Only Access

Users can only see and modify their own records:

```
module default {
  type Profile {
    bio: str;
    required display_name: str;
    required user_id: uuid;

    access policy owner_only {
      allow all;
      using (.user_id ?= global current_user_id);
    };
  };
};
```

### Public Read, Authenticated Write

Anyone can read published content. Only the author can create, update, or delete:

```
module default {
  type Article {
    required author: User;
    required content: str;
    published: bool { default := false; };
    required title: str;

    access policy public_read {
      allow select;
      using (.published = true);
    };

    access policy author_read_own {
      allow select;
      using (.author ?= global current_user);
    };

    access policy author_write {
      allow insert, update, delete;
      using (.author ?= global current_user);
    };
  };
};
```

### Multi-Tenant Isolation

Rows are scoped to a tenant using a global:

```
module default {
  global current_tenant_id: uuid;

  type Customer {
    required email: str;
    required name: str;
    required tenant_id: uuid;

    access policy tenant_isolation {
      allow all;
      using (.tenant_id ?= global current_tenant_id);
    };
  };

  type Invoice {
    required amount: decimal;
    required customer: Customer;
    required tenant_id: uuid;

    access policy tenant_isolation {
      allow all;
      using (.tenant_id ?= global current_tenant_id);
    };
  };
};
```

Every query against `Customer` or `Invoice` is automatically filtered to only return rows matching the current tenant. No tenant can see or modify another tenant’s data.

### Role-Based Access

Restrict operations based on user roles:

```
module default {
  type AuditLog {
    required action: str;
    required timestamp: datetime;
    required actor: User;

    access policy admins_read {
      allow select;
      using (global current_role = "admin");
    };

    access policy no_modifications {
      deny insert, update, delete;
    };
  };
};
```

---

## Testing Policies

### Unit Testing

Test policy evaluation directly using the `AccessEvaluator`:

```typescript
import { AccessEvaluator } from "./access/evaluator.ts";

const evaluator = new AccessEvaluator({
  defaultAllow: false,
  enableAudit: false,
  enableRLS: true,
  mode: "permissive"
});

// Register a policy
evaluator.registerPolicy({
  actions: [{ allow: true, operations: ["select", "update"] }],
  condition: { kind: "AccessGlobal", name: "current_user" },
  name: "owner_only",
  objectType: "Profile",
  using: {
    kind: "AccessComparison",
    left: { kind: "AccessPath", path: ["user_id"] },
    operator: "=",
    right: { kind: "AccessGlobal", name: "current_user" }
  }
});

// Test with authenticated context
const decision = evaluator.evaluate("Profile", "select", {
  userId: "user-123",
  userRole: "member"
});

console.log(decision.allowed); // true
console.log(decision.sqlConditions); // ["(user_id = 'user-123')"]
```

### Integration Testing

Test the full pipeline with a running Disc server:

```bash
# Start server with access policies enabled
DISC_PG_AUTO=1 disc serve --enable-access-policies --enable-auth --jwt-secret "test-secret"

# Register a user
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "testpass123"}'

# Use the returned token to query
curl -X POST http://localhost:8080/query \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"query": "select Profile { display_name }"}'
```

Run the access module test suite:

```bash
# Unit tests (46 tests)
deno test access/ --allow-all --no-check

# Integration tests with PostgreSQL
DISC_PG_AUTO=1 deno test server/access-pg.test.ts --allow-all --no-check
```

---

## Limitations

The following features are not yet implemented:

- **Column-level policies** -- policies currently apply at the row level only. Column-level restrictions for UPDATE operations are planned.
- **PostgreSQL RLS passthrough** -- policies are currently enforced at the application level via SQL injection. Native PostgreSQL RLS policy generation is implemented (`AccessSQLInjector.generateRLSPolicies()`) but not yet wired into the migration engine.
- **Audit logging** -- the `enableAudit` config flag is accepted but audit logging is not yet implemented.
- **Identity over WebSocket and the binary protocol** -- both compile as anonymous; there is no way to carry a Disc user or the service credential over them yet.

---

## Related

- [Authentication](auth.md) -- JWT auth that provides the identity context
- [Schema](schema.md) -- SDL reference including access policy syntax
- [Extensions](extensions.md) -- the access module is also available as an extension adapter
