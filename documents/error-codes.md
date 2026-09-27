# Error Codes

> **Note:** This file is hand-maintained. When the error hierarchy in [`lib/errors.ts`](https://github.com/systemsoft/disc/blob/primary/lib/errors.ts) or the protocol code map in [`protocol/binary-server.ts`](https://github.com/systemsoft/disc/blob/primary/protocol/binary-server.ts) changes, update this document to match. Ports the request in [geldata/gel#6648](https://github.com/geldata/gel/issues/6648).

Disc surfaces errors in three layers:

1. **Disc error classes** — TypeScript subclasses of `DiscError` raised by the parser, compiler, runtime, and protocol layers. These are what your code catches when calling Disc as a library.
2. **HTTP error envelopes** — what `POST /query` and `POST /transaction/*` return, with a string `extensions.code` and, for failures inside PostgreSQL, the SQLSTATE. The TypeScript SDK turns these into its own [error classes](client-sdk.md#:~:text=Error%20Hierarchy).
3. **Gel wire protocol error codes** — 32-bit numeric codes returned to clients over the binary protocol. Disc maps each error class to one of these codes for compatibility with the existing Gel client SDKs.

When you receive an error from a Disc client SDK, the `code` field is a protocol code (column 2 below); the `name` field corresponds to a Disc error class (column 1).

---

## Table of Contents

- [HTTP Error Envelopes](#:~:text=Protocol%20Code%20Mapping-,HTTP%20Error%20Envelopes,-A%20failed%20POST)
- [Disc Error Classes](#:~:text=Protocol%20Code%20Mapping-,Disc%20Error%20Classes,-All%20errors%20inherit)
- [Gel Protocol Error Codes](#:~:text=over%20HTTP.-,Gel%20Protocol%20Error%20Codes,-These%20are%20the)
- [Class → Protocol Code Mapping](#:~:text=UnsupportedBackendFeatureError-,Class%20%E2%86%92%20Protocol%20Code%20Mapping,-Performed%20by%20mapErrorToGelCode)

---

## HTTP Error Envelopes

A failed `POST /query` answers `{ "errors": [{ "message", "extensions": { "code", … } }] }`. The HTTP status is `400` for every query error except an access policy violation or a refused persistent `configure` (`403`), `408` for a timeout and `500` for an internal error; `413` (body too large), `401`/`403`, `404` and `429` come from the HTTP layer with a plain `{ "error": "…" }` body.

| `extensions.code`     | Status | Meaning                                                                                                                                    | Aborts an open transaction? |
| :-------------------- | :----- | :----------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------- |
| `VALIDATION_ERROR`    | 400    | Malformed request, or a variable problem: a missing variable (`Missing variable: the query uses $x, …`), an unknown one (`Unknown variable: $typo was provided, …`), or an invalid `bytes` value (not base64 / `\x` hex). Nothing reached the database. | No                          |
| `SYNTAX_ERROR`        | 400    | The query does not start with a valid statement or has unbalanced braces.                                                                  | No                          |
| `PARSE_ERROR`         | 400    | The EdgeQL parser rejected the query.                                                                                                      | No                          |
| `COMPILATION_ERROR`   | 400    | The compiler rejected it: unknown type or function, unresolvable conflict target, `<bytes>` from JSON… | No                          |
| `READ_ONLY_MODE`      | 400    | The server is read-only and the query contains a write (anywhere in it, including nested in `with`/`for`/`select (…)`).                    | No                          |
| `QUERY_TOO_LARGE`     | 400    | Query text over 100 KB.                                                                                                                    | No                          |
| `EXECUTION_ERROR`     | 400    | PostgreSQL rejected the statement. `extensions.sqlState` is the SQLSTATE; `constraint`, `table` and `detail` are present when PostgreSQL sent them. | **Yes**                     |
| `CONFIGURATION_ERROR` | 400    | `configure` of a key outside the allowlist (`unrecognized configuration parameter`), or `configure session` of a system-level key (use `configure system`). Nothing reached the database. | No                          |
| `DISABLED_CAPABILITY` | 403    | Persistent `configure` (`system`, `database`, `instance`) by a caller who isn’t an administrator (`cannot execute configuration commands`). | No                          |
| `ACCESS_POLICY_ERROR` | 403    | An object the statement writes fails the type’s access policies: `access policy violation on insert of <Type>` (or `update`), SQLSTATE `42501`. Nothing was written. | **Yes**                     |
| `TIMEOUT`             | 408    | The request exceeded `DISC_REQUEST_TIMEOUT`. The statement’s outcome is unknown.                                                           | **Yes**                     |
| `INTERNAL_ERROR`      | 500    | The handler crashed.                                                                                                                       | **Yes**                     |
| `TRANSACTION_ABORTED` | 409    | `POST /transaction/commit` on a transaction poisoned by an earlier failure; it has been rolled back and the id is gone.                    | —                           |
| `WARNING`             | 200    | Not an error (dry-run mode).                                                                                                               | No                          |

SQLSTATEs worth matching on: `23505` unique violation (a duplicate on an `exclusive` constraint or unique index; `constraint` names it), `23503` foreign-key violation, `23514` check violation (a `regexp`, `one_of`, `min_value`… constraint on a property or scalar type, or an `expression on` constraint), `21000` cardinality violation (`assert_single` found several, or an object cast `<T><uuid>$p` named an id no `T` has: `'default::T' with id '…' does not exist`), `40001` serialization failure and `40P01` deadlock (retry the whole transaction). The SDK maps these to `UniqueViolationError`, `ForeignKeyViolationError`, `ConstraintViolationError`, `CardinalityViolationError`, `SerializationFailureError` and `DeadlockError`, all `instanceof DiscQueryError` with `.sqlState`.

`extensions.queryHash` on every response is the SHA-256 hex digest of the query text.

---

## Disc Error Classes

All errors inherit from the abstract base class `DiscError`. Every error carries an optional `ErrorContext` (source snippet, source location, hint) and renders a fully-formatted multi-line message via `formatError()`.

| Class                    | Description                                                                                                                                                                                                                           | Notes                                                                                                   |
| :----------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------ |
| `DiscError` (abstract)   | Base class for every Disc error. Holds `context: { source?, location?, hint? }` and provides `formatError()`.                                                                                                                         | Never thrown directly.                                                                                  |
| `SyntaxError`            | Parse-time syntax error — produced by the SDL or EdgeQL lexers/parsers when the input is structurally invalid.                                                                                                                        | Always carries `location`.                                                                              |
| `SchemaError`            | Schema validation error — references a type/link/constraint that doesn’t exist or violates schema rules.                                                                                                                              | Raised during schema validation and migration.                                                          |
| `QueryError`             | EdgeQL semantic error — path resolution, type inference, or shape construction failure.                                                                                                                                               | The general-purpose query error.                                                                        |
| `CompilationError`       | EdgeQL → SQL compilation failure that isn’t a user-facing schema or syntax problem.                                                                                                                                                   | Internal-ish; usually surfaces during query planning.                                                   |
| `ConfigurationError`     | `configure` of a key outside the allowlist, or `configure session` of a system-level key (a subclass of `CompilationError`). | Maps to `ConfigurationError`. |
| `DisabledCapabilityError` | Persistent `configure` by a caller who isn’t an administrator. | Maps to `DisabledCapabilityError`. |
| `InvalidValueError`      | A value the operation can’t take, found while compiling (a subclass of `CompilationError`): `datetime_get(dt, 'fortnight')`. | Maps to `InvalidValueError`. |
| `ValidationError`        | Value-level validation failure (e.g. constraint, type cast).                                                                                                                                                                          | Maps to `InvalidValueError` on the wire.                                                                |
| `InternalError`          | A bug in Disc itself. The constructor automatically appends `(this is a bug — please file an issue at https://github.com/systemsoft/disc/issues)` to the message. The append is idempotent: re-wrapping doesn’t duplicate the suffix. | Ports [geldata/gel#930](https://github.com/geldata/gel/issues/930).                                                                                  |
| `ConnectionError`        | Failed to reach PostgreSQL, or the connection was lost mid-query.                                                                                                                                                                     | Maps to `BackendUnavailableError`.                                                                      |
| `MigrationError`         | Migration generation or application failure.                                                                                                                                                                                          | Carries the offending DDL when available.                                                               |
| `DatabaseRegistryError`  | A registry-level failure: branch not found, branch already exists, registry corrupted.                                                                                                                                                | Always non-recoverable — no automatic retry.                                                            |
| `DatabaseExecutionError` | A PostgreSQL error wrapped with the originating SQL. Has fields `sql: string` and `cause: Error`.                                                                                                                                     | The PostgreSQL SQLSTATE (or the wrapped Disc error) determines the protocol code. |
| `QueryTimeoutError`      | Query exceeded its configured timeout. Has fields `sql: string` and `timeoutMs: number`. Message is always `"Query timed out after Nms"`.                                                                                             | Maps to `QueryTimeoutError`.                                                                            |
| `TransactionAbortedError` | `commitTransaction()` was called on a transaction that an earlier failed statement had aborted; the manager rolled it back and removed it. Has `transactionId`.                                                                    | `409` `TRANSACTION_ABORTED` over HTTP.                                                                  |

---

## Gel Protocol Error Codes

These are the 32-bit codes Disc returns to binary-protocol clients. They are Gel’s codes (`edb/api/errors.txt`), so existing Gel SDKs pick the right error class — and know which errors to retry. Defined in [`protocol/binary-server.ts`](https://github.com/systemsoft/disc/blob/primary/protocol/binary-server.ts) as `GEL_ERROR_CODES`.

The high byte is the family; subsequent bytes narrow within the family.

### Server / protocol

| Code     | Hex          | Name                      |
| :------- | :----------- | :------------------------ |
| 16777216 | `0x01000000` | `InternalServerError`     |
| 33554432 | `0x02000000` | `UnsupportedFeatureError` |
| 50331648 | `0x03000000` | `ProtocolError`           |
| 50594304 | `0x03040200` | `DisabledCapabilityError` |

### Query

| Code     | Hex          | Name                               |
| :------- | :----------- | :--------------------------------- |
| 67108864 | `0x04000000` | `QueryError`                       |
| 67174400 | `0x04010000` | `InvalidSyntaxError`               |
| 67174656 | `0x04010100` | `EdgeQLSyntaxError`                |
| 67174912 | `0x04010200` | `SchemaSyntaxError`                |
| 67239936 | `0x04020000` | `InvalidTypeError`                 |
| 67240192 | `0x04020100` | `InvalidTargetError`               |
| 67240193 | `0x04020101` | `InvalidLinkTargetError`           |
| 67305472 | `0x04030000` | `InvalidReferenceError`            |
| 67305473 | `0x04030001` | `UnknownModuleError`               |
| 67305477 | `0x04030005` | `UnknownDatabaseError`             |
| 67371008 | `0x04040000` | `SchemaError`                      |
| 67436544 | `0x04050000` | `SchemaDefinitionError`            |
| 67436809 | `0x04050109` | `InvalidConstraintDefinitionError` |
| 67437061 | `0x04050205` | `DuplicateDatabaseDefinitionError` |
| 67502336 | `0x04060100` | `IdleSessionTimeoutError`          |
| 67502592 | `0x04060200` | `QueryTimeoutError`                |
| 67504641 | `0x04060a01` | `IdleTransactionTimeoutError`      |

### Execution

| Code     | Hex          | Name                            |
| :------- | :----------- | :------------------------------ |
| 83886080 | `0x05000000` | `ExecutionError`                |
| 83951616 | `0x05010000` | `InvalidValueError`             |
| 83951617 | `0x05010001` | `DivisionByZeroError`           |
| 83951618 | `0x05010002` | `NumericOutOfRangeError`        |
| 83951619 | `0x05010003` | `AccessPolicyError`             |
| 84017152 | `0x05020000` | `IntegrityError`                |
| 84017153 | `0x05020001` | `ConstraintViolationError`      |
| 84017154 | `0x05020002` | `CardinalityViolationError`     |
| 84017155 | `0x05020003` | `MissingRequiredError`          |
| 84082688 | `0x05030000` | `TransactionError`              |
| 84082945 | `0x05030101` | `TransactionSerializationError` |
| 84082946 | `0x05030102` | `TransactionDeadlockError`      |

### Configuration

| Code      | Hex          | Name                 |
| :-------- | :----------- | :------------------- |
| 100663296 | `0x06000000` | `ConfigurationError` |

### Access and authentication

| Code      | Hex          | Name                  |
| :-------- | :----------- | :-------------------- |
| 117440512 | `0x07000000` | `AccessError`         |
| 117506048 | `0x07010000` | `AuthenticationError` |

### Availability

| Code      | Hex          | Name                      |
| :-------- | :----------- | :------------------------ |
| 134217728 | `0x08000000` | `AvailabilityError`       |
| 134217729 | `0x08000001` | `BackendUnavailableError` |

### Backend

| Code      | Hex          | Name                             |
| :-------- | :----------- | :------------------------------- |
| 150995200 | `0x09000100` | `UnsupportedBackendFeatureError` |

---

## Class → Protocol Code Mapping

Performed by `mapErrorToGelCode()` in [`protocol/binary-server.ts`](https://github.com/systemsoft/disc/blob/primary/protocol/binary-server.ts). An error PostgreSQL raised is mapped by its SQLSTATE, as Gel does: `23502` → `MissingRequiredError`, `23000`/`23001`/`23503`/`23505`/`23514`/`23P01` (unique, foreign key, check, exclusion) → `ConstraintViolationError`, `21000` → `CardinalityViolationError`, `22012` → `DivisionByZeroError`, `22003`/`22015` → `NumericOutOfRangeError`, other `22xxx` → `InvalidValueError`, `42501` (an access policy violation) → `AccessPolicyError`, `40001` → `TransactionSerializationError`, `40P01` → `TransactionDeadlockError`, `25006`/`25P02` → `TransactionError`, `57014` → `QueryTimeoutError`, `08xxx` and `57P01`–`57P03` → `BackendUnavailableError`, `0A000` → `UnsupportedBackendFeatureError`; any other SQLSTATE → `InternalServerError`. Otherwise by class:

| Disc class                             | Gel code                                  |
| :------------------------------------- | :---------------------------------------- |
| `SyntaxError`                          | `EdgeQLSyntaxError` (`0x04010100`)        |
| `SchemaError`                          | `SchemaDefinitionError` (`0x04050000`)    |
| `InvalidReferenceError`                | `InvalidReferenceError` (`0x04030000`)    |
| `InvalidValueError`                    | `InvalidValueError` (`0x05010000`)        |
| `ConfigurationError`                   | `ConfigurationError` (`0x06000000`)       |
| `DisabledCapabilityError`              | `DisabledCapabilityError` (`0x03040200`)  |
| `CompilationError`, `QueryError`       | `QueryError` (`0x04000000`)               |
| `ValidationError`                      | `InvalidValueError` (`0x05010000`)        |
| `DatabaseExecutionError`               | Its `cause`’s code, else `InternalServerError` |
| `QueryTimeoutError`                    | `QueryTimeoutError` (`0x04060200`)        |
| `ConnectionError`                      | `BackendUnavailableError` (`0x08000001`)  |
| `InternalError`, _anything else_       | `InternalServerError` (`0x01000000`)      |
