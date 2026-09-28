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

This returns the set of all `User` objects. Without a shape, each object comes back as its `id` and stored properties (Gel returns only `id`).

A select of anything other than objects returns the values themselves, as in Gel: `select User.name` returns `["Ada", "Billie"]`, `select count(User)` returns `[2]`, `select (1, 'a')` returns `[[1, "a"]]`.

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

A multi link comes back as an array of rows. A single link selected with a sub-shape (`author: { name }`) also comes back as an array — one element, or `null` when an optional link is empty — so read `author[0].name`. Gel returns the object itself; the generated clients declare Disc’s shape (see [Codegen](codegen.md)).

A link selected without a sub-shape (`author`, `posts`) is its targets’ ids: a string for a single link (`null` when unset), an array for a multi link (`[]` when empty).

A sub-shape takes its own `filter`, `order by`, `offset` and `limit`, applied to the link’s objects — a stored link’s, a backlink’s, or a computed link’s result, as in Gel. Link properties (`@role`) can be selected, filtered and ordered on in such a sub-shape too:

```edgeql
select User {
  name,
  posts: { title } order by .created_at desc limit 5
};
```

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

A computed field of objects reads as a stored link does. A single one is `[{ … }]` with a sub-shape (`writer := .author { name }`), or `null` when empty, and its target’s id without one; a multi one is an array of objects with a sub-shape and of ids without. Whether it is single is inferred as in Gel: a path through single links, a `(select … limit 1)`, a select filtered on `.id` or on an `exclusive` property compared with one value, or an `assert_single(…)` is single. A schema computed declared `single` reads as single; `single` on one that may yield several is a schema error (see [Schema → Computed Properties](schema.md#:~:text=single%20narrows%20it)).

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

Comparing objects compares their identity, as in Gel: `filter .author = (select User filter .email = <str>$e)`, `.tags in (select Tag filter …)`, `?=`, and a `with` name bound to a select (`with u := (select User filter .email = <str>$e) select Post filter .author = u`) all compare ids; a multi link compares each target’s id. A `with` binding of several objects compares with each of them: `with us := (select User filter .active) select Post filter .author = us` keeps posts by any active user, and `!=`, `in`, `not in` read the same way. `?=` and `?!=` treat an empty binding as the empty set — `.author ?= us` keeps posts with no author, `.author ?!= us` those with one.

#### Filtering on multi paths

A comparison of a `multi` property, or of a path through a `multi` link (`.nicks = "a1"`, `.posts.title = "x"`), gives one boolean per element. As in Gel:

- A filter is true when **any** of its booleans is: `filter .nicks = "a1"` keeps users with some nick `"a1"`. `any(…)` and `all(…)` take any such set of booleans and give one (`false` and `true` for no element).
- `not` and `or` apply per element: `filter not (.nicks = "a1")` keeps users with some nick that is _not_ `"a1"` (a user with no nicks has no element to be true). For "no nick is `"a1"`", negate an `any()`: `filter not any(.nicks = "a1")`.
- Two comparisons of the same multi path joined by `and` are independent: `filter .nicks = "a1" and .nicks = "a2"` keeps users with a nick of each. This is the path scoping of Gel’s `future simple_scoping`; Gel 7’s default (legacy path factoring) binds both to the same element and matches nothing. Disc keeps simple scoping deliberately. To test one linked object against several conditions, filter a subquery: `filter exists (select .posts filter .title = "x" and .published = true)`.

The generated client’s [filter objects](filter-api.md#:~:text=Multi%20properties%20and%20multi%20links) compile every multi condition to `any(…)`, so they mean the same under either rule.

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

The `empty first` and `empty last` modifiers control where NULL/empty values sort. Without one, empty values sort first for `asc` and last for `desc`, as in Gel.

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

An `order by` on a `select distinct` orders the distinct elements, so it must refer to them: `select distinct User { name } order by .name`. A path from the type (`select distinct User.name order by User.name`) is not bound to them and is Gel’s error `possibly more than one element returned by an expression where only singletons are allowed`.

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

A single link holds one object, so, as in Gel, the value must be provably at most one: a select filtered on `.id` or on an `exclusive` property compared with one value, or one with `limit 1` (or an id cast, `<User><uuid>$id`). Any other select — `(select User filter .name = "Ada")`, or a `with` name bound to one — is a compile error (`possibly more than one element returned by an expression for a link 'author' declared as 'single'`). Wrap it in `assert_single(…)` to check at run time instead.

The same rule holds for a single property’s value, and for a path from a `with` binding, in an `insert` or an `update`: after `with n := (select Counter)`, `number := n.last` is a compile error (`possibly more than one element returned by an expression for a property 'number' declared as 'single'`). It compiles when the binding is provably at most one object — a select, `update` or `delete` filtered on `.id` or on an `exclusive` property compared with one value, or with `limit 1` — or when the value is one by construction: `assert_single(n.last)`, an aggregate such as `max(n.last)`. A binding of an `insert` is always one object, and so is one wrapped in `assert_single`: after `with n := assert_single((select Counter filter .name = "a"))`, `n.last` is one value, and the query fails at run time with `CardinalityViolationError` if the select finds more than one object.

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

> With access policies on, the `else` branch updates the conflicting object only when the caller may select and update it; otherwise the object is left as it is. Both branches are checked against the type’s write policies — see [Access Policies](access-policies.md#:~:text=Upsert%20and%20row%2Dlevel).

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
# like: program := (select Program filter .id = <uuid>$p), but a missing id raises (below)
```

The same form works in a mutation filter: `update GitRef filter .program = <Program><uuid>$p …`. A misspelled type in this form is a compile error. The cast is only the id, so a shape over it (`select (<Program><uuid>$p) { name }`) is rejected — write `select Program { name } filter .id = <uuid>$p`.

As in Gel, the cast checks that the object exists: an id no `Program` (or subtype) the query may read has — a missing id, or another type’s object’s — raises `CardinalityViolationError: 'default::Program' with id '…' does not exist` (SQLSTATE 21000), wherever the cast appears: a filter, a `select`, `count`, `in`, or a link value in an `insert` or `update` (which then writes nothing). A cast of the empty set is the empty set. To have a filter match nothing instead of failing when the id is missing, compare the link’s id: `filter .program.id = <uuid>$p`.

### `UNLESS CONFLICT` without `ELSE`

Silently skip the insert if a conflict occurs:

```edgeql
insert User {
  email := "ada@example.com",
  name := "Ada"
} unless conflict on .email;
```

Without an `else` clause, a conflicting insert is simply ignored, and the query returns `[]`. The same holds when an `else (update … filter …)` excludes the conflicting row: nothing is written and the result is `[]`, so an empty result means “skipped”.

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

A bare `insert`, `update` or `delete` answers with the set of objects it wrote, each as its whole stored row, and `[]` when it wrote none (see [Server → `POST /query`](server.md#:~:text=Response%20shape%20by%20statement%20kind)). To choose the fields — and keep large columns out of the response — wrap it in a `select` with a shape. The mutation runs as a data-modifying CTE and the shape is projected over its `RETURNING` rows:

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

A path from a `with`-bound insert reads the inserted row: `n.last`, `n.id`, `n.program.name`. The `with` can also sit inside the parentheses, so taking a number from a counter and inserting with it is one statement:

```edgeql
select (
  with n := (insert Numbering { program := <Program><uuid>$p, last := 1 }
             unless conflict on .program
             else (update Numbering set { last := .last + 1 }))
  insert Bug { program := <Program><uuid>$p, number := n.last, title := <str>$t }
) { number };
```

A shape applies to any parenthesized select, including one with its own `with`: `select (select User filter .email = <str>$e) { name }` and `select (with x := <str>$e select User filter .email = x) { name }` both mean `select User { name } filter .email = …`, and an outer shape replaces an inner one. A path from a `with`-bound select, update or delete used as a single value must be provably one (see [Insert with Links](#:~:text=A%20single%20link%20holds%20one%20object)).

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

### String and bytes literals

String literals read escapes as Gel does, in EdgeQL and SDL alike: `\\`, `\'`, `\"`, `\b`, `\f`, `\n`, `\r`, `\t`, `\xHH` (a non-null ASCII character, `\x01`–`\x7f`), `\uHHHH`, `\UHHHHHHHH`, and a backslash before a line break, which drops the break and the whitespace after it. Any other escape is a syntax error, and so are `\x00` and `\x80`–`\xff`:

```edgeql
select 'caf\u00e9';   # "café"
select 'a\qb';        # invalid string literal: invalid escape sequence '\q'
select '\x80';        # invalid string literal: invalid escape sequence '\x80' (only non-null ascii allowed)
```

Raw strings (`r'…'`) and dollar-quoted strings (`$$…$$`, or `$tag$…$tag$` with a tag that doesn’t start with a digit) read no escapes: `$$a\nb$$` is the four characters `a\nb`.

A bytes literal, `b'…'`, holds exact bytes: ASCII characters and the same escapes, except that `\xHH` is any byte and there is no `\u` or `\U`. A non-ASCII character in it is an error. `br'…'` (or `rb'…'`) reads no escapes. Like every `bytes` value it is base64 in JSON: `select b'\x00ab'` returns `["AGFi"]`.

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

A cast from a float to an integer type or `bigint` rounds half to even (`<int64>2.5` is `2`, `<int64>3.5` is `4`); a cast from a `decimal` rounds half away from zero (`<bigint>2.5n` is `3`) — both as in Gel.

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
| `<array<T>>`        | Element order is kept; `[]` is an empty array; a JSON `null` is NULL (so a `required` array property rejects the row). A non-array is a PostgreSQL error. |
| `<json>`            | Plain cast.                                                                                                        |
| `<bytes>`           | Compile error — JSON carries bytes as base64 text; use `std::base64_decode(<str>j['content'])`.                    |

A JSON `null` — a key present with a `null` value — yields the empty set for every cast. A missing key raises, as in Gel (`JSON index 'k' is out of bounds`, see [JSON indexing](#:~:text=A%20json%20value%20indexes)); `json_get(x, 'k')` reads a key that may be absent as the empty set. The compiler decides syntactically what counts as a JSON operand: a `<json>` cast; a subscript with a string-literal key (`x['k']`) or any subscript on one of these; a call to a function returning json (`json_get`, `to_json`, `json_array_unpack`, `json_object_unpack`); a `with` binding, set-literal `for` element or `for` variable over `json_array_unpack(…)` bound to one of these; and a one-step path to a stored `json` property. Anything else (`a ?? b`, `if … else`, a subquery, `.link.meta`, a tuple element) keeps the plain SQL cast — put an explicit `<json>` in front of it first.

### JSON Casts

`<json>` of objects is one JSON object per object, as in Gel: `select <json>User` gives each user’s `{ "id" }`, and `select <json>(select User { name })` each user’s shape.

A statement whose value is empty returns no row, as in Gel: `select <json>{}`, `select <str>{}`, an unset global, an `<optional str>$p` given `null`, and a `json_get` or `array_get` that finds nothing all return `[]`, not `[null]`. `??` gives an empty value a default: `select <str>{} ?? "x"` returns `["x"]`.

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
| `^`      | Power          | `select 2 ^ 10;`  |

`^` is Gel’s power operator. It binds tighter than unary minus and to the right — `-2 ^ 2` is `-4`, `2 ^ 3 ^ 2` is `512` — and its exponent may be negated (`2 ^ -1` is `0.5`). Integers and floats raise to a `float64` (`2 ^ 3` is `8.0`), a `decimal` or `bigint` to a `decimal`. Zero to a negative power (`0 ^ -1`) is `zero raised to a negative power is undefined`, and a negative number to a fractional one (`(-8) ^ 0.5`) is `a negative number raised to a non-integer power yields a complex result`.

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

As in Gel, `and`, `or`, `not` and `if … else` over an empty value (an optional property with none) are empty, not SQL’s `NULL OR TRUE`: `select User { b := .visits = 1 or .name = "ann" }` gives `b` no value for a user without `visits`, and `filter .visits = 1 or .name = "ann"` keeps no such user, since an empty filter condition keeps nothing. `?=`, `??` and `exists` give an empty operand a value: `filter .visits ?= 1 or .name = "ann"`.

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

`is` also tests a scalar type, decided when the query compiles: `select 1 is int64` and `select 1 is anyint` are `true`, and `select User { b := .born is cal::local_date }` gives `true` for each user with a `born` (an empty operand stays empty). `is not` negates it, where Gel 7.1 answers `false` for every scalar `is not`.

### Pattern Matching

| Operator    | Description                    | Example                   |
| :---------- | :----------------------------- | :------------------------ |
| `like`      | Case-sensitive pattern match   | `.name like "A%"`         |
| `ilike`     | Case-insensitive pattern match | `.name ilike "%ada%"`     |
| `not like`  | Negated `like`                 | `.name not like "A%"`     |
| `not ilike` | Negated `ilike`                | `.name not ilike "%ada%"` |

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

1. Power: `^` (right to left)
2. Unary: `+`, `-`, `not`, `exists`, `distinct`, `~`
3. Multiplicative: `*`, `/`, `//`, `%`
4. Additive: `+`, `-`, `++`
5. Comparison: `=`, `!=`, `<`, `>`, `<=`, `>=`, `?=`, `?!=`
6. Membership: `in`, `not in`, `is`, `is not`, `like`, `ilike`, `not like`, `not ilike`
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
SELECT CAST($2 AS uuid), (disc_json_index(for_iter.val, 'object_id')) #>> '{}', (disc_json_index(for_iter.val, 'object_type')) #>> '{}',
       CAST((disc_json_index(for_iter.val, 'size')) #>> '{}' AS bigint), std_base64_decode((disc_json_index(for_iter.val, 'content')) #>> '{}')
FROM JSONB_ARRAY_ELEMENTS(CAST($1 AS jsonb)) AS for_iter(val)
ON CONFLICT (program_id, object_id) DO NOTHING RETURNING id
```

- **Response:** `[{ "id": "…" }, …]` — one entry per row actually inserted, never the inserted properties. With `unless conflict on (…)`, rows that already existed are absent, so re-running the same request is a no-op that answers `[]` and raises nothing.
- **Iterators:** `json_array_unpack(…)`, `array_unpack(<array<T>>$xs)`, `range_unpack(…)` (integer ranges), or a subquery. The body is one `insert` (no multi-link assignment) or a `select`. `update`/`delete` bodies are not supported — use one statement with `filter .id in array_unpack(<array<uuid>>$ids)` instead.
- **JSON casts:** `<str>item['k']` gives the string without quotes; `<array<str>>item['parents']` keeps order and round-trips `[]`; bytes go in as base64 text and are decoded with `std::base64_decode(<str>…)` (see [Casting from JSON](#:~:text=Casting%20from%20JSON)). A row missing a key raises `JSON index 'k' is out of bounds`, which rejects the statement; a key present with `null` is empty, and `<str>json_get(item, 'k')` reads a key a row may leave out.
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

A `with`-bound `select` is filtered by the type’s select policy like any other read (see [Access Policies](access-policies.md#:~:text=Where%20policies%20apply)).

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

The `group` statement partitions objects by one or more keys. Each group comes back as Gel’s free object: `key` holds each key’s value under its name, `grouping` the key names in `by` order, and `elements` the group’s objects.

### Basic Grouping

```edgeql
group User
by .status;
```

```json
[
  { "key": { "status": "active" }, "grouping": ["status"], "elements": [{ "id": "…", "name": "Ada", "status": "active" }, …] },
  { "key": { "status": "away" }, "grouping": ["status"], "elements": [{ "id": "…", "name": "Billie", "status": "away" }] }
]
```

Without a shape, each element is the object’s `id` and stored properties, as `select User` gives them. Groups, and the elements of a group, come in no set order.

### Shaping the Elements

A shape on the grouped type is the elements’ shape:

```edgeql
group User { email, name }
by .status;
```

The grouped objects may also be a select, a `with` binding or a path, as in Gel. A path’s objects are distinct: in `group Post.author { name } by .role`, the author of two posts is one element.

```edgeql
group (select User filter .active) { name }
by .role;

with u := (select User filter .score > 3)
group u { name }
by .role;
```

### `USING` and Multiple Group Keys

`using` binds a key to an expression; `by` lists the keys, bound names and properties alike:

```edgeql
group Sale { amount }
using month := datetime_truncate(.created_at, "month")
by month, .status;
# key: { "month": "2026-03-01T00:00:00+00:00", "status": "paid" }, grouping: ["month", "status"]
```

### Grouping Sets, `cube` and `rollup`

As in Gel, `by` may name several sets of keys, each grouped on its own: `{.a, .b}` groups by `.a` and, separately, by `.b`; `cube(.a, .b)` by every subset of the keys (`.a, .b`; `.a`; `.b`; none); `rollup(.a, .b)` by each leading run (`.a, .b`; `.a`; none). In a group of one set, the keys outside it are `null` and left out of `grouping`:

```edgeql
select (group User by cube(.role, .active)) {
  key: { role, active },
  grouping,
  n := count(.elements)
};
# { key: { role: null, active: null }, grouping: [], n: 3 }
# { key: { role: "dev", active: null }, grouping: ["role"], n: 2 }
# { key: { role: "dev", active: true }, grouping: ["role", "active"], n: 1 }
# …
```

Sets combine with plain keys — `by .role, {.active, .name}` groups by `.role` with each of the others — and a parenthesized list groups as its keys alone do: `by (.role, .active)` is `by .role, .active`.

### Selecting Over a Group

A `select` over a `group` works as in Gel. Its shape reads each group’s `key`, `grouping` and `elements` — nothing else, so `{ status }` is an error — and aggregates of the elements; `filter`, `order by`, `offset` and `limit` read the group and the shape’s computeds:

```edgeql
select (group User by .status) {
  key: { status },
  n := count(.elements)
}
filter .n > 1
order by .n desc
limit 5;
```

`elements: { name }` gives the elements a shape; without one they take the group’s (`group User { name } by …`). The sub-shape takes its own `filter`, `order by`, `offset` and `limit`, which pick and order each group’s elements: `elements: { name } order by .name desc limit 1`. A computed of the elements’ values is each group’s list of them — `names := .elements.name`, `e := .elements.name ++ '!'` — and `.elements { name }` or `(select .elements { name } filter .score > 3)` is a select of the group’s objects. A bare `key`, without a sub-shape, is Gel’s empty free object `{}`; name the keys (`key: { status }`) to read them.

`.elements.x` in the select’s own `filter` or `order by` is not supported yet; filter and order on a computed that aggregates the elements (`n := count(.elements)`).

### `FILTER` on Groups

A `filter` after `by` keeps the groups it holds for; in it, the grouped type stands for the group’s objects, so `count(User)` is the group’s size. This is a Disc extension (it compiles to SQL `HAVING`); Gel’s `group` has no `filter`. Gel rejects this form — for a query that also runs on Gel, select over the group and filter that: `select (group User by .city) { key: { city }, n := count(.elements) } filter .n > 10`.

```edgeql
group User { name }
by .city
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
select "abc"[1];               # Returns "b"
```

An index past either end raises `InvalidValueError`, as in Gel: `select [10, 20, 30][5]` fails with `array index 5 is out of bounds` (`string index …` for a `str`, `byte string index …` for `bytes`). Use `array_get` for an element that may be missing — it returns the empty set instead. Strings and `bytes` index the same way as arrays.

A json value indexes as in Gel: an array by position (a negative index counts from the end), a string by character (`(<json>'xyz')[0]` is `"x"`), an object by key (`j['name']`). An index past either end or a missing key raises `InvalidValueError` — `JSON index 5 is out of bounds`, `JSON index 'missing' is out of bounds` — and so does indexing the wrong kind of value: `cannot index JSON number` (`string`, `boolean`, `null`), `cannot index JSON array by text`, `cannot index JSON object by bigint`. A key present with a JSON `null` reads as empty once cast. `json_get(j, 'k')` returns the empty set for a missing key or index instead.

### Array Slicing

Extract sub-arrays with `[start:end]` syntax — 0-based, end-exclusive; a negative bound counts from the end and an omitted bound means the start or end:

```edgeql
select [10, 20, 30][1:3];                      # Returns [20, 30]
select [10, 20, 30][:-1];                      # Returns [10, 20]
select [(1, "a"), (2, "b"), (3, "c")][-2:];   # Returns [(2, "b"), (3, "c")]
select "hello"[1:3];                           # Returns "el"
select b"hello"[1:3];                          # Returns b"el"
```

As in Gel, a bound out of range is clamped rather than raising: `[10, 20, 30][-5:10]` is the whole array and `[10, 20, 30][2:1]` is `[]`. An empty bound (`[<int64>{}:2]`) makes the result the empty set. Slicing works on every array (literals, parameters, stored `array<…>` properties), on strings and on `bytes`.

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

A tuple or array built from paths of one type is one value per object, as in Gel: `select (User.name, User.age)` gives one tuple per user, and none for a user whose `age` is empty. The same holds wherever a tuple or array is built — a `select`, a `for … union` body, a computed: one with an empty element is no value at all, so `select (1, <str>{})` returns `[]` and a computed `t := (.a, .b)` is empty for an object missing `b`.

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

A tuple cast to a named tuple type takes the type’s names: `select <tuple<a: int64, b: str>>(1, "x")` returns `[{ "a": 1, "b": "x" }]`.

### Named Tuple Field Access

Access fields by name:

```edgeql
select (name := "Ada", age := 30).name;   # Returns "Ada"
select (name := "Ada", age := 30).age;    # Returns 30
```

An element keeps its own type: `(a := 1).a` is an `int64`, so `(a := 1).a + 1` returns `2`. Element access works through paths too — `select Rec.t.a` on a stored `tuple<a: int64, b: str>` property returns the bare `a` values, one per object.

Tuples united into one set or array — an array literal, `++`, a set literal `{…}`, `union` — and the alternatives of `??` and `if … else` keep their names only when every tuple has the same names; otherwise the result is unnamed, as in Gel:

```edgeql
select [(a := 1)] ++ [(a := 2)];     # Returns [(a := 1), (a := 2)]
select [(a := 1)] ++ [(2,)];         # Returns [(1,), (2,)]
select (a := 1) union (b := 2);      # Returns {(1,), (2,)}
select (a := 1) ?? (b := 2);         # Returns (1,)
```

### Arrays of Tuples

An `array<tuple<…>>` has one form everywhere — a literal, a parameter, an `array_agg` of tuples, a stored property: a JSON array of tuples, stored as `jsonb`. So `++`, `array_agg`, `array_unpack`, `len`, indexing (negative too), slicing, comparisons (`=`, `<`, `in`), `order by`, `distinct` and `group` all work on it, as in Gel:

```edgeql
select [(1, "a")] ++ <array<tuple<int64, str>>>$more;
select Route { first := .stops[0], rest := .stops[1:], n := len(.stops) };
```

A field of an indexed element reads straight off it — `[(n := 1)][0].n`, `.stops[0].x` — and indexing, slicing and tuple access apply to a path’s set element by element: `select Route.stops[1:]`, `select Route.stops[1].y`.

A parameter written to an array-of-tuples property is stored with each tuple cast to its declared types, so it compares equal to a literal of the same value.

### Arrays of Arrays

An array may hold arrays, of different lengths too, as in Gel: `[[1, 2], [3]]` indexes (`[[1, 2], [3]][0][1]` is `2`), slices, concatenates, unpacks, aggregates (`array_agg({[1, 2], [3]})`), compares and casts to and from `json` like any array, and binds as a parameter (`<array<array<int64>>>$grid`). A schema type can’t be one: a property, tuple element or scalar type of `array<array<…>>` is rejected with `nested arrays are not supported`, as Gel rejects it. An array of tuples of arrays (`array<tuple<array<int64>>>`) is allowed.

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

Disc’s migration engine creates one PG table per concrete subtype, which holds its objects; the abstract parent’s own table only keeps trigger-maintained copies of them, so links to it have valid foreign keys. `insert` on an abstract type is an error, and `update`/`delete` on one run per concrete subtype. `SELECT <Abstract>` lowers to a `UNION ALL` across the subtype tables; each branch projects the abstract type’s properties (`id`, plus shared columns like `color`) so the outer SELECT can reference the abstract’s alias as if it were a regular table.

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

Settings that apply to the current database (PostgreSQL’s per-database value, `ALTER DATABASE <current> SET`), which every new connection to it starts with:

```edgeql
configure database set work_mem := "256MB";
```

Gel’s spellings `configure current branch` and `configure current database` mean the same thing, for `set` and `reset`.

### System/Instance Configuration

Settings that apply to the entire Disc instance. `configure instance` is Gel’s newer name for `configure system`; both write the same setting:

```edgeql
configure system set max_connections := 200;
configure instance set shared_buffers := "1GB";
```

### Reset Configuration

Reset a setting to its default value:

```edgeql
configure session reset query_execution_timeout;
```

### Who may configure

`configure session` is open to every caller, for the session-level keys below. `configure database`, `configure instance` and `configure system` (`set` and `reset`) persist, so they need an administrator:

- **HTTP (`POST /query`):** the [service credential](access-policies.md#:~:text=Service%20credential), or a verified user with the `admin` role or the `superuser` role `disc admin create-superuser` grants.
- **Binary protocol:** only a connection that authenticated with `DISC_BINARY_PASSWORD`. With no password set, no binary connection may configure persistently.
- **WebSocket:** never.

Anyone else gets a `DisabledCapabilityError` ("cannot execute configuration commands"; HTTP `403`, `DISABLED_CAPABILITY`). The admin UI’s config editor (`POST /config`) takes the same administrators, even with auth off.

### Available Configuration Keys

Only these keys are accepted; any other is a `ConfigurationError` (HTTP `400`, `CONFIGURATION_ERROR`), for administrators too.

**Session-level** — any caller with `configure session`, an administrator persistently:

| Key                                   | PostgreSQL setting                    | Description                       |
| :------------------------------------ | :------------------------------------ | :-------------------------------- |
| `query_execution_timeout`             | `statement_timeout`                   | Maximum query execution time      |
| `session_idle_transaction_timeout`    | `idle_in_transaction_session_timeout` | Timeout for idle transactions     |
| `idle_in_transaction_session_timeout` | `idle_in_transaction_session_timeout` | Timeout for idle transactions     |
| `lock_timeout`                        | `lock_timeout`                        | Maximum wait time for locks       |

**System-level** — administrators only, with `configure database | instance | system`; `configure session` of one is a `ConfigurationError` telling you to use `configure system`:

| Key                         | Description                                      |
| :-------------------------- | :----------------------------------------------- |
| `shared_buffers`            | Shared memory for caching                        |
| `query_work_mem`            | Memory for sorts and hashes (`work_mem`)         |
| `work_mem`                  | Memory for sort and hash operations              |
| `maintenance_work_mem`      | Memory for maintenance operations                |
| `effective_cache_size`      | Planner’s estimate of available cache            |
| `effective_io_concurrency`  | Concurrent disk I/O operations                   |
| `default_statistics_target` | Default planner statistics target                |
| `max_connections`           | Maximum concurrent connections                   |

These map to PostgreSQL settings under the hood (`configure system` and `configure instance` are `ALTER SYSTEM SET`, `configure database` is `ALTER DATABASE SET` on the current database; `reset` is the matching `RESET`). Nothing that holds a secret, names a file or command, or controls logging, networking or replication is configurable.

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

# With a format, as in Gel (PostgreSQL's to_char / to_timestamp / to_number patterns)
select to_str(<datetime>"2024-01-02T03:04:05Z", "YYYY-MM-DD HH24:MI");   # "2024-01-02 03:04" (UTC)
select to_str(1234567, "9,999,999");                                     # " 1,234,567"
select to_datetime("2024-01-02 03:04:05 +02", "YYYY-MM-DD HH24:MI:SS TZH");
select cal::to_local_date("02/01/2024", "DD/MM/YYYY");
select to_int64("1,234", "9,999");                                       # 1234
```

See [Functions → `to_str`](functions.md#:~:text=With%20a%20format%2C%20to_str%20follows%20Gel) for which formats each type takes, and the zone, epoch-seconds and field-by-field forms of `to_datetime` and the `cal::to_local_*` functions.

### JSON Functions

```edgeql
select json_typeof(to_json("42"));          # "number"
select json_get(to_json('{"a":1}'), "a");   # 1
select json_get(to_json('{"a":[{"b":5}]}'), "a", "0", "b");   # 5
select json_array_unpack(to_json("[1,2,3]"));
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
group Sale { amount, created_at }
using month := datetime_truncate(.created_at, "month")
by month
filter count(Sale) >= 10;
```

Each group’s `key.month` names the month and its `elements` carry the amounts to total; months with fewer than ten sales are left out.

---

## See Also

- [Schema Reference](schema.md) -- defining your data model
- [Functions Reference](functions.md) -- complete function documentation
- [Migrations](migrations.md) -- schema change management
- [Client SDK](client-sdk.md) -- using EdgeQL from TypeScript
