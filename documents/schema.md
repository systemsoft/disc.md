# Schema Definition Language (SDL) Reference

Disc uses a declarative Schema Definition Language to define your data model. Schema files use the `.disc` extension and describe object types, their properties, links between types, constraints, indexes, access policies, and more.

Disc parses SDL into an abstract syntax tree, validates it, and generates the corresponding PostgreSQL DDL. You write your schema once; Disc handles table creation, foreign keys, constraints, and migrations.

---

## Table of Contents

- [Modules](#:~:text=Complete%20Example-,Modules,-Every%20declaration%20lives)
- [Scalar Types](#:~:text=default%20module-,Scalar%20Types,-Disc%20supports%20all)
- [Object Types](#:~:text=validated%20by%20Disc.-,Object%20Types,-Object%20types%20are)
- [Properties](#:~:text=Admin%20extending%20Named%3B%0A%7D%3B-,Properties,-Properties%20define%20the)
- [Constraints](#:~:text=not%20stored%20directly-,Constraints,-Constraints%20enforce%20data)
- [Links](#:~:text=zA%2DZ0%2D9_%5D%2B%24%22\)%3B%0A%20%20%20%20%7D%3B%0A%20%20%7D%3B%0A%7D%3B-,Links,-Links%20define%20relationships)
- [Indexes](#:~:text=the%20same%20name.-,Indexes,-Indexes%20improve%20query)
- [Annotations](#:~:text=Email%20lookup%20index%22%3B%0A%20%20%20%20%7D%3B%0A%20%20%7D%3B%0A%7D%3B-,Annotations,-Annotations%20attach%20metadata)
- [Inheritance](#:~:text=Non%2Dnegative%20total%22%3B%0A%20%20%20%20%7D%3B%0A%20%20%7D%3B%0A%7D%3B-,Inheritance,-Disc%20supports%20type)
- [Access Policies](#:~:text=constraint%20max_len_value(100)%3B%0A%20%20%20%20%7D%3B%0A%20%20%7D%3B%0A%7D%3B-,Access%20Policies,-Access%20policies%20control)
- [Triggers](#:~:text=using%20(global%20current_user_is_admin)%3B%0A%20%20%20%20%7D%3B%0A%20%20%7D%3B%0A%7D%3B-,Triggers,-Triggers%20execute%20logic)
- [Rewrite Rules](#:~:text=the%20operation%20executes-,Rewrite%20Rules,-Rewrite%20rules%20automatically)
- [Globals](#:~:text=on%20any%20modification.%22-,Globals,-Globals%20are%20session)
- [Aliases](#:~:text=disc.global_default__current_user_id\).-,Aliases,-Aliases%20define%20named)
- [Collection Types](#:~:text=or%20store%20data.-,Collection%20Types,-Arrays)
- [Range Types](#:~:text=as%20JSON%20keys.-,Range%20Types,-Range%20types%20represent)
- [Complete Example](#:~:text=required%20name%3A%20str%3B%0A%20%20%7D%3B%0A%7D%3B-,Complete%20Example,-Here%20is%20a)

---

## Modules

Every declaration lives inside a module. Modules provide namespacing for types, functions, globals, and aliases.

### The `default` Module

Most schemas use the `default` module. Types in the default module can be referenced without qualification:

```sdl
module default {
  type User {
    required email: str;
    required name: str;
  };
};
```

### Custom Modules

You can define multiple modules to organize your schema. Types in custom modules are referenced with the `module::TypeName` syntax:

```sdl
module default {
  type User {
    required name: str;
    multi payments: payment::Payment;
  };
};

module payment {
  type Payment {
    required amount: decimal;
    required currency: str;
    required merchant: default::User;
  };
};

module api {
  type ApiKey {
    required active: bool;
    required key: str {
      constraint exclusive;
    };
  };
};
```

Within a module, you reference types in the same module without qualification. Cross-module references require the `module::TypeName` form.

### Module Resolution Order

When Disc resolves an unqualified type name, it checks in this order:

1. Exact match (already qualified or known at top level)
2. Current module scope (if set via `WITH MODULE`)
3. `default` module

---

## Scalar Types

Disc supports all standard scalar types. These map directly to PostgreSQL column types.

### String and Boolean

| SDL Type | Description         | PostgreSQL Type |
| :------- | :------------------ | :-------------- |
| `bool`   | Boolean true/false  | `boolean`       |
| `str`    | Unicode text string | `text`          |

### Integer Types

| SDL Type | Description           | Range           | PostgreSQL Type |
| :------- | :-------------------- | :-------------- | :-------------- |
| `int16`  | 16-bit signed integer | :32768 to 32767 | `smallint`      |
| `int32`  | 32-bit signed integer | :2^31 to 2^31-1 | `integer`       |
| `int64`  | 64-bit signed integer | :2^63 to 2^63-1 | `bigint`        |

### Floating Point Types

| SDL Type  | Description           | PostgreSQL Type    |
| :-------- | :-------------------- | :----------------- |
| `float32` | 32-bit IEEE 754 float | `real`             |
| `float64` | 64-bit IEEE 754 float | `double precision` |

### Arbitrary Precision

| SDL Type  | Description                 | PostgreSQL Type |
| :-------- | :-------------------------- | :-------------- |
| `bigint`  | Arbitrary precision integer | `numeric`       |
| `decimal` | Arbitrary precision decimal | `numeric`       |

### Date and Time Types

| SDL Type                 | Description               | PostgreSQL Type |
| :----------------------- | :------------------------ | :-------------- |
| `cal::date_duration`     | Date-only interval        | `interval`      |
| `cal::local_date`        | Date without timezone     | `date`          |
| `cal::local_datetime`    | Datetime without timezone | `timestamp`     |
| `cal::local_time`        | Time without timezone     | `time`          |
| `cal::relative_duration` | Relative time interval    | `interval`      |
| `datetime`               | Timezone-aware datetime   | `timestamptz`   |
| `duration`               | Time interval             | `interval`      |

Durations come back as ISO 8601 text, as in Gel: a `duration` as `PT1H2M` (hours never fold into days, so 49 hours is `PT49H`), a `cal::relative_duration` as `P1Y2M3DT4H5M6.5S`, and a `cal::date_duration` as `P3D` (zero is `P0D`). Negative parts carry their own sign (`PT-1H`, `P-3D`). Casts accept both this form and PostgreSQL’s (`<duration>'01:02:00'`), without day, month or year units for a `duration` and without units smaller than days for a `cal::date_duration`, as in Gel.

A `str` cast to `datetime`, `cal::local_datetime`, `cal::local_date` or `cal::local_time` takes only ISO 8601 text, as in Gel: the date and time separated by a space or `T`, a `datetime` with its time zone and the local types without one (`<datetime>'2024-01-15T10:30:00Z'`, `<cal::local_datetime>'2024-01-15 10:30'`). Other text is an `InvalidValueError` (`invalid input syntax for type std::datetime: 'x'`) with Gel’s hint, `Please use ISO8601 format. Example: 2010-12-27T23:59:59-07:00. …`. Read other formats with `to_datetime(s, fmt)` and the `cal::to_local_*` functions.

Date arithmetic has Gel’s result types: `cal::local_date - cal::local_date` is a `cal::date_duration` (`P3D`), and `cal::local_date ± cal::date_duration` is a `cal::local_date`.

### Other Types

| SDL Type   | Description                                   | PostgreSQL Type |
| :--------- | :-------------------------------------------- | :-------------- |
| `bytes`    | Binary data (base64 in JSON, both directions) | `bytea`         |
| `json`     | JSON data                                     | `jsonb`         |
| `sequence` | Auto-incrementing integer                     | `bigint`        |
| `uuid`     | UUID identifier                               | `uuid`          |

### Custom Scalar Types

You can define custom scalar types that extend built-in types and add constraints:

```sdl
module default {
  scalar type Username extending str {
    constraint max_len_value(50);
    constraint min_len_value(3);
  };

  scalar type PositiveInt extending int64 {
    constraint min_value(0);
  };
};
```

A scalar type’s constraints are enforced as PostgreSQL `CHECK`s on every column of that type: in subtypes’ tables, on each element of a `multi` or array property, on link properties, and through scalars that extend it (constraints are inherited). A violation is Gel’s `invalid <Scalar>` error, or the constraint’s `errmessage`. A scalar’s `expression on (__subject__ …)` constraint checks every element of a `multi` or array property. A cast to a constrained scalar checks its constraints too (each element of an array cast), as in Gel: `select <PositiveInt>-1` fails with `Minimum allowed value for PositiveInt is 0.`

A scalar belongs to its module, so two modules may declare the same name (`default::Count extending int64`, `ledger::Count extending str`). A bare scalar name resolves in the module that uses it first, then in `default` — for the column type, the generated clients’ types and casts, and globals (a global of a user scalar or enum has its base type, so `global limit > 9` compares numbers). Columns an earlier version created with another module’s scalar type are converted on the next `disc migrate`, which fails naming the column and value if a stored value doesn’t convert.

### Enum Types

Enums are scalar types that extend `enum` with a fixed set of values:

```sdl
module default {
  scalar type Status extending enum<active, inactive, pending>;

  scalar type Priority extending enum<low, medium, high, critical>;
};
```

Enum values are stored as text in PostgreSQL and validated by Disc.

---

## Object Types

Object types are the primary building blocks of a Disc schema. Each object type maps to a PostgreSQL table.

### Basic Definition

```sdl
module default {
  type User {
    age: int32;
    bio: str;
    required email: str;
    required name: str;
  };
};
```

Every object type automatically gets an `id` property of type `uuid`. You never need to declare it. Its default is a **time-ordered UUIDv7** (RFC 9562), generated server-side by Disc’s built-in `disc_uuidv7()` function — not a random v4. The 48-bit millisecond-timestamp prefix keeps primary-key index inserts sequential and makes `id` roughly sortable by creation time. (This is a deliberate divergence from Gel, which uses random v4 ids.)

### Required vs Optional

Properties and links are optional by default. Use `required` to make them mandatory:

```sdl
module default {
  type User {
    # These must be set on insert
    required email: str;
    required name: str;

    # These are optional (can be empty set)
    age: int32;
    avatar_url: str;
    bio: str;
  };
};
```

### Multi vs Single

By default, properties and links hold a single value (or an empty set if optional). Use `multi` for set-valued properties:

```sdl
module default {
  type User {
    required name: str;
    multi phone_numbers: str;
    multi tags: str;
  };
};
```

A `multi` property can hold zero or more values. A `required multi` property must hold at least one value.

### Empty Type Bodies

Types can extend other types without adding new members:

```sdl
module default {
  abstract type Named {
    required name: str;
  };

  # Admin inherits everything from Named
  type Admin extending Named;
};
```

---

## Properties

Properties define the scalar data stored on an object type.

### Basic Properties

```sdl
module default {
  type Product {
    description: str;
    in_stock: bool;
    required name: str;
    required price: decimal;
    sku: str;
    weight: float64;
  };
};
```

### Default Values

Properties can have default values using the `default` keyword:

```sdl
module default {
  type User {
    active: bool {
      default := true;
    };
    created_at: datetime {
      default := datetime_current();
    };
    required email: str;
    required name: str;
    role: str {
      default := "member";
    };
  };
};
```

A default is parsed with the EdgeQL expression grammar and compiled into the column’s `DEFAULT`, which PostgreSQL evaluates for each insert that leaves the property out. It can be a literal, an array (`['a', 'b']`), a tuple (`(1, 'x')`, `(a := 1, b := 'x')`), arithmetic (`2 + 3`), a cast (`<int64>'7'`), a `json` value (`to_json('{"a": 1}')`), an enum value (`Mood.Sad`), or a function call: `datetime_current()`, `uuid_generate_v4()`, or a `function` the schema declares (`default := greet();`). A changed default migrates to `ALTER COLUMN … SET DEFAULT`; a database migrated by an older Disc sees no change for a default that already worked.

A default that reads the object (`default := .n + 1`) or runs a query (`default := (select count(User)) + 1`) is a schema error naming the type and property. Gel evaluates such a default per insert; Disc can’t yet, because PostgreSQL evaluates a column’s `DEFAULT` before the object exists.

### Readonly Properties

Readonly properties cannot be modified after the object is created:

```sdl
module default {
  type AuditLog {
    required action: str;
    required actor_id: uuid;
    created_at: datetime {
      default := datetime_current();
      readonly := true;
    };
  };
};
```

### Computed Properties

Computed properties derive their value from an expression rather than storing data directly:

```sdl
module default {
  type User {
    required first_name: str;
    required last_name: str;

    # Computed from other properties
    full_name := .first_name ++ " " ++ .last_name;
  };
};
```

Computed properties use the `:=` assignment syntax and reference other properties using the dot prefix (`.property_name`).

The expression is any EdgeQL expression, kept exactly as written: set operators (`.name union 'x'`, `except`, `intersect`), `is`, `//`, `^`, `%`, array literals, `1n`, `b''` and a path off a select (`first_team := (select .teams order by .name limit 1).name`) included. A call to a `function` the schema declares is inlined and typed by its declared return type (see [Functions → SDL Functions](functions.md#:~:text=SDL%20Functions)).

A function is declared in a module, its body one EdgeQL expression. Parameters declared `named only` are passed by name, and the block form sets a volatility:

```sdl
module default {
  type User {
    required first_name: str;
    required last_name: str;
    display := full_name(.first_name, .last_name, sep := ' ');
  };

  function full_name(first: str, last: str, named only sep: str = ', ') -> str using (first ++ sep ++ last);
  function new_user(first: str, last: str) -> User {
    volatility := 'Modifying';
    using (insert User { first_name := first, last_name := last });
  };
};
```

A computed value can be a **named tuple** of aggregates — a common pattern for rollups:

```sdl
counts := ( videos := count(.<channel[is Video]), posts := count(.<channel[is Post]) );
```

Computed properties are read-only outputs: they’re excluded from the `{ * }` splat (select them explicitly) and from insert/update. Fields of a named-tuple computed are filterable — see [Filter API → Computed field filters](filter-api.md#:~:text=Computed%20field%20filters).

A computed that yields objects — a path through a link (`auth := .author`), a backlink (`.<post[is Comment]`) or a `(select …)` of a type — is a computed link: select it with a sub-shape (`auth: { name }`) exactly like a stored link, and follow it in `filter`, `order by`, `exists`, `count`, `in` and paths (`filter .auth.name = "Ada"`, `select Post.first_comment { body }`). A sub-shape’s own `filter`, `order by`, `offset` and `limit` apply to the computed’s result, as in Gel:

```sdl
type Post {
  required title: str;
  single link first_comment := (select .<post[is Comment] order by .created limit 1);
  multi link recent := (select .<post[is Comment] order by .created desc limit 2);
  bodies := .<post[is Comment].body;
};
```

```edgeql
select Post { title, recent: { body } order by .created limit 1 } filter exists .first_comment;
```

A computed over a backlink’s property (`bodies` above) is a multi computed property: an array of its values in a shape, and a set in `filter "…" in .bodies` or `count(.bodies)`.

A computed may be declared in any of Gel’s forms, `[required] [single | multi] [link | property] name := expr;`. Its cardinality is inferred as in Gel: single for a path through single links or a `(select … limit 1)`, multi through a multi link or a backlink; required when the expression is never empty (`.author` of a `required` link). `multi` widens it. `single` narrows it, and is checked as in Gel: on an expression that may yield several values it is the schema error `possibly more than one element returned by an expression for the computed link 'first' of object type 'P' explicitly declared as 'single'` (`property` for a computed property). An expression is provably single when it is a `(select … limit 1)`, a select filtered on `.id` or an `exclusive` property, an `assert_single(…)`, an aggregate (`count`, `array_agg`, …), or an operator over single values. The declared cardinality is what a query returns and what [codegen](codegen.md) declares. `required` on an expression that may be empty is Gel’s error `possibly an empty set returned by an expression for the computed link '…' of object type '…' explicitly declared as 'required'`, and a shape inside a schema computed (`recent := .<post[is Comment] { body }`) is Gel’s error `including a shape on schema-defined computed links is not yet supported`.

### Property Qualifiers Summary

| Qualifier       | Effect                                          |
| :-------------- | :---------------------------------------------- |
| `required`      | Must be set on insert (NOT NULL)                |
| `multi`         | Can hold multiple values (set-valued)           |
| `overloaded`    | Overrides an inherited property definition      |
| `:=` (computed) | Derived from an expression, not stored directly |

---

## Constraints

Constraints enforce data integrity rules on properties and types. The supported constraint names are `exclusive`, `expression`, `max_ex_value`, `max_len_value`, `max_value`, `min_ex_value`, `min_len_value`, `min_value`, `one_of`, and `regexp`; any other name (including non-canonical spellings like `max_length` or `regex`) is rejected at validation time with a hint toward the canonical name.

### `exclusive`

Ensures uniqueness across all instances of a type. This is the most common constraint:

```sdl
module default {
  type User {
    required email: str {
      constraint exclusive;
    };
    required username: str {
      constraint exclusive;
    };
  };
};
```

### Type-level `exclusive` (composite uniqueness)

A type-level `constraint exclusive on (…)` makes a combination of properties and single links unique. It creates a real unique index, so it is enforced by PostgreSQL and can serve as the target of `unless conflict on (…)`:

```sdl
module default {
  type GitRef {
    required name: str;
    required link program -> Program { on target delete cascade; }
    required target: str;

    constraint exclusive on ((.program, .name));
  };
};
```

```sql
CREATE UNIQUE INDEX uk_git_ref_program_id_name ON git_ref (program_id, name);
```

- **Columns** follow declaration order; a single link maps to its foreign-key column `<link>_id`. An element may also be an expression (`constraint exclusive on (str_lower(.email))`), which makes a unique expression index (see [Expression Indexes](#:~:text=becomes%20part%20of%20a%20PostgreSQL%20expression%20index)). Multi links, computed members and multi-step paths are rejected at migration time with a clear message, as is a type-level `exclusive` or `index on` declared on a type that has subtypes (indexes are not inherited).
- **Name**: `uk_<table>_<col1>_<col2>…`, shortened to PostgreSQL’s 63-byte limit with an 8-hex-character hash suffix when needed (names that fit are never changed). A single-column `exclusive on (.x)` on a property that already carries a property-level `constraint exclusive` emits nothing extra.
- **Existing deployments**: the migration engine diffs the stored schema, so a deployment whose baseline already declared the constraint (unenforced by older Disc versions) would never see a diff. `disc migrate` therefore backfills every declared type-level index it cannot find in `pg_indexes` with `CREATE UNIQUE INDEX IF NOT EXISTS …`; `disc migrate --create` previews those statements. The backfill is idempotent — a second run is a no-op.
- **Duplicates**: if existing rows violate the constraint, the migration fails with a message naming the type and the declaration, PostgreSQL’s detail, and a `SELECT … GROUP BY … HAVING count(*) > 1` query that finds the duplicates; nothing is applied. Check for duplicates before migrating a schema whose exclusive was previously unenforced. See [Migrations → Index Operations](migrations.md#:~:text=Index%20Operations).
- A duplicate at runtime is SQLSTATE `23505` (`UniqueViolationError` in the SDK), with `constraint` set to the index name.

### `max_len_value`

Limits the maximum length of a string:

```sdl
module default {
  type User {
    bio: str {
      constraint max_len_value(1000);
    };
    required name: str {
      constraint max_len_value(255);
    };
  };
};
```

### `min_value` and `max_value`

Set bounds on numeric values (inclusive):

```sdl
module default {
  type Product {
    required price: decimal {
      constraint min_value(0);
    };
    required quantity: int32 {
      constraint min_value(0);
      constraint max_value(10000);
    };
  };
};
```

### `min_ex_value` and `max_ex_value`

Exclusive bounds (the bound value itself is not allowed):

```sdl
module default {
  type Measurement {
    required percentage: float64 {
      constraint min_value(0);
      constraint max_ex_value(100);
    };
    required temperature: float64 {
      # Must be strictly above absolute zero
      constraint min_ex_value(-273.15);
    };
  };
};
```

### `one_of`

Restricts a value to a specific set of allowed values:

```sdl
module default {
  type Config {
    required environment: str {
      constraint one_of("development", "staging", "production");
    };
    required log_level: str {
      constraint one_of("debug", "info", "warn", "error");
    };
  };
};
```

### `expression on`

Custom constraint expressions using EdgeQL:

```sdl
module default {
  type Event {
    required start_time: datetime;
    required end_time: datetime;

    # Custom constraint: end must be after start
    constraint expression on (.end_time > .start_time);
  };
};
```

It becomes a PostgreSQL `CHECK` on the type’s table (and on every concrete subtype’s table when declared on an abstract type). `disc migrate` adds, changes and drops it, rollback undoes it, and a migration that adds one fails as a whole if stored rows already violate it. A write that violates it fails with Gel’s `ConstraintViolationError: invalid <Type>` (or the `errmessage`); an expression that comes out empty passes.

The expression must be checkable on one row: stored properties, single links (`exists .bug` is `bug_id IS NOT NULL`), `and`/`or`/`not`, comparisons, `??`, `if … else`, casts and ordinary functions. Paths through a link (`.bug.title`), multi links and properties, backlinks, aggregates, subqueries, parameters, globals, computed members and non-immutable functions such as `datetime_current()` are a schema error naming the type and constraint. EdgeQL has no `xor`; write “exactly one of” as `(exists .bug) != (exists .patch)`.

On a property, `constraint expression on (len(__subject__) > 2)` compiles the same way, with `__subject__` standing for the property.

A constraint’s expression and arguments are parsed with the EdgeQL expression grammar and kept as written, so set literals, `//` and `^` work in them: `constraint expression on (.tier in {'gold', 'silver'})`, `constraint max_len_value(2 ^ 3)`.

### `regexp`

Validates that a string matches a regular expression pattern:

```sdl
module default {
  type User {
    required email: str {
      constraint exclusive;
      constraint regexp("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$");
    };
    phone: str {
      constraint regexp("^\\+?[1-9]\\d{1,14}$");
    };
  };
};
```

### Custom Error Messages

Constraints can include custom error messages using `errmessage`. It replaces the violation message of `expression` constraints and of a scalar type’s constraints, with `{__subject__}` (and the constraint’s parameter, such as `{min}` or `{pattern}`) filled in; on the other property constraints it is accepted but PostgreSQL’s check-violation message is reported:

```sdl
module default {
  type User {
    required age: int32 {
      constraint min_value(0) {
        errmessage := "Age must be a non-negative number";
      };
      constraint max_value(150) {
        errmessage := "Age cannot exceed 150";
      };
    };
  };
};
```

### Delegated Constraints

Delegated constraints apply through type hierarchies:

```sdl
module default {
  abstract type Named {
    required name: str {
      delegated constraint exclusive;
    };
  };

  # Each subtype enforces uniqueness independently
  type User extending Named;
  type Group extending Named;
};
```

With `delegated`, the `exclusive` constraint is enforced per-subtype rather than across the entire abstract type.

### Multiple Constraints

Properties can have multiple constraints:

```sdl
module default {
  type User {
    required username: str {
      constraint exclusive;
      constraint min_len_value(3);
      constraint max_len_value(30);
      constraint regexp("^[a-zA-Z0-9_]+$");
    };
  };
};
```

---

## Links

Links define relationships between object types. Unlike foreign keys in SQL, links are first-class citizens in Disc schemas.

### Single Links

A single link references one object of the target type. It maps to a foreign key column in PostgreSQL:

```sdl
module default {
  type User {
    required email: str;
    required name: str;
  };

  type Post {
    required author: User;
    required body: str;
    required title: str;
  };
};
```

The `author` link creates an `author_id` foreign key column on the `posts` table.

### Multi Links

A multi link references multiple objects. Disc resolves these as backlinks or many-to-many junction tables:

```sdl
module default {
  type User {
    required name: str;
    multi posts: Post;
  };

  type Post {
    required author: User;
    required title: str;
  };
};
```

When a target type has a single link pointing back (like `Post.author -> User`), Disc detects the backlink automatically. The `multi posts` link does not create its own column; it is resolved via `Post.author_id`.

### Backlinks

Backlinks allow traversing relationships in reverse using the `.<linkname` syntax in queries. They are defined implicitly by the forward link:

```sdl
module default {
  type User {
    required name: str;
    # No explicit link to Post needed -- use .<author in queries
  };

  type Post {
    required author: User;  # This creates the relationship
    required title: str;
  };
};
```

In EdgeQL queries, you can then write:

```edgeql
select User {
  name,
  posts := .<author[is Post] { title }
};
```

### Many-to-Many Links

When both sides of a relationship have `multi` links, Disc creates a junction table:

```sdl
module default {
  type Student {
    multi courses: Course;
    required name: str;
  };

  type Course {
    multi students: Student;
    required title: str;
  };
};
```

Disc creates a junction table (e.g., `student_courses`) with `source_id` and `target_id` columns. The canonical ordering ensures only one junction table is created per pair.

### Link Shorthand

Links can be declared without the `link` keyword using arrow syntax:

```sdl
module default {
  type Post {
    required title: str;

    # These are equivalent:
    required link author -> User;
    required author: User;  # Shorthand (arrow inferred)
  };
};
```

Both forms produce identical AST nodes. The shorthand form uses `->` to indicate a link target.

### Deletion Policies

Control what happens when the target or source of a link is deleted.

#### `on target delete`

Specifies behavior when the linked target object is deleted:

```sdl
module default {
  type User {
    required name: str;
  };

  type Post {
    required title: str;

    required author: User {
      # Options:
      on target delete restrict;      # Prevent deletion (default)
      # on target delete cascade;     # Delete this post too
      # on target delete allow;       # Allow, set to empty
      # on target delete deferred restrict;   # Check at transaction end
      # on target delete set empty;   # Set link to empty
    };
  };
};
```

| Policy              | Behavior                                               |
| :------------------ | :----------------------------------------------------- |
| `restrict`          | Prevent deletion of target if any source references it |
| `cascade`           | Delete this object when the target is deleted          |
| `allow`             | Allow deletion, link becomes empty                     |
| `deferred restrict` | Like restrict, but checked at transaction commit       |
| `set empty`         | Set the link to empty when target is deleted           |

#### `on source delete`

Specifies behavior when the source object (the one holding the link) is deleted:

```sdl
module default {
  type User {
    required name: str;
    multi sessions: Session {
      on source delete delete target;
    };
  };

  type Session {
    required token: str;
    required user: User;
  };
};
```

| Policy                    | Behavior                                                                            |
| :------------------------ | :---------------------------------------------------------------------------------- |
| `allow`                   | Allow source deletion without affecting target                                      |
| `delete target`           | Delete the target objects when the source is deleted                                |
| `delete target if orphan` | Delete each target object that no other object links to after the source is deleted |

### Link Properties

Links can carry their own properties to store metadata about the relationship:

```sdl
module default {
  type User {
    multi friends: User {
      property nickname: str;
      property since: datetime {
        default := datetime_current();
      };
    };
    required name: str;
  };
};
```

Link properties are accessed in queries using the `@` prefix:

```edgeql
select User {
  friends: {
    name,
    @since,
    @nickname
  },
  name
};
```

A link property can also be read, filtered and ordered on in a sub-shape that has an `offset` or `limit`, on the stored link, a computed link to it or a backlink over it: `friends: { name, @since } filter @nickname != "x" order by @since desc limit 5`. It comes back keyed `"@since"`.

A computed link that aliases one link (`ms := .members`) carries its link properties: `ms: { name, @role }`. One through several links (`team_roles := .teams.members`) has none, as in Gel — `team_roles: { @role }` is `link 'team_roles' of object type 'default::Org' has no property 'role'` — but a path reads the property on its last link: `roles := .teams.members@role`.

In a query, a shape on a path through several links reads the last link’s property under a name of its own: `select Org { m := .teams.members { name, lr := @role } }` has one object per link (a member on two teams comes twice), and `(select .teams.members { name, lr := @role } filter @role = 'lead')` filters and orders on it. The shorthand `{ @role }` there is the error above, as in Gel.

### Abstract Links

Abstract links define reusable link templates with shared properties and constraints:

```sdl
module default {
  abstract link timestamped {
    property created_at: datetime {
      default := datetime_current();
    };
    property updated_at: datetime;
  };

  type User {
    multi friends extending timestamped -> User;
    required name: str;
  };
};
```

Concrete links that extend an abstract link inherit its properties and constraints. Properties defined on the concrete link override inherited ones with the same name.

---

## Indexes

Indexes improve query performance on frequently filtered or sorted properties. An index’s expression is parsed with the EdgeQL expression grammar and kept as written.

### Property Indexes

```sdl
module default {
  type User {
    required email: str {
      constraint exclusive;
    };
    required name: str;

    # Index on the name property
    index on (.name);
  };
};
```

### Link Indexes

The foreign-key column of every single link is indexed automatically (`idx_<table>_<link>_id`), so `filter .author = <uuid>$id` and `filter .author.id = <uuid>$id` already use an index. A plain `index on (.author)` would duplicate that index and is skipped (this also applies to a named `index foo on (.author)` — the declared name is not created). Composite indexes over a link are emitted, with the link resolved to its `<link>_id` column:

```sdl
module default {
  type Post {
    required author: User;
    required status: str;

    index on ((.author, .status)); # CREATE INDEX idx_post_author_id_status ON post (author_id, status)
  };
};
```

Indexes declared in a newly created type are emitted right after its `CREATE TABLE`; on an existing deployment, declared indexes missing from `pg_indexes` are backfilled by `disc migrate` (see [Type-level `exclusive`](#:~:text=Type%2Dlevel%20exclusive)).

### Expression Indexes

Indexes can be defined on expressions, not just individual properties:

```sdl
module default {
  type User {
    required email: str;
    required last_name: str;
    required first_name: str;

    # Index on a computed expression
    index on (str_lower(.email));

    # Composite index
    index on ((.last_name, .first_name));
  };
};
```

An element that is an expression, not a property or a link, becomes part of a PostgreSQL expression index, alone or next to columns: `index on (str_lower(.email))` indexes `(lower(email))`, and `index on ((.first_name, str_lower(.last_name)))` indexes `(first_name, lower(last_name))`. A named index (`index full_name on (.first_name ++ ' ' ++ .last_name)`) and a type-level `constraint exclusive on (str_lower(.email))`, which is a unique expression index, compile the same way. An unnamed index is named after its expression (`idx_<table>_str_lower_email`). A changed expression drops the old index and creates the new one.

An index expression may read only the object’s own row and must be immutable: `index on (datetime_current())` and `index on (random())` are the schema error `index expressions must be immutable`, and an aggregate such as `index on (count(.email))` is a schema error because it reads more than the object’s own row.

### Named Indexes

Indexes can be given explicit names:

```sdl
module default {
  type Product {
    required category: str;
    required name: str;
    required price: decimal;

    index product_category on (.category);
    index product_price on (.price);
  };
};
```

### Annotated Indexes

Indexes support annotations for documentation:

```sdl
module default {
  type User {
    required email: str;

    index on (.email) {
      annotation description := "Speeds up user lookups by email address";
      annotation title := "Email lookup index";
    };
  };
};
```

---

## Annotations

Annotations attach metadata to schema elements. They do not affect runtime behavior.

### Built-in Annotations

Disc supports three built-in annotations:

```sdl
module default {
  type User {
    annotation deprecated := "Use Account type instead";
    annotation description := "Represents a registered user in the system";
    annotation title := "Application User";

    required name: str {
      annotation description := "The user-visible display name";
      annotation title := "Display Name";
    };
  };
};
```

| Annotation    | Purpose                                       |
| :------------ | :-------------------------------------------- |
| `deprecated`  | Marks the element as deprecated with a reason |
| `description` | Detailed description of the element           |
| `title`       | Short human-readable title                    |

### Abstract Annotation Declarations

You can define custom annotations for domain-specific metadata:

```sdl
module default {
  abstract annotation admin_note;
  abstract annotation pii;

  type User {
    annotation admin_note := "Synced from external IdP nightly";

    required email: str {
      annotation pii := "true";
    };
    required name: str {
      annotation pii := "true";
    };
  };
};
```

Abstract annotations are declared at the module level and can then be used on any type, property, link, index, or constraint.

### Annotations on Properties, Links, and Constraints

```sdl
module default {
  type Order {
    required customer: User {
      annotation description := "The customer who placed this order";
    };

    required total: decimal {
      annotation description := "Order total in the base currency";
    };

    constraint expression on (.total >= 0) {
      annotation title := "Non-negative total";
    };
  };
};
```

---

## Inheritance

Disc supports type inheritance, allowing you to share structure across types.

### Abstract Types

Abstract types cannot be instantiated directly. They serve as templates:

```sdl
module default {
  abstract type Timestamped {
    created_at: datetime {
      default := datetime_current();
      readonly := true;
    };
    updated_at: datetime {
      default := datetime_current();
    };
  };

  type User extending Timestamped {
    required email: str;
    required name: str;
  };

  type Post extending Timestamped {
    required body: str;
    required title: str;
  };
};
```

Both `User` and `Post` inherit `created_at` and `updated_at` from `Timestamped`.

> **Production semantics — per-subtype tables.** Disc’s migration engine emits one PG table per concrete subtype, which holds its objects. An abstract type’s own table only keeps trigger-maintained copies of its subtypes’ rows, so links to the abstract type have valid foreign keys. `insert` on an abstract type is an error; `update` and `delete` on one run per concrete subtype. `SELECT <Abstract>` lowers to `UNION ALL` across the subtype tables (each branch projects the abstract’s columns), and `IS Type` filters reduce to `__type__ = '<Type>'` over the union. The `__type__` discriminator column is added automatically to every type that participates in a hierarchy. See [EdgeQL → Polymorphic Queries](edgeql.md#:~:text=count(.posts)\)%2C%0A%20%20name%0A%7D%3B-,Polymorphic%20Queries,-Polymorphic%20queries%20let) for how this affects compiled SQL and what polymorphic shape fields look like at runtime.

### Concrete Inheritance

Non-abstract types can also be extended:

```sdl
module default {
  type User {
    required email: str;
    required name: str;
  };

  type AdminUser extending User {
    required department: str;
    required permissions: json;
  };
};
```

`AdminUser` has all of `User`’s properties plus its own.

### Multiple Inheritance

A type can extend multiple parent types:

```sdl
module default {
  abstract type Timestamped {
    created_at: datetime {
      default := datetime_current();
    };
  };

  abstract type Authored {
    required author_name: str;
  };

  abstract type Slugged {
    required slug: str {
      constraint exclusive;
    };
  };

  type BlogPost extending Timestamped, Authored, Slugged {
    required body: str;
    required title: str;
  };
};
```

When a type extends multiple parents, it inherits properties and links from all of them. If two parents define a property with the same name, the child’s own definition takes precedence.

### Polymorphic Types and Discrimination

When a parent type has subtypes, Disc adds a `__type__` discriminator column to distinguish instances:

```sdl
module default {
  abstract type Shape {
    required color: str;
  };

  type Circle extending Shape {
    required radius: float64;
  };

  type Rectangle extending Shape {
    required height: float64;
    required width: float64;
  };
};
```

You can query polymorphically:

```edgeql
# Get all shapes
select Shape { color };

# Filter to specific subtypes
select Shape {
  color,
  [is Circle].radius,
  [is Rectangle].width,
  [is Rectangle].height
};
```

### Overloaded Properties

Use `overloaded` when redefining an inherited property to add constraints or change the default:

```sdl
module default {
  abstract type Named {
    required name: str;
  };

  type User extending Named {
    overloaded required name: str {
      constraint max_len_value(100);
    };
  };
};
```

---

## Access Policies

Access policies control which operations are allowed on objects based on runtime conditions. They provide row-level security.

### Basic Allow/Deny

```sdl
module default {
  type User {
    required email: str;
    required is_admin: bool {
      default := false;
    };
    required name: str;

    access policy admin_only {
      allow select, insert, update, delete;
      using (global current_user_is_admin);
    };
  };
};
```

### Policy Structure

An access policy has:

- A **name** for identification
- One or more **actions** (`allow` or `deny`) specifying which operations are affected
- A `using` **condition** expression evaluated at query time

The `using` and `when` conditions are parsed with the EdgeQL expression grammar and kept as written: `using (.tier in {'bronze'})`.

### Supported Operations

| Operation | Description                       |
| :-------- | :-------------------------------- |
| `select`  | Reading objects                   |
| `insert`  | Creating new objects              |
| `update`  | Modifying existing objects        |
| `delete`  | Removing objects                  |
| `all`     | Shorthand for all four operations |

### Allow and Deny

```sdl
module default {
  type Document {
    required is_public: bool;
    required owner_id: uuid;
    required title: str;

    # Allow everyone to read public documents
    access policy public_read {
      allow select;
      using (.is_public = true);
    };

    # Allow owners full access to their documents
    access policy owner_access {
      allow all;
      using (.owner_id = global current_user_id);
    };

    # Deny delete for non-admins
    access policy no_delete {
      deny delete;
      using (not global current_user_is_admin);
    };
  };
};
```

### Using Globals in Policies

Access policies commonly reference global variables to check the identity of the current user:

```sdl
module default {
  global current_user_id: uuid;

  type User {
    required email: str;
    required name: str;

    access policy self_only {
      allow select, update;
      using (.id = global current_user_id);
    };
  };
};
```

Set the global at the session level before issuing queries:

```edgeql
set global current_user_id := <uuid>"a1b2c3d4-...";
```

### Multiple Policies

When multiple policies exist on a type, they interact as follows:

- If any `deny` policy matches, the operation is denied regardless of `allow` policies
- If no `deny` policy matches and at least one `allow` policy matches, the operation is allowed
- If no policies match at all, behavior depends on the system default

### Annotated Policies

```sdl
module default {
  type Secret {
    required value: str;

    access policy classified {
      annotation description := "Only admins can access secrets";
      allow all;
      using (global current_user_is_admin);
    };
  };
};
```

---

## Triggers

Triggers execute logic automatically in response to data changes.

### Trigger Syntax

```
trigger <name> after <events> for each do (<expression>);
```

### After Insert

```sdl
module default {
  type User {
    required email: str;
    required name: str;

    trigger log_creation after insert for each do (
      insert AuditLog {
        action := "user_created",
        entity_id := __new__.id
      }
    );
  };
};
```

### After Update

```sdl
module default {
  type User {
    required email: str;
    required name: str;

    trigger log_update after update for each do (
      insert AuditLog {
        action := "user_updated",
        entity_id := __new__.id
      }
    );
  };
};
```

### After Delete

```sdl
module default {
  type User {
    required name: str;

    trigger cleanup_sessions after delete for each do (
      delete Session filter .user_id = __old__.id
    );
  };
};
```

### Multiple Events

A single trigger can respond to multiple events:

```sdl
module default {
  type Document {
    required content: str;
    required title: str;

    trigger audit_changes after insert, update, delete for each do (
      insert AuditLog {
        action := "document_changed",
        timestamp := datetime_current()
      }
    );
  };
};
```

### Trigger Scope

| Scope      | Description                                       |
| :--------- | :------------------------------------------------ |
| `for each` | Fires once per affected row                       |
| `for all`  | Fires once per statement, regardless of row count |

```sdl
module default {
  type Order {
    required total: decimal;

    trigger notify_batch after insert for all do (
      select send_notification("new_orders_batch")
    );
  };
};
```

### Trigger Timing

| Timing   | Description                         |
| :------- | :---------------------------------- |
| `after`  | Fires after the operation completes |
| `before` | Fires before the operation executes |

---

## Rewrite Rules

Rewrite rules automatically transform property values during insert or update operations.

### Insert Rewrite

```sdl
module default {
  type User {
    created_at: datetime {
      rewrite insert using (datetime_current());
    };
    required name: str;
    slug: str {
      rewrite insert using (str_lower(.name));
    };
  };
};
```

### Update Rewrite

```sdl
module default {
  type User {
    required name: str;
    updated_at: datetime {
      rewrite update using (datetime_current());
    };
  };
};
```

### Combined Insert and Update

A single rewrite can apply to both operations:

```sdl
module default {
  type Post {
    required body: str;
    required title: str;
    modified_at: datetime {
      rewrite insert, update using (datetime_current());
    };
  };
};
```

Rewrite rules differ from default values in that they always apply, even if the user explicitly provides a value. They enforce invariants like "`updated_at` is always the current time on any modification."

---

## Globals

Globals are session-scoped variables available to all queries within a session. They are commonly used with access policies.

### Declaring Globals

```sdl
module default {
  global current_user_id: uuid;
  required global current_tenant_id: uuid;
  global debug_mode: bool;
};
```

### Globals with Defaults

```sdl
module default {
  global current_user_id: uuid;
  global page_size: int64 {
    default := 25;
  };
};
```

A global’s default is parsed with the EdgeQL expression grammar and kept as written: `global tiers: array<str> { default := ['gold', 'silver']; };`.

### Required Globals

A required global must be set before queries that reference it will succeed:

```sdl
module default {
  required global current_user_id: uuid;
};
```

### Readonly Globals

```sdl
module default {
  global server_start_time: datetime {
    default := datetime_current();
    readonly := true;
  };
};
```

### Setting Globals

Globals are set per-session using EdgeQL:

```edgeql
set global current_user_id := <uuid>"550e8400-e29b-41d4-a716-446655440000";
set global page_size := 50;
```

### Using Globals in Queries

```edgeql
select User filter .id = global current_user_id;
```

### Globals in Access Policies

```sdl
module default {
  global current_user_id: uuid;

  type UserProfile {
    required display_name: str;
    required user_id: uuid;

    access policy owner_only {
      allow all;
      using (.user_id = global current_user_id);
    };
  };
};
```

Disc stores each global as a PostgreSQL session setting using the naming convention `disc.global_<module>__<name>` (e.g., `disc.global_default__current_user_id`).

---

## Aliases

Aliases define named computed expressions that can be reused across queries. They act as virtual types or views.

### Basic Aliases

```sdl
module default {
  type User {
    required active: bool;
    required name: str;
  };

  alias ActiveUsers := User;
};
```

### Aliases with Expressions

```sdl
module default {
  type User {
    required active: bool;
    required email: str;
    required name: str;
    required role: str;
  };

  alias Admins := (select User filter .role = "admin");
  alias ActiveAdmins := (select User filter .role = "admin" and .active = true);
};
```

Aliases are resolved at query time. They do not create tables or store data.

An alias’s expression is parsed with the EdgeQL expression grammar and kept as written. An alias of a type’s objects, shaped or not, with no `filter`, `order by`, `offset` or `limit` (`alias People := User`, `alias Named := User { name, loud := str_upper(.name) }`), is a view type: its type’s objects, with each computed of the shape a property, so `select Named { name } filter .loud = 'A'` reads as on a type declaring `loud`. Any other alias (`alias Roles := User.role union 'none'`, `alias Admins := (select User filter .role = "admin")`) is compiled as a hidden `with` binding of its expression ahead of the query naming it, and returns its values or objects: `select Roles`, `select count(Roles)`. An alias may name another. An alias named through `with module`, or inside a schema computed, is not bound yet.

---

## Collection Types

### Arrays

Arrays hold ordered sequences of values of a single type:

```sdl
module default {
  type User {
    favorite_colors: array<str>;   # ordered array of strings
    required name: str;
    multi tags: str;               # set of strings (unordered)
  };

  type Matrix {
    required labels: array<str>;
    required values: array<float64>;
  };
};
```

Supported array element types and their PostgreSQL mappings:

| SDL Array Type               | PostgreSQL Type      |
| :--------------------------- | :------------------- |
| `array<bigint>`              | `numeric[]`          |
| `array<bool>`                | `boolean[]`          |
| `array<bytes>`               | `bytea[]`            |
| `array<cal::local_date>`     | `date[]`             |
| `array<cal::local_datetime>` | `timestamp[]`        |
| `array<cal::local_time>`     | `time[]`             |
| `array<datetime>`            | `timestamptz[]`      |
| `array<decimal>`             | `numeric[]`          |
| `array<float32>`             | `real[]`             |
| `array<float64>`             | `double precision[]` |
| `array<int16>`               | `smallint[]`         |
| `array<int32>`               | `integer[]`          |
| `array<int64>`               | `bigint[]`           |
| `array<json>`                | `jsonb[]`            |
| `array<str>`                 | `text[]`             |
| `array<uuid>`                | `uuid[]`             |

An array of arrays is a query value only, as in Gel: a property, tuple element or scalar type of `array<array<…>>` is the schema error `nested arrays are not supported`. An array of tuples of arrays (`array<tuple<array<int64>>>`) is allowed. See [EdgeQL → Arrays of Arrays](edgeql.md#:~:text=Arrays%20of%20Arrays).

### Tuples

Tuples hold fixed-size sequences of mixed types. They are stored as `jsonb` in PostgreSQL:

```sdl
module default {
  type GeoPoint {
    required coordinates: tuple<float64, float64>;
  };
};
```

An `array<tuple<…>>` property is stored as one `jsonb` array of tuples — the same form a literal, a parameter or an `array_agg` of tuples has — so indexing, slicing, `len`, `++`, comparisons, `order by`, `distinct` and `group` work on it (see [EdgeQL → Arrays of Tuples](edgeql.md#:~:text=Arrays%20of%20Tuples)). A tuple or array-of-tuples parameter is stored with each element cast to its declared type, so it compares equal to a literal of the same value.

### Named Tuples

Named tuples have labeled fields:

```sdl
module default {
  type User {
    address: tuple<street: str, city: str, zip: str>;
    required name: str;
  };
};
```

Named tuples are also stored as `jsonb` in PostgreSQL, preserving the field names as JSON keys. An element reads back with its declared type: `select User.address.city` returns the bare `str` values, one per user (see [EdgeQL → Named Tuple Field Access](edgeql.md#:~:text=Named%20Tuple%20Field%20Access)).

---

## Range Types

Range types represent a continuous span of values. They map directly to PostgreSQL range types.

### Supported Range Types

| SDL Range Type               | PostgreSQL Type |
| :--------------------------- | :-------------- |
| `range<cal::local_date>`     | `daterange`     |
| `range<cal::local_datetime>` | `tsrange`       |
| `range<datetime>`            | `tstzrange`     |
| `range<decimal>`             | `numrange`      |
| `range<float64>`             | `numrange`      |
| `range<int32>`               | `int4range`     |
| `range<int64>`               | `int8range`     |

### Using Ranges

```sdl
module default {
  type Event {
    required time_range: range<datetime>;
    required title: str;
  };

  type PriceRange {
    required effective_dates: range<cal::local_date>;
    required price_range: range<decimal>;
    required product_id: uuid;
  };
};
```

### Multirange Types

Multiranges hold multiple non-overlapping ranges:

| SDL Multirange Type               | PostgreSQL Type  |
| :-------------------------------- | :--------------- |
| `multirange<cal::local_date>`     | `datemultirange` |
| `multirange<cal::local_datetime>` | `tsmultirange`   |
| `multirange<datetime>`            | `tstzmultirange` |
| `multirange<decimal>`             | `nummultirange`  |
| `multirange<float64>`             | `nummultirange`  |
| `multirange<int32>`               | `int4multirange` |
| `multirange<int64>`               | `int8multirange` |

```sdl
module default {
  type Schedule {
    required available_times: multirange<datetime>;
    required name: str;
  };
};
```

---

## Complete Example

Here is a realistic schema for a project management application that demonstrates many features together:

```sdl
module default {
  # -- Globals --
  global current_user_id: uuid;

  # -- Custom annotations --
  abstract annotation audit_trail;

  # -- Custom scalar types --
  scalar type Priority extending enum<low, medium, high, critical>;

  scalar type EmailAddress extending str {
    constraint regexp("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$");
  };

  # -- Abstract types --
  abstract type Timestamped {
    created_at: datetime {
      default := datetime_current();
      readonly := true;
    };
    updated_at: datetime {
      rewrite insert, update using (datetime_current());
    };
  };

  abstract type Authored {
    required author: User;
  };

  # -- Core types --
  type User extending Timestamped {
    avatar_url: str;
    required email: EmailAddress {
      constraint exclusive;
    };
    is_admin: bool {
      default := false;
    };
    required name: str {
      constraint max_len_value(255);
    };

    # Reverse links (queried via .<author or .<assignee)
    multi assigned_tasks := .<assignee[is Task];
    multi projects := .<owner[is Project];

    # Indexes
    index on (.name);

    # Annotations
    annotation description := "A registered user who can own projects and be assigned tasks";
    annotation title := "Application User";

    # Access policies
    access policy self_read {
      allow select;
      using (.id = global current_user_id);
    };

    access policy admin_full {
      allow all;
      using (.is_admin = true);
    };
  };

  type Project extending Timestamped {
    archived: bool {
      default := false;
    };
    description: str;
    multi members: User {
      property joined_at: datetime {
        default := datetime_current();
      };
      property role: str {
        default := "member";
      };
    };
    required name: str {
      constraint max_len_value(100);
    };
    required owner: User;

    index on (.name);

    constraint exclusive on ((.owner, .name));

    trigger log_archive after update for each do (
      insert AuditEntry {
        action := "project_updated",
        entity_type := "Project"
      }
    );
  };

  type Task extending Timestamped, Authored {
    assignee: User;
    description: str;
    due_date: cal::local_date;
    estimated_hours: float64 {
      constraint min_value(0);
    };
    required priority: Priority;
    required project: Project;
    required status: str {
      default := "open";
      constraint one_of("open", "in_progress", "review", "done", "cancelled");
    };
    multi tags: str;
    required title: str {
      constraint max_len_value(500);
    };
    multi depends_on: Task;

    index on (.status);
    index on (.priority);
    index on (.due_date);

    annotation audit_trail := "full";
  };

  type Comment extending Timestamped, Authored {
    required body: str;
    required task: Task {
      on target delete cascade;
    };

    trigger notify_assignee after insert for each do (
      select send_notification(__new__.task)
    );
  };

  type AuditEntry {
    required action: str;
    actor_id: uuid;
    created_at: datetime {
      default := datetime_current();
      readonly := true;
    };
    required entity_type: str;
    entity_id: uuid;
    metadata: json;

    index on (.action);
    index on (.created_at);
  };

  # -- Aliases --
  alias OpenTasks := (
    select Task filter .status = "open"
  );

  alias HighPriorityTasks := (
    select Task filter .priority = Priority.high or .priority = Priority.critical
  );
};
```

This schema demonstrates:

- **Modules**: All types in the `default` module
- **Globals**: `current_user_id` for access policies
- **Custom scalar types**: `Priority` enum and `EmailAddress` with regex constraint
- **Abstract types**: `Timestamped` and `Authored` for shared structure
- **Multiple inheritance**: `Task` extends both `Timestamped` and `Authored`
- **Properties**: Required, optional, computed, readonly, with defaults and rewrites
- **Constraints**: `exclusive`, `max_len_value`, `min_value`, `one_of`, `regexp`, expression-on
- **Links**: Single (`author`), multi (`members` with link properties, `depends_on`), deletion policies
- **Indexes**: On individual properties and multiple properties
- **Annotations**: Built-in and custom abstract annotations
- **Access policies**: Global-based row-level security
- **Triggers**: After insert and after update
- **Rewrite rules**: Auto-updating `updated_at` on insert and update
- **Aliases**: Computed views for common queries

---

## See Also

- [EdgeQL Reference](edgeql.md) -- query language for reading and writing data
- [Functions Reference](functions.md) -- built-in functions available in expressions
- [Migrations](migrations.md) -- generating and applying schema changes
- [Codegen](codegen.md) -- generating TypeScript types from your schema
