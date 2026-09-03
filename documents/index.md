# Disc Documentation

> [Disc](https://disc.sh) is a schema-first, TypeScript-native database built on Deno. It sits on top of PostgreSQL and provides a declarative schema language (SDL), a purpose-built query language (EdgeQL), automatic migrations, and a bundled PostgreSQL instance that requires zero manual setup. Disc is a fork of [Gel](https://geldata.com) (formerly EdgeDB), reimplemented in TypeScript while preserving EdgeQL and SDL.

---

## Quick Links

| I want to…                           | Go to                                             |
| :----------------------------------- | :------------------------------------------------ |
| Get up and running from scratch      | [Getting Started](getting-started.md)             |
| Define types, links, and constraints | [Schema (SDL)](schema.md)                         |
| Write queries and mutations          | [EdgeQL](edgeql.md)                               |
| Look up built-in functions           | [Functions Reference](functions.md)               |
| Use the CLI                          | [CLI Reference](cli.md)                           |
| Manage schema changes over time      | [Migrations](migrations.md)                       |
| Generate a typed client (TS/Rust/Go) | [Codegen](codegen.md)                             |
| Use the TypeScript SDK in my app     | [Client SDK](client-sdk.md)                       |
| Write filter queries against schemas | [Filter API](filter-api.md)                       |
| Configure the Disc server            | [Server Configuration](server.md)                 |
| Set up authentication                | [Auth](auth.md)                                   |
| Add row-level security               | [Access Policies](access-policies.md)             |
| Use extensions                       | [Extensions](extensions.md)                       |
| Browse data in a web UI              | [Admin UI](admin-ui.md)                           |
| Understand the bundled PostgreSQL    | [Bundled PostgreSQL](bundled-postgres.md)         |
| Deploy to production                 | [Production Deployment](production-deployment.md) |
| Deploy on Kubernetes with Helm       | [Production Deployment → Kubernetes (Helm)](production-deployment.md#:~:text=your%20specific%20infrastructure.-,Kubernetes%20(Helm),-Disc%20ships%20a) |
| Send auth emails over SMTP           | [Auth → Email Delivery (SMTP)](auth.md#:~:text=pre%2Dresolved%20endpoints.-,Email%20Delivery%20(SMTP),-Verification%20links%2C%20password) |
| Drive Disc from a Deno script        | [CLI → Programmatic API](cli.md#:~:text=Upgrade%20PostgreSQL%20version-,Programmatic%20API,-Every%20disc%20%3Ccommand) |
| Tune queries, indexes, and caches    | [Performance](performance.md)                     |
| Run Disc via Docker Compose          | [Docker Compose](docker-compose.md)               |
| Run and write tests                  | [Testing](testing.md)                             |
| Cut and publish a release            | [Releasing](releasing.md)                         |

---

## Key Concepts

**Schema-first.** Your data model is defined in `.disc` files using SDL (Schema Definition Language). Disc parses these definitions, generates migrations, creates PostgreSQL tables, and produces TypeScript types -- all from one source of truth.

**EdgeQL.** Disc uses EdgeQL, not SQL, as its primary query language. EdgeQL compiles to PostgreSQL SQL under the hood but provides a cleaner syntax for nested data, filtering, and type-safe queries. You never write raw SQL unless you want to.

**Bundled PostgreSQL.** Running `disc init` downloads and manages a PostgreSQL instance automatically. Users never install, configure, or maintain PostgreSQL directly. For production, an external PostgreSQL can be connected via `--backend-dsn`.

**TypeScript-native.** The entire stack -- schema parser, query compiler, migration engine, server, CLI, and SDK -- is written in TypeScript and runs on Deno. No Python, Rust, or Java dependencies at runtime. (Your *application* need not be TypeScript: `disc codegen` also emits Rust and Go clients that speak the same HTTP API.)

---

## Full Table of Contents

- [Getting Started](getting-started.md) -- Install Deno, create a project, write a schema, run queries, generate types.
- [Schema (SDL)](schema.md) -- Object types, scalar types, links, properties, constraints, defaults, computed fields, abstract types, modules.
- [EdgeQL](edgeql.md) -- `SELECT`, `INSERT`, `UPDATE`, `DELETE`, shapes, filters, ordering, pagination, aggregation, subqueries, parameters.
- [EdgeQL Cheat Sheet](edgeql-cheatsheet.md) -- One-page reference of common EdgeQL forms.
- [Functions Reference](functions.md) -- Built-in scalar functions, aggregate functions, date/time functions, string functions, math functions.
- [CLI Reference](cli.md) -- All CLI commands, flags, and usage examples, plus the programmatic `CLI.*` API for scripting Disc from Deno.
- [Migrations](migrations.md) -- Creating, applying, rolling back, and squashing migrations. Schema diffing and DDL generation.
- [Codegen](codegen.md) -- Generating interfaces, query builders, and client code from your schema, in TypeScript, Rust, or Go.
- [Client SDK](client-sdk.md) -- Using the `DiscClient` to run queries, manage transactions, subscribe to changes, and handle authentication.
- [Filter API](filter-api.md) -- Object-shaped filter queries on the generated client: operators, combinators, link traversal (single, multi-hop, multi-link, junction tables), shape narrowing, ordering, pagination.
- [Server Configuration](server.md) -- Environment variables, ports, connection pools, CORS, WebSockets, logging, and protocol options.
- [Auth](auth.md) -- JWT-based authentication, user registration, login, session management, email delivery over SMTP, and the `AuthManager` SDK.
- [Access Policies](access-policies.md) -- Object-level access policies in SDL, row-level security enforcement, auth context bridging.
- [Extensions](extensions.md) -- Built-in extensions and the extension system architecture.
- [Admin UI](admin-ui.md) -- Schema browser, data viewer, query editor, REPL, and migration history in the web-based admin interface.
- [Bundled PostgreSQL](bundled-postgres.md) -- How Disc downloads, initializes, and manages PostgreSQL. Instance lifecycle, version upgrades, socket configuration.
- [Production Deployment](production-deployment.md) -- TLS, connection pools, health checks, rate limiting, Docker, native binaries, systemd, Kubernetes via Helm, monitoring.
- [Performance](performance.md) -- Indexing strategy, EXPLAIN diagnostics, parse/compile/EXPLAIN caches, pool tuning, key Prometheus gauges, the `deno bench` suite.
- [Docker Compose](docker-compose.md) -- Self-hosted Disc + bundled PostgreSQL via `docker compose up`.
- [Testing](testing.md) -- Running the suite, test categories, authoring new tests, env isolation, PG-backed tests.
- [REST API](rest-api.md) -- Schema-derived REST endpoints for every object type, plus the OpenAPI 3.1 spec at `/api/openapi.json`.
- [Error Codes](error-codes.md) -- The error hierarchy, protocol code map, and what each code means on the wire.
- [Disc-Original Features](original-features.md) -- The deliberate departures from Gel that justify Disc as a fork rather than a port.
- [Releasing](releasing.md) -- How releases are cut and published; the current version is tracked in `version.txt`.
