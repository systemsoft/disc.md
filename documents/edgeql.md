# EdgeQL Reference

> Looking for a quick reference? See the [EdgeQL Cheat Sheet](edgeql-cheatsheet.md) for one-page copy-pasteable examples.

EdgeQL is the query language for Disc. It compiles to PostgreSQL SQL under the hood, but provides a cleaner syntax for expressing queries against your schema. EdgeQL is set-oriented: every expression produces a set of values, and operations compose naturally over sets.

---

## Table of Contents

- [`SELECT`](#:~:text=Functions-,SELECT,-The%20select%20statement)
- [`INSERT`](#:~:text=0%0A%20%20limit%2025%3B-,INSERT,-The%20insert%20statement)
- [`UPDATE`](#:~:text=is%20simply%20ignored.-,UPDATE,-The%20update%20statement)
- [`DELETE`](#:~:text=set%20%7B%0A%20%20active%20%3A%3D%20false%0A%7D%3B-,DELETE,-The%20delete%20statement)
- [Parameters](#:~:text=delete%20User%3B-,Parameters,-Parameters%20allow%20you)
- [Type Casts](#:~:text=timestamp%0A%3Cjson%3E%24data-,Type%20Casts,-Type%20casts%20convert)
- [Operators](#:~:text=str%3E%3Cjson%3E%22hello%22%3B-,Operators,-EdgeQL%20supports%20a)
- [`IF`/`ELSE` Expressions](#:~:text=precedence%20when%20needed.-,IF/ELSE%20Expressions,-EdgeQL%20uses%20a)
- [`FOR` Loops](#:~:text=price%2C%0A%20%20name%2C%0A%20%20price%0A%7D%3B-,FOR%20Loops,-The%20for%20statement)
- [`WITH` Blocks](#:~:text=are%20unioned%20together.-,WITH%20Blocks,-with%20blocks%20define)
- [`GROUP BY`](#:~:text=the%20compiled%20SQL.-,GROUP%20BY,-The%20group%20statement)
- [Window Functions](#:~:text=count(User)%20%3E%2010%3B-,Window%20Functions,-Window%20functions%20perform)
- [Set Operations](#:~:text=by%20.revenue%20desc\)%0A%7D%3B-,Set%20Operations,-EdgeQL%20supports%20standard)
- [Subqueries](#:~:text=filter%20.active%20%3D%20false%3B-,Subqueries,-Any%20query%20can)
- [`DETACHED`](#:~:text=filter%20.subscribed%20%3D%20true\)%0A%7D%3B-,DETACHED,-The%20detached%20keyword)
- [Arrays and Tuples](#:~:text=detached%20Post\)%2C%0A%20%20name%0A%7D%3B-,Arrays%20and%20Tuples,-Array%20Literals)
- [Polymorphic Queries](#:~:text=count(.posts)\)%2C%0A%20%20name%0A%7D%3B-,Polymorphic%20Queries,-Polymorphic%20queries%20let)
- [`DESCRIBE`](#:~:text=its%20own%20subtypes.-,DESCRIBE,-Introspect%20schema%20information)
- [`EXPLAIN`](#:~:text=other%20schema%20objects.-,EXPLAIN,-Analyze%20query%20execution)
- [`CONFIGURE`](#:~:text=User%20%7B%20email%2C%20name%20%7D%3B-,CONFIGURE,-Set%20configuration%20parameters)
- [`SET GLOBAL`](#:~:text=under%20the%20hood.-,SET%20GLOBAL,-Set%20global%20session)
- [Functions](#:~:text=__%3Cname%3E.-,Functions,-EdgeQL%20includes%20a)

---

## `SELECT`

The `select` statement retrieves data from the database. It is the most commonly used query type.

### Basic Select

Select all objects of a type:

```edgeql
select User;
```

This returns the set of all `User` objects. Without a shape, you get the default representation (typically just `id`).

### Select with Shape

Shapes specify which properties and links to include in the result:

```edgeql
select User {
  email,
  name
};
```

Each field in the shape corresponds to a property or link on the type.

### Nested Shapes

Shapes can be nested to traverse links:

```edgeql
select User {
  email,
  name,
  posts: {
    created_at,
    title
  }
};
```

This fetches each user along with their posts, including each post’s title and creation time. The result is a nested JSON structure.

### Deeply Nested Shapes

There is no limit to nesting depth:

```edgeql
select User {
  name,
  posts: {
    comments: {
      author: {
        name
      },
      body
    },
    title
  }
};
```

### Computed Fields

Shapes can include computed fields that do not exist as stored properties:

```edgeql
select User {
  email,
  name,
  name_upper := str_upper(.name),
  post_count := count(.posts)
};
```

Computed fields use the `:=` assignment syntax. The `.property` notation refers to the current object being selected.

### `FILTER`

Filter results based on a boolean expression:

```edgeql
select User {
  email,
  name
} filter .email = "ada@example.com";
```

Filter with multiple conditions:

```edgeql
select User {
  email,
  name
} filter .active = true and .age >= 18;
```

Filter with string matching:

```edgeql
select User {
  email,
  name
} filter .name like "A%";
```

Filter with link traversal:

```edgeql
select Post {
  body,
  title
} filter .author.name = "Ada";
```

### `ORDER BY`

Sort results:

```edgeql
select User {
  email,
  name
} order by .name;
```

Specify direction:

```edgeql
select User {
  created_at,
  name
} order by .created_at desc;
```

Multiple sort keys:

```edgeql
select User {
  email,
  name
} order by .last_name asc then .first_name asc;
```

Handle empty values:

```edgeql
select User {
  age,
  name
} order by .age asc empty last;
```

The `empty first` and `empty last` modifiers control where NULL/empty values sort.

### `LIMIT` and `OFFSET`

Paginate results:

```edgeql
select User {
  email,
  name
} order by .name
  limit 10;
```

Skip rows:

```edgeql
select User {
  email,
  name
} order by .name
  offset 20
  limit 10;
```

### `SELECT DISTINCT`

Remove duplicate values from the result set:

```edgeql
select distinct User.name;
```

### Combining Clauses

All clauses can be combined:

```edgeql
select User {
  email,
  name,
  post_count := count(.posts)
} filter .active = true
  order by .name asc
  offset 0
  limit 25;
```

---

## `INSERT`

The `insert` statement creates new objects.

### Basic Insert

```edgeql
insert User {
  email := "ada@example.com",
  name := "Ada"
};
```

The shape uses `:=` assignment for each property value.

### Insert with Links

```edgeql
insert Post {
  author := (select User filter .email = "ada@example.com"),
  body := "This is my first post.",
  title := "Hello World"
};
```

Link values are set using a subquery that resolves to the target object.

### Insert with Nested Insert

You can insert linked objects in the same statement:

```edgeql
insert User {
  email := "billie@example.com",
  name := "Billie",
  posts := (insert Post {
    body := "Content here.",
    title := "Billie’s First Post"
  })
};
```

### `UNLESS CONFLICT` (Upsert)

Handle conflicts on unique constraints:

```edgeql
insert User {
  email := "ada@example.com",
  name := "Ada"
} unless conflict on .email
  else (
    update User set {
      name := "Ada"
    }
  );
```

When a conflict on `.email` is detected, the `else` clause runs instead. This implements an upsert pattern: insert if the email does not exist, otherwise update the existing row.

> With access policies on, an upsert on a type whose update policy has a row predicate is a compile error — see [Access Policies](access-policies.md#:~:text=Upsert%20and%20row%2Dlevel).

### Composite and link conflict targets

The conflict target can be a single link, or a tuple of properties and single links. It must match a unique index the schema declares — a property-level `constraint exclusive`, or a type-level `constraint exclusive on ((.a, .b))` (see [Schema → Constraints](schema.md#:~:text=Type%2Dlevel%20exclusive)). A link resolves to its `<link>_id` column, in declaration order:

```edgeql
insert GitRef {
  program := <Program><uuid>$p,
  name := <str>$n,
  target := <str>$t
} unless conflict on ((.program, .name));
# ON CONFLICT (program_id, name) DO NOTHING
```

An unresolvable target (an unknown name, a multi link, a computed property, a multi-step path) is a compile error rather than a silently target-less `ON CONFLICT DO NOTHING`, which would swallow every unique violation on the table. A target that names no unique index compiles but fails in PostgreSQL at execution.

### Linking by id: `<Type><uuid>$p`

Where a single link value is expected, an object cast over a uuid stands for the object with that id, without a subquery:

```edgeql
insert GitRef { program := <Program><uuid>$p, name := <str>$n, target := <str>$t };
# equivalent to: program := (select Program filter .id = <uuid>$p)
```

The same form works in a mutation filter: `update GitRef filter .program = <Program><uuid>$p …` compiles to `program_id = $1`. A misspelled type in this form is a compile error. The cast is only the id, so a shape over it (`select (<Program><uuid>$p) { name }`) is rejected — write `select Program { name } filter .id = <uuid>$p`.

### `UNLESS CONFLICT` without `ELSE`

Silently skip the insert if a conflict occurs:

```edgeql
insert User {
  email := "ada@example.com",
  name := "Ada"
} unless conflict on .email;
```

Without an `else` clause, a conflicting insert is simply ignored.

---

## `UPDATE`

The `update` statement modifies existing objects.

### Basic Update

```edgeql
update User
filter .email = "ada@example.com"
set {
  name := "Ada Smith"
};
```

### Update Multiple Properties

```edgeql
update User
filter .id = <uuid>"550e8400-e29b-41d4-a716-446655440000"
set {
  active := false,
  bio := "New bio text",
  name := "Updated Name"
};
```

### Update with Computed Values

```edgeql
update User
filter .active = true
set {
  last_seen := datetime_current()
};
```

### Update Links

```edgeql
update Post
filter .title = "Hello World"
set {
  author := (select User filter .email = "billie@example.com")
};
```

### Filtering through a link

An `update` or `delete` filter can traverse a single link. `.link.id` compiles to the foreign-key column with no join; deeper paths become a correlated subselect, as in `select`:

```edgeql
update GitRef
filter .program.id = <uuid>$p and .name = <str>$n
set { target := <str>$new };
# UPDATE git_ref SET target = $3 WHERE program_id = $1 AND name = $2 RETURNING *
```

### Selecting over a mutation

A bare `update` answers with the first updated row or `{ "updated": n }`, and a bare `delete` with `{ "deleted": n }` (see [Server → `POST /query`](server.md#:~:text=Response%20shape%20by%20statement%20kind)). To see exactly which rows a mutation touched, wrap it in a `select` with a shape. The mutation runs as a data-modifying CTE and the shape is projected over its `RETURNING` rows:

```edgeql
select (
  update GitRef
  filter .program.id = <uuid>$p and .name = <str>$n and .target = <str>$old
  set { target := <str>$new }
) { id };
```

```sql
WITH m AS (
  UPDATE git_ref SET target = CAST($4 AS text)
  WHERE (("git_ref"."program_id" = CAST($1 AS uuid)) AND (git_ref.name = CAST($2 AS text)))
    AND (git_ref.target = CAST($3 AS text))
  RETURNING *
) SELECT jsonb_build_object('id', m_1.id) FROM m AS m_1
```

The result is always a row set: `[{ "id": "…" }]` when the row was updated, `[]` when `$old` was stale. That makes it the **compare-and-swap** idiom — under concurrency, exactly one of several callers with the same `$old` gets a non-empty result. The same works for `delete` and for `insert … unless conflict` (`[]` on conflict, `[{ "id" }]` on insert):

```edgeql
select (delete GitRef filter .program.id = <uuid>$p and .name = <str>$n and .target = <str>$old) { id };
select (insert GitRef { program := <Program><uuid>$p, name := <str>$n, target := <str>$t } unless conflict on ((.program, .name))) { id };
```

`with u := (update …) select u { id }` is the same statement spelled differently and compiles to identical SQL. With a shape, only the requested fields are projected (`content` and other large columns stay out of the response); without a shape, `select u` or `select (update …)` returns every column of the `RETURNING *` row, with column names. Access policies travel with the mutation inside the CTE. A mutation cannot yet nest inside another data-modifying `with` binding (PostgreSQL requires those at the top level).

### Update All Matching Objects

Without a filter, the update applies to all objects of the type:

```edgeql
update User
set {
  active := false
};
```

---

## `DELETE`

The `delete` statement removes objects.

### Basic Delete

```edgeql
delete User
filter .email = "ada@example.com";
```

### Delete with `ORDER BY` and `LIMIT`

Delete a limited number of objects:

```edgeql
delete User
filter .active = false
order by .created_at asc
limit 100;
```

This is useful for batch cleanup operations.

### Delete through a link

Like `update`, a `delete` filter can traverse a single link, and `select (delete …) { id }` returns the deleted rows (`[]` when nothing matched):

```edgeql
select (delete GitRef filter .program.id = <uuid>$p and .name = <str>$n) { id };
```

### Delete All

Delete all objects of a type (use with caution):

```edgeql
delete User;
```

---

## Parameters

Parameters allow you to pass values into queries at execution time, preventing SQL injection and enabling prepared statements.

### Typed Parameters

Parameters are prefixed with `$` and require a type annotation using angle brackets:

```edgeql
select User {
  email,
  name
} filter .email = <str>$email;
```

### Multiple Parameters

```edgeql
select User {
  email,
  name
} filter .name = <str>$name and .age >= <int64>$min_age;
```

### Parameters in `INSERT`

```edgeql
insert User {
  age := <int64>$age,
  email := <str>$email,
  name := <str>$name
};
```

### Parameters in `UPDATE`

```edgeql
update User
filter .id = <uuid>$user_id
set {
  name := <str>$new_name
};
```

### Binding

Variables are bound **by name**: the `variables` object may list them in any order. Every `$name` the query uses must be present and nothing else may be — a missing or unknown variable is a `400` `VALIDATION_ERROR` naming it, and nothing reaches the database. An explicit `null` counts as a value. A name used twice in the query gets one slot.

### Bytes on the wire

`bytes` is base64 (RFC 4648, standard alphabet, padded, no line breaks) in JSON — both in variables and in results, everywhere a `bytes` value appears: shapes, `{ * }`, nested links, `select (insert …) { … }`, bare insert/update results and unshaped selects. `array<bytes>` is a JSON array of such strings; `null` elements and `[]` are preserved.

```edgeql
insert GitObject { content := <bytes>$content, object_id := <str>$oid, … };
# variables: { "content": "H4sIAAAAAAAA…", "oid": "…" }

select GitObject { object_id, content } filter .object_id = <str>$oid;
# data: [{ "object_id": "…", "content": "H4sIAAAAAAAA…" }]
```

Inbound, a `<bytes>$p` variable must be a base64 string (ASCII whitespace is tolerated; the URL-safe alphabet is not), or a string starting with `\x` which passes through as PostgreSQL hex input (invalid hex is then a PostgreSQL error). Anything else — a number, an object such as `{"0": 31, …}`, a bare array — is a `400` naming the variable. `array<bytes>` takes an array of such strings. Bytes carried *inside* a `<json>` variable are not decoded: keep them as base64 text and decode in the query with `std::base64_decode(<str>item['content'])` (a `<bytes>` cast from json is a compile error pointing there). `std::base64_encode` emits the same unbroken base64.

The request body is capped at 4 MiB by default (`DISC_MAX_REQUEST_BODY_BYTES` / `disc.toml` `max_request_body_bytes`); base64 inflates by 4/3, so that is roughly 3 MiB of raw bytes per request. Responses have no cap. The TypeScript SDK encodes `Uint8Array` (and Node `Buffer`) variables automatically and revives `bytes` fields on the way back — see [Client SDK → Bytes](client-sdk.md#:~:text=Bytes).

### Supported Parameter Types

Any scalar type can be used as a parameter type:

```edgeql
# String parameter
<str>$name

# Integer parameters
<int16>$small_val
<int32>$int_val
<int64>$big_val

# Float parameters
<float32>$approx
<float64>$precise

# Other types
<bool>$flag
<uuid>$id
<datetime>$timestamp
<bytes>$blob
<json>$data
```

---

## Type Casts

Type casts convert values from one type to another. They use angle bracket syntax.

### Basic Casts

```edgeql
# String to integer
select <int64>"42";

# String to float
select <float64>"3.14";

# String to boolean
select <bool>"true";

# String to datetime
select <datetime>"2024-01-15T10:30:00Z";

# String to UUID
select <uuid>"550e8400-e29b-41d4-a716-446655440000";

# Integer to string
select <str>42;

# Integer to float
select <float64>42;
```

### Casts in Expressions

```edgeql
select User {
  name,
  age_text := <str>.age
} filter .id = <uuid>$user_id;
```

### Calendar Type Casts

```edgeql
select <cal::local_date>"2024-03-15";
select <cal::local_time>"14:30:00";
select <cal::local_datetime>"2024-03-15T14:30:00";
```

### Cast Precedence

A cast applies to the whole postfix expression after it — subscripts, function calls and paths — and stops at the first operator, as in Gel:

```edgeql
<str>item['k']          # <str>(item['k'])
<str>json_get(x, 'k')   # <str>(json_get(x, 'k'))
<str>.a.b               # <str>(.a.b)
<str>x ++ 'a'           # (<str>x) ++ 'a'
<int64><str>x           # casts chain right to left
```

So to subscript a *cast* value, parenthesize the cast: `(<json>$x)['a']`. (`<json>$x['a']` is a subscript on the uncast parameter.)

### Casting from JSON

A cast whose operand is JSON reads the value out of the JSON rather than re-parsing its text:

| Cast                | From JSON                                                                                                          |
| :------------------ | :----------------------------------------------------------------------------------------------------------------- |
| `<str>`             | The string without its JSON quotes (`#>> '{}'`).                                                                   |
| numeric, `<bool>`, `<uuid>`, `<datetime>`, enums | Read from that text, then cast. A JSON *string* `"12"` casts to `<int64>` (more lenient than Gel). |
| `<array<T>>`        | Element order is kept; `[]` is an empty array; a missing key or JSON `null` is NULL (so a `required` array property rejects the row). A non-array is a PostgreSQL error. |
| `<json>`            | Plain cast.                                                                                                        |
| `<bytes>`           | Compile error — JSON carries bytes as base64 text; use `std::base64_decode(<str>j['content'])`.                    |

A missing key or a JSON `null` yields NULL / the empty set for every cast. The compiler decides syntactically what counts as a JSON operand: a `<json>` cast; a subscript with a string-literal key (`x['k']`) or any subscript on one of these; a call to a function returning json (`json_get`, `to_json`, `json_array_unpack`, `json_object_unpack`); a `with` binding, set-literal `for` element or `for` variable over `json_array_unpack(…)` bound to one of these; and a one-step path to a stored `json` property. Anything else (`a ?? b`, `if … else`, a subquery, `.link.meta`, a tuple element) keeps the plain SQL cast — put an explicit `<json>` in front of it first.

### JSON Casts

```edgeql
select <json>{"key": "value"};
select <str><json>"hello";
```

---

## Operators

EdgeQL supports a comprehensive set of operators.

### Arithmetic Operators

| Operator | Description    | Example           |
| :------- | :------------- | :---------------- |
| `+`      | Addition       | `select 2 + 3;`   |
| `-`      | Subtraction    | `select 10 - 4;`  |
| `*`      | Multiplication | `select 3 * 7;`   |
| `/`      | Division       | `select 10 / 3;`  |
| `//`     | Floor division | `select 10 // 3;` |
| `%`      | Modulo         | `select 10 % 3;`  |
| `**`     | Exponentiation | `select 2 ** 10;` |

Unary minus:

```edgeql
select -42;
select -.price;
```

### Comparison Operators

| Operator | Description                         | Example               |
| :------- | :---------------------------------- | :-------------------- |
| `=`      | Equal                               | `.name = "Ada"`       |
| `!=`     | Not equal                           | `.status != "active"` |
| `<`      | Less than                           | `.age < 18`           |
| `>`      | Greater than                        | `.price > 100`        |
| `<=`     | Less than or equal                  | `.quantity <= 0`      |
| `>=`     | Greater than or equal               | `.age >= 21`          |
| `?=`     | Equal (treating empty as equal)     | `.value ?= {}`        |
| `?!=`    | Not equal (treating empty as equal) | `.value ?!= {}`       |

The `?=` and `?!=` operators handle empty sets gracefully. `a ?= b` returns `true` when both `a` and `b` are empty, while `a = b` returns an empty set.

### Logical Operators

| Operator | Description | Example                                  |
| :------- | :---------- | :--------------------------------------- |
| `and`    | Logical AND | `.active = true and .age >= 18`          |
| `or`     | Logical OR  | `.role = "admin" or .role = "moderator"` |
| `not`    | Logical NOT | `not .active`                            |

```edgeql
select User filter .active = true and (
  .role = "admin" or .role = "moderator"
);
```

### String Concatenation

The `++` operator concatenates strings:

```edgeql
select "Hello, " ++ "world!";
select User { full_name := .first_name ++ " " ++ .last_name };
```

### Membership Operators

| Operator | Description    | Example                                |
| :------- | :------------- | :------------------------------------- |
| `in`     | Set membership | `.status in {"active", "pending"}`     |
| `not in` | Not in set     | `.role not in {"banned", "suspended"}` |

```edgeql
select User filter .status in {"active", "pending"};
select User filter .email not in {"spam@example.com", "test@example.com"};
```

### Type Check Operators

| Operator | Description        | Example                |
| :------- | :----------------- | :--------------------- |
| `is`     | Type check         | `.author is AdminUser` |
| `is not` | Negated type check | `.shape is not Circle` |

```edgeql
select Shape filter Shape is Circle;
select Shape filter Shape is not Rectangle;
```

### Pattern Matching

| Operator | Description                    | Example               |
| :------- | :----------------------------- | :-------------------- |
| `like`   | Case-sensitive pattern match   | `.name like "A%"`     |
| `ilike`  | Case-insensitive pattern match | `.name ilike "%ada%"` |

Pattern wildcards:

- `%` matches any sequence of characters
- `_` matches any single character

```edgeql
select User filter .name like "A%";
select User filter .email ilike "%@example.com";
select User filter .name like "J_n";
```

### Regex Operators

| Operator | Description                        | Example              |
| :------- | :--------------------------------- | :------------------- |
| `~`      | Regex match (case-sensitive)       | `.email ~ "^[a-z]"`  |
| `!~`     | Regex not match (case-sensitive)   | `.name !~ "^test"`   |
| `~*`     | Regex match (case-insensitive)     | `.name ~* "ada"`     |
| `!~*`    | Regex not match (case-insensitive) | `.domain !~* "spam"` |

```edgeql
select User filter .email ~ "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$";
select User filter .name ~* "ada";
```

### Bitwise Operators

| Operator | Description         | Example            |
| :------- | :------------------ | :----------------- |
| `&`      | Bitwise AND         | `select 12 & 10;`  |
| `\|`     | Bitwise OR          | `select 12 \| 10;` |
| `^`      | Bitwise XOR         | `select 12 ^ 10;`  |
| `<<`     | Left shift          | `select 1 << 4;`   |
| `>>`     | Right shift         | `select 16 >> 2;`  |
| `~`      | Bitwise NOT (unary) | `select ~42;`      |

### Coalesce Operator

The `??` operator returns the first non-empty value:

```edgeql
select User {
  display_name := .nickname ?? .name ?? "Anonymous"
};
```

### Set Existence

| Operator   | Description              | Example                                     |
| :--------- | :----------------------- | :------------------------------------------ |
| `exists`   | True if set is non-empty | `exists (select User filter .admin = true)` |
| `distinct` | Remove duplicates        | `select distinct User.name`                 |

```edgeql
# Check if any admin users exist
select exists (select User filter .is_admin = true);

# Get distinct city names
select distinct User.city;
```

### Range Operators

| Operator | Description        |
| :------- | :----------------- |
| `@>`     | Range contains     |
| `<@`     | Range contained by |
| `&&`     | Range overlaps     |
| `-\|-`   | Range adjacent     |

```edgeql
select Event filter .time_range @> <datetime>"2024-06-15T12:00:00Z";
```

### Operator Precedence (highest to lowest)

1. Unary: `+`, `-`, `not`, `exists`, `distinct`, `~`
2. Exponentiation: `**`
3. Multiplicative: `*`, `/`, `//`, `%`
4. Additive: `+`, `-`, `++`
5. Comparison: `=`, `!=`, `<`, `>`, `<=`, `>=`, `?=`, `?!=`
6. Membership: `in`, `not in`, `is`, `is not`, `like`, `ilike`
7. Regex: `~`, `!~`, `~*`, `!~*`
8. Logical AND: `and`
9. Logical OR: `or`
10. Coalesce: `??`

Use parentheses to override precedence when needed.

---

## `IF`/`ELSE` Expressions

EdgeQL uses a ternary-style if/else expression. The syntax places the "then" value first:

```
<value_if_true> if <condition> else <value_if_false>
```

### Basic Usage

```edgeql
select User {
  label := "Adult" if .age >= 18 else "Minor",
  name
};
```

### In Filter Expressions

```edgeql
select User {
  name,
  status_label := "Active" if .active else "Inactive"
};
```

### Nested `IF`/`ELSE`

```edgeql
select User {
  name,
  tier := "gold" if .points >= 1000
    else "silver" if .points >= 500
    else "bronze" if .points >= 100
    else "basic"
};
```

### In Computed Values

```edgeql
select Product {
  discount_price := .price * 0.8 if .on_sale else .price,
  name,
  price
};
```

---

## `FOR` Loops

The `for` statement iterates over a set and produces a result for each element.

### Basic `FOR` Loop

```edgeql
for name in {"Ada", "Billie", "Cher"}
union (
  insert User {
    email := str_lower(name) ++ "@example.com",
    name := name
  }
);
```

### Batch Insert

```edgeql
for item in {
  ("Widget A", 9.99),
  ("Widget B", 19.99),
  ("Widget C", 29.99)
}
union (
  insert Product {
    price := <decimal>item.1,
    name := item.0
  }
);
```

### Bulk insert from JSON

To insert many rows in one request, send them as a single `<json>` variable and iterate it. When the body is one `insert`, the whole loop compiles to **one** `INSERT … SELECT … FROM jsonb_array_elements($1)` statement — 500 rows is one round trip and one statement, and it is all-or-nothing (a constraint violation in any row inserts none):

```edgeql
with rows := <json>$rows
for item in json_array_unpack(rows)
union (
  insert GitObject {
    program := <Program><uuid>$p,
    object_id := <str>item['object_id'],
    object_type := <str>item['object_type'],
    size := <int64>item['size'],
    content := std::base64_decode(<str>item['content'])
  } unless conflict on ((.program, .object_id))
);
```

```sql
INSERT INTO git_object (program_id, object_id, object_type, size, content)
SELECT CAST($2 AS uuid), (for_iter.val -> 'object_id') #>> '{}', (for_iter.val -> 'object_type') #>> '{}',
       CAST((for_iter.val -> 'size') #>> '{}' AS bigint), std_base64_decode((for_iter.val -> 'content') #>> '{}')
FROM JSONB_ARRAY_ELEMENTS(CAST($1 AS jsonb)) AS for_iter(val)
ON CONFLICT (program_id, object_id) DO NOTHING RETURNING id
```

- **Response:** `[{ "id": "…" }, …]` — one entry per row actually inserted, never the inserted properties. With `unless conflict on (…)`, rows that already existed are absent, so re-running the same request is a no-op that answers `[]` and raises nothing.
- **Iterators:** `json_array_unpack(…)`, `array_unpack(<array<T>>$xs)`, `range_unpack(…)` (integer ranges), or a subquery. The body is one `insert` (no multi-link assignment) or a `select`. `update`/`delete` bodies are not supported — use one statement with `filter .id in array_unpack(<array<uuid>>$ids)` instead.
- **JSON casts:** `<str>item['k']` gives the string without quotes; `<array<str>>item['parents']` keeps order and round-trips `[]`; bytes go in as base64 text and are decoded with `std::base64_decode(<str>…)` (see [Casting from JSON](#:~:text=Casting%20from%20JSON)).
- **`with` bindings** are visible in the body, including an object selected once: `with prog := (select Program filter .id = <uuid>$p) for … union (insert GitObject { program := prog, … })`.
- **Size:** the request body is capped at 4 MiB by default (about 3 MiB of raw bytes as base64); raise `DISC_MAX_REQUEST_BODY_BYTES` or chunk.
- **Policies:** the insert policy applies to the body exactly as to a bare insert.

### `FOR` with Subquery

```edgeql
for user in (select User filter .active = true)
union (
  update user
  set {
    last_checked := datetime_current()
  }
);
```

The `for` variable (`user`) binds to each element of the iterator set. The body query is evaluated once per element, and the results are unioned together.

---

## `WITH` Blocks

`with` blocks define named subexpressions (Common Table Expressions) that can be referenced in the main query.

### Named Subqueries

```edgeql
with
  active_users := (select User filter .active = true)
select active_users {
  name,
  email
} order by .name;
```

### Multiple Bindings

```edgeql
with
  ada := (select User filter .name = "Ada"),
  ada_posts := (select Post filter .author = ada)
select ada_posts {
  title,
  created_at
};
```

### `WITH MODULE`

Set the default module for unqualified type names within the query:

```edgeql
with module payment
select Payment {
  amount,
  currency
};
```

This is equivalent to `select payment::Payment { ... }` but avoids repeating the module prefix.

### `WITH MODULE` and Bindings

```edgeql
with
  module payment,
  recent := (select Payment filter .created_at > <datetime>"2024-01-01T00:00:00Z")
select recent {
  amount,
  currency
};
```

### Using Bindings in the Body

A name bound in a `with` block can be used anywhere in the body. A scalar or parameter binding is inlined at each use; a set-valued binding (a subquery or a mutation) becomes a CTE, and in expression position — link assignment, `.link = name`, `.id` comparisons — its name stands for the bound objects’ ids:

```edgeql
with n := <str>$name
select GitRef { id } filter .name = n;

with prog := (select Program filter .id = <uuid>$p)
insert GitRef { program := prog, name := <str>$n, target := <str>$t };

with u := (update GitRef filter .name = <str>$n set { target := <str>$t })
select u { id, target };
```

A `with`-bound `select` is not filtered by the type’s select policy (see [Access Policies → Limitations](access-policies.md#:~:text=Limitations)).

### Recursive CTEs (`WITH RECURSIVE`)

For hierarchical or graph data, use recursive `WITH` bindings:

```edgeql
with
  recursive categories := (
    select Category filter .parent_id = <uuid>$root_id
    union
    select Category filter .parent_id in categories.id
  )
select categories {
  depth,
  name
};
```

The `recursive` modifier tells Disc to generate a `WITH RECURSIVE` CTE in the compiled SQL.

---

## `GROUP BY`

The `group` statement groups objects and computes aggregate values.

### Basic Grouping

```edgeql
group User
using status := .status
by status;
```

### Grouping with Aggregates

```edgeql
group User {
  status,
  user_count := count(User)
}
using status := .status
by status;
```

### Multiple Group Keys

```edgeql
group Order {
  status,
  year,
  total_revenue := sum(.amount),
  order_count := count(Order)
}
using
  status := .status,
  year := datetime_get(.created_at, "year")
by status, year;
```

### `HAVING` (Filter on Groups)

Filter groups after aggregation:

```edgeql
group User {
  city,
  user_count := count(User)
}
using city := .city
by city
filter count(User) > 10;
```

---

## Window Functions

Window functions perform calculations across a set of rows related to the current row, without collapsing them into groups.

### Basic Window Function

```edgeql
select User {
  email,
  name,
  row_num := row_number() over (order by .name)
};
```

### `PARTITION BY`

Partition the window into groups:

```edgeql
select User {
  department,
  dept_rank := rank() over (
    partition by .department
    order by .salary desc
  ),
  name
};
```

### Available Window Functions

| Function                      | Description                            |
| :---------------------------- | :------------------------------------- |
| `row_number()`                | Sequential row number within partition |
| `rank()`                      | Rank with gaps for ties                |
| `dense_rank()`                | Rank without gaps                      |
| `ntile(n)`                    | Distribute rows into `n` buckets       |
| `lag(expr, offset, default)`  | Value from a previous row              |
| `lead(expr, offset, default)` | Value from a following row             |
| `first_value(expr)`           | First value in the frame               |
| `last_value(expr)`            | Last value in the frame                |

Aggregate functions can also be used as window functions when combined with `over`:

| Function      | Description     |
| :------------ | :-------------- |
| `count(expr)` | Running count   |
| `sum(expr)`   | Running sum     |
| `avg(expr)`   | Running average |
| `min(expr)`   | Running minimum |
| `max(expr)`   | Running maximum |

### Frame Clauses

Control which rows are included in the window frame:

```edgeql
select Sale {
  date,
  amount,
  running_total := sum(.amount) over (
    order by .date
    rows between unbounded preceding and current row
  ),
  moving_avg := avg(.amount) over (
    order by .date
    rows between 6 preceding and current row
  )
};
```

#### Frame Modes

| Mode     | Description          |
| :------- | :------------------- |
| `rows`   | Physical row offsets |
| `range`  | Logical value ranges |
| `groups` | Peer group offsets   |

#### Frame Bounds

| Bound                 | Description                  |
| :-------------------- | :--------------------------- |
| `unbounded preceding` | Start of partition           |
| `N preceding`         | N rows/values before current |
| `current row`         | The current row              |
| `N following`         | N rows/values after current  |
| `unbounded following` | End of partition             |

#### `EXCLUDE` Clause

```edgeql
select Sale {
  amount,
  date,
  peers_sum := sum(.amount) over (
    order by .date
    rows between unbounded preceding and current row
    exclude current row
  )
};
```

| Exclude Option        | Description                                                     |
| :-------------------- | :-------------------------------------------------------------- |
| `exclude current row` | Exclude the current row                                         |
| `exclude group`       | Exclude the current row’s peer group                            |
| `exclude ties`        | Exclude peers of the current row but not the current row itself |
| `exclude no others`   | Default, exclude nothing                                        |

### Lag and Lead

Access values from neighboring rows:

```edgeql
select Sale {
  amount,
  change := .amount - lag(.amount, 1, 0) over (order by .date),
  date,
  next_amount := lead(.amount, 1) over (order by .date),
  prev_amount := lag(.amount, 1) over (order by .date)
};
```

### Practical Example

Running totals and moving averages:

```edgeql
select MonthlyRevenue {
  month,
  revenue,
  cumulative := sum(.revenue) over (
    order by .month
    rows between unbounded preceding and current row
  ),
  three_month_avg := avg(.revenue) over (
    order by .month
    rows between 2 preceding and current row
  ),
  rank := rank() over (order by .revenue desc)
};
```

---

## Set Operations

EdgeQL supports standard set operations that combine the results of multiple queries.

### `UNION`

Combine two sets:

```edgeql
select User filter .role = "admin"
union
select User filter .role = "moderator";
```

### `INTERSECT`

Return only elements present in both sets:

```edgeql
select User filter .active = true
intersect
select User filter .role = "admin";
```

### `EXCEPT`

Return elements in the first set that are not in the second:

```edgeql
select User filter .active = true
except
select User filter .role = "banned";
```

### Chaining Set Operations

```edgeql
select User filter .department = "Engineering"
union
select User filter .department = "Design"
except
select User filter .active = false;
```

---

## Subqueries

Any query can be used as an expression inside another query.

### Subquery in `FILTER`

```edgeql
select User {
  email,
  name
} filter .id in (
  select Post.author.id filter .created_at > <datetime>"2024-01-01T00:00:00Z"
);
```

### `EXISTS` with Subquery

```edgeql
select User {
  name
} filter exists (
  select Post filter .author = User and .published = true
);
```

### Scalar Subquery

A subquery that returns a single scalar value:

```edgeql
select User {
  name,
  post_count := count((select Post filter .author = User))
};
```

### Subquery in `INSERT`

```edgeql
insert Notification {
  message := "New post published",
  recipients := (select User filter .subscribed = true)
};
```

---

## `DETACHED`

The `detached` keyword removes an expression from the current scope, allowing you to reference a type independently of the query’s implicit scope.

### Basic Usage

```edgeql
select User {
  name,
  total_users := count(detached User)
};
```

Without `detached`, `count(User)` would be scoped to the current `User` being selected (always 1). With `detached`, it counts all users in the database.

### Self-Referencing Queries

```edgeql
select User {
  name,
  email,
  is_unique_name := not exists (
    select detached User
    filter .name = User.name and .id != User.id
  )
};
```

### Cross-Type Queries

```edgeql
select User {
  global_post_count := count(detached Post),
  name
};
```

---

## Arrays and Tuples

### Array Literals

```edgeql
select [1, 2, 3, 4, 5];
select ["red", "green", "blue"];
```

### Array Indexing

Access individual elements using zero-based indexing:

```edgeql
select [10, 20, 30, 40][0];    # Returns 10
select [10, 20, 30, 40][2];    # Returns 30
select [10, 20, 30, 40][-1];   # Returns 40 (last element)
```

### Array Slicing

Extract sub-arrays with `[start:end]` syntax:

```edgeql
select [10, 20, 30, 40, 50][1:3];   # Returns [20, 30]
select [10, 20, 30, 40, 50][:2];    # Returns [10, 20]
select [10, 20, 30, 40, 50][3:];    # Returns [40, 50]
```

### Array Functions

```edgeql
# Get array length
select len(<array<str>>["a", "b", "c"]);

# Aggregate into array
select array_agg(User.name order by User.name);

# Unpack array to set
select array_unpack([1, 2, 3]);

# Join array elements into string
select array_join(["hello", "world"], " ");

# Split string into array
select str_split("hello,world,foo", ",");
```

### Tuple Literals

```edgeql
select (1, "hello", true);
select (3.14, 42);
```

### Tuple Element Access

Access tuple elements by zero-based index:

```edgeql
select (10, "hello", true).0;    # Returns 10
select (10, "hello", true).1;    # Returns "hello"
select (10, "hello", true).2;    # Returns true
```

### Named Tuples

```edgeql
select (name := "Ada", age := 30, active := true);
```

### Named Tuple Field Access

Access fields by name:

```edgeql
select (name := "Ada", age := 30).name;   # Returns "Ada"
select (name := "Ada", age := 30).age;    # Returns 30
```

### Arrays and Tuples in Shapes

```edgeql
select User {
  info := (name := .name, email := .email, post_count := count(.posts)),
  name
};
```

---

## Polymorphic Queries

Polymorphic queries let you work with type hierarchies and select properties specific to subtypes.

### Type Filtering with `[is Type]`

```edgeql
select Shape {
  color,
  [is Circle].radius,
  [is Rectangle].width,
  [is Rectangle].height
};
```

This selects all `Shape` objects. For objects that are `Circle`, the `radius` field is populated. For `Rectangle` objects, `width` and `height` are populated. For other shapes, those fields are empty.

### Filtering by Type

```edgeql
# Select only circles
select Shape[is Circle] {
  color,
  radius
};

# Select only rectangles
select Shape[is Rectangle] {
  color,
  height,
  width
};
```

### Type Checking with `IS`

```edgeql
select Shape {
  color,
  shape_type := "circle" if Shape is Circle
    else "rectangle" if Shape is Rectangle
    else "unknown"
};
```

### `IS NOT`

```edgeql
select Shape filter Shape is not Circle;
```

### How polymorphic `SELECT` compiles

Disc’s migration engine creates one PG table per concrete subtype — there’s no physical table for the abstract parent. `SELECT <Abstract>` lowers to a `UNION ALL` across the subtype tables; each branch projects the abstract type’s properties (`id`, plus shared columns like `color`) so the outer SELECT can reference the abstract’s alias as if it were a regular table.

When the SELECT shape uses `[is Subtype].property` to access a subtype-specific column, each UNION branch projects either the actual column (when its subtype owns it) or `NULL::<pg-type> AS <colName>` (when it doesn’t), so PG’s UNION column-resolution unifies. The outer compiler emits `CASE WHEN __type__ = '<Subtype>' THEN <alias>.<col> ELSE NULL END` to gate the value on the actual row type.

```sql
-- Compiled shape of `select Shape { color, [is Circle].radius }`:
SELECT
  jsonb_build_object(
    'color', shape_1.color,
    'radius', CASE WHEN shape_1.__type__ = 'Circle' THEN shape_1.radius ELSE NULL END
  )
FROM (
  SELECT id, __type__, color, radius FROM circles
  UNION ALL
  SELECT id, __type__, color, NULL::double precision AS radius FROM rectangles
) AS shape_1;
```

The `__type__` column is emitted automatically on every type that participates in a hierarchy (DDL detail in `migration/ddl.ts:398-412`), defaulting to the type’s own name. The `IS Type` filter (`filter .id IS Circle` or `Shape[IS Circle]`) reduces to `__type__ = '<Type>'` over the same UNION, with `__type__ IN (...)` when the named type has its own subtypes.

---

## `DESCRIBE`

Introspect schema information at query time.

### `DESCRIBE TYPE`

Get information about a specific type:

```edgeql
describe type User;
```

Returns a JSON representation of the type’s properties, links, constraints, indexes, and other metadata.

### `DESCRIBE SCHEMA`

Get information about the entire schema:

```edgeql
describe schema;
```

Returns a JSON representation of all types, functions, globals, and other schema objects.

---

## `EXPLAIN`

Analyze query execution plans.

### Basic `EXPLAIN`

```edgeql
explain select User { email, name } filter .active = true;
```

Returns the PostgreSQL query execution plan for the compiled SQL.

### `EXPLAIN ANALYZE`

Execute the query and include actual timing information:

```edgeql
explain analyze select User { email, name } filter .active = true;
```

### `EXPLAIN` Options

```edgeql
# Include buffer usage information
explain (analyze, buffers) select User { email, name };

# Output as JSON
explain (format json) select User { email, name };

# Available formats: TEXT, JSON, YAML, XML
explain (format yaml) select User { email, name };
```

---

## `CONFIGURE`

Set configuration parameters at various scopes.

### Session Configuration

Settings that apply to the current connection:

```edgeql
configure session set query_execution_timeout := "30s";
```

### Database Configuration

Settings that apply to the entire database:

```edgeql
configure database set work_mem := "256MB";
```

### System/Instance Configuration

Settings that apply to the entire Disc instance:

```edgeql
configure system set max_connections := 200;
configure instance set shared_buffers := "1GB";
```

### Reset Configuration

Reset a setting to its default value:

```edgeql
configure session reset query_execution_timeout;
```

### Available Configuration Keys

| Key                                   | Description                           |
| :------------------------------------ | :------------------------------------ |
| `effective_cache_size`                | Planner’s estimate of available cache |
| `idle_in_transaction_session_timeout` | Timeout for idle transactions         |
| `listen_addresses`                    | Network interfaces to listen on       |
| `lock_timeout`                        | Maximum wait time for locks           |
| `maintenance_work_mem`                | Memory for maintenance operations     |
| `max_connections`                     | Maximum concurrent connections        |
| `query_execution_timeout`             | Maximum query execution time          |
| `shared_buffers`                      | Shared memory for caching             |
| `work_mem`                            | Memory for sort and hash operations   |

These map to PostgreSQL GUC parameters under the hood.

---

## `SET GLOBAL`

Set global session variables. These are used by access policies and can be referenced in queries.

### Setting a Global

```edgeql
set global current_user_id := <uuid>"550e8400-e29b-41d4-a716-446655440000";
```

### Setting Globals in Different Modules

```edgeql
set global default::current_user_id := <uuid>"550e8400-e29b-41d4-a716-446655440000";
set global auth::session_token := "abc123";
```

### Using Globals in Queries

```edgeql
select User filter .id = global current_user_id;
```

Globals are stored as PostgreSQL session settings using the naming convention `disc.global_<module>__<name>`.

---

## Functions

EdgeQL includes a standard library of built-in functions. This section provides a brief overview. See the [Functions Reference](functions.md) for complete documentation.

A call to a function the compiler does not know is a compile error naming it (`Unknown function 'enc::base64_decode'. It is not a built-in function, and the schema does not declare it …`). Known functions are the built-ins (with or without `std::`), `function` declarations in your SDL (`f` or `default::f`; `mod::f` for other modules), and extension and custom functions. PostgreSQL-native names are **not** passed through: `lower()`, `coalesce()` and `now()` are rejected — write `str_lower()`, `??` and `datetime_current()`.

### Aggregate Functions

```edgeql
select count(User);
select sum(Order.amount);
select avg(User.age);
select min(Product.price);
select max(Product.price);
select array_agg(User.name);
select stddev(Measurement.value);
```

### String Functions

```edgeql
select len("hello");                       # 5
select str_lower("HELLO");                 # "hello"
select str_upper("hello");                 # "HELLO"
select str_trim("  hello  ");              # "hello"
select str_replace("hello world", "world", "disc"); # "hello disc"
select str_split("a,b,c", ",");            # ["a", "b", "c"]
select str_starts_with("hello", "hel");    # true
select str_ends_with("hello", "llo");      # true
select contains("hello world", "world");   # true
select find("hello world", "world");       # 6
select str_pad_start("42", 5, "0");        # "00042"
select str_pad_end("hi", 5, "!");          # "hi!!!"
select str_repeat("ha", 3);                # "hahaha"
select str_title("hello world");           # "Hello World"
```

### Math Functions

```edgeql
select math_abs(-42);          # 42
select math_ceil(3.2);         # 4
select math_floor(3.8);        # 3
select round(3.5);             # 4
select math_sqrt(16);          # 4
select math_pow(2, 10);        # 1024
select math_log(10, 100);      # 2
select math_ln(2.718281828);   # ~1
select math_pi();              # 3.14159...
```

### Datetime Functions

```edgeql
select datetime_current();
select datetime_of_statement();
select datetime_of_transaction();
select datetime_get(<datetime>"2024-06-15T10:30:00Z", "hour"); # 10
select datetime_truncate(<datetime>"2024-06-15T10:30:45Z", "hour");
```

### Type Conversion Functions

```edgeql
select to_str(42);
select to_int64("42");
select to_float64("3.14");
select to_bool("true");
select to_uuid("550e8400-e29b-41d4-a716-446655440000");
select to_datetime("2024-01-15T00:00:00Z");
select to_json('{"key": "value"}');
```

### JSON Functions

```edgeql
select json_typeof(<json>"42");          # "number"
select json_get(<json>'{"a":1}', "a");   # 1
select json_array_unpack(<json>"[1,2,3]");
```

### Regex Functions

```edgeql
select re_test("^[a-z]+$", "hello");      # true
select re_match("[0-9]+", "abc123def");   # ["123"]
select re_replace("[0-9]+", "NUM", "abc123def"); # "abcNUMdef"
```

### Array Functions

```edgeql
select array_agg(User.name);
select array_unpack([1, 2, 3]);
select array_join(["a", "b", "c"], ",");   # "a,b,c"
select array_get([10, 20, 30], 1);         # 20
```

### Range Functions

```edgeql
select range(1, 10);
select range_get_lower(range(1, 10));            # 1
select range_get_upper(range(1, 10));            # 10
select range_is_empty(range(1, 1));              # true
select range_is_inclusive_lower(range(1, 10));   # true
select range_is_inclusive_upper(range(1, 10));   # false
select overlaps(range(1, 5), range(3, 8));       # true
```

### `UUID` Functions

```edgeql
select uuid_generate_v4();
```

### Assertion Functions

```edgeql
# Raises an error if the result is empty
select assert_exists(
  (select User filter .email = "ada@example.com")
);

# Raises an error if the result contains more than one element
select assert_single(
  (select User filter .email = "ada@example.com")
);
```

### Schema Introspection Functions

```edgeql
# List all types in the schema
select schema::types();

# Get info about a specific type
select schema::get_type("User");

# List all functions
select schema::functions();
```

For the complete function reference with all parameters and return types, see [Functions Reference](functions.md).

---

## Query Composition Examples

### Complex Select with Multiple Features

```edgeql
with
  active_users := (select User filter .active = true),
  recent_cutoff := <datetime>"2024-01-01T00:00:00Z"
select active_users {
  email,
  is_prolific := count(.posts) > 10,
  latest_post_date := max(.posts.created_at),
  name,
  recent_posts := (
    select .posts {
      comment_count := count(.comments),
      created_at,
      title
    }
    filter .created_at > recent_cutoff
    order by .created_at desc
    limit 5
  ),
  total_posts := count(.posts)
}
filter count(.posts) > 0
order by count(.posts) desc
limit 20;
```

### Upsert Pattern

```edgeql
with
  email := <str>$email,
  name := <str>$name
insert User {
  email := email,
  name := name
} unless conflict on .email
  else (
    update User set {
      last_login := datetime_current(),
      name := name
    }
  );
```

### Batch Operations with `FOR`

```edgeql
with
  user_data := <json>$users
for item in json_array_unpack(user_data)
union (
  insert User {
    email := <str>json_get(item, "email"),
    name := <str>json_get(item, "name")
  } unless conflict on .email
);
```

One request, one `INSERT … SELECT` statement, however many rows `$users` holds; the response lists the ids of the rows actually inserted. See [Bulk insert from JSON](#:~:text=Bulk%20insert%20from%20JSON).

### Recursive Category Tree

```edgeql
with
  recursive tree := (
    select Category filter .parent_id = <uuid>$root_id
    union
    select Category filter .parent_id in tree.id
  )
select tree {
  name,
  parent_id,
  depth
} order by .name;
```

### Analytics Query

```edgeql
with
  module default,
  start := <datetime>$start_date,
  end := <datetime>$end_date
group Order {
  avg_order := avg(.amount),
  month := datetime_truncate(.created_at, "month"),
  order_count := count(Order),
  top_product := (
    select .items.product.name
    order by .items.quantity desc
    limit 1
  ),
  total_revenue := sum(.amount)
}
using month := datetime_truncate(.created_at, "month")
by month
filter .created_at >= start and .created_at < end;
```

---

## See Also

- [Schema Reference](schema.md) -- defining your data model
- [Functions Reference](functions.md) -- complete function documentation
- [Migrations](migrations.md) -- schema change management
- [Client SDK](client-sdk.md) -- using EdgeQL from TypeScript
