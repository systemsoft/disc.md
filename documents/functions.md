# Built-in Functions Reference

Disc provides a comprehensive standard library of built-in functions available in EdgeQL queries. Each function compiles to its PostgreSQL equivalent at query time.

This reference documents every function registered in the Disc compiler. Functions are organized by category.

Only registered functions compile. A call to a name the compiler does not know — a built-in (with or without `std::`), an SDL `function` declaration (`f` / `default::f`, or `mod::f` in another module), or an extension or custom function — is Gel’s `InvalidReferenceError` naming it: `function 'default::nope' does not exist` (a bare name is named in the module it was looked up in). PostgreSQL-native names such as `lower()`, `coalesce()` or `now()` are not passed through; use `str_lower()`, `??` and `datetime_current()`.

An SDL `function` runs wherever an expression goes: a query, a shape, a `filter`, an `order by`, a schema computed or a property’s default. Disc creates nothing in PostgreSQL for it — each call is replaced, as the query compiles, by the function’s body with its parameters replaced by the arguments — so a migration that changes only functions runs no DDL, and the next query calls the new body. See [below](#:~:text=SDL%20Functions).

**See also:** [EdgeQL](edgeql.md) | [Schema](schema.md) | [CLI](cli.md)

---

## SDL Functions

A `function` declared in the schema is called like a built-in:

```sdl
module default {
  type Post {
    required title: str;
    score: int64;
  };

  function full_name(first: str, last: str) -> str using (first ++ ' ' ++ last);
  function greet(name: optional str = 'world') -> str using ('hi ' ++ (name ?? 'x'));
  function joined(a: str, named only sep: str = ',') -> str using (a ++ sep);
  function dbl(x: int64) -> int64 using (x * 2);
  function top_posts(n: int64) -> set of Post using (select Post order by .score desc limit n);
  function new_post(t: str) -> Post {
    volatility := 'Modifying';
    using (insert Post { title := t });
  };
};
```

```edgeql
select full_name('Ada', 'Lovelace');  # "Ada Lovelace"
select greet();                       # "hi world"
select joined('a', sep := '-');       # "a-"
select dbl({1, 2, 3});                # {2, 4, 6}
select top_posts(3) { title };
```

Arguments fill the parameters by position, except those declared `named only`, which are passed by name (`sep := '-'`); a parameter with a default may be left out. An `optional` parameter takes the empty set when its argument is empty (`greet(<str>{})` is `"hi x"`). Any other parameter makes the call element-wise, as in Gel: it runs once for each element of the argument (`dbl({1, 2, 3})`), and an empty argument makes the result empty. `set of` parameters are rejected, as Gel rejects them: `SET OF parameters in user-defined EdgeQL functions are not supported`.

The overload is chosen by the argument types, with Gel’s implicit casts (an `int16` argument takes an `int64` parameter). A call no overload takes is Gel’s error naming the argument types, with the declared signatures as its hint: `function "full_name(arg0: std::str)" does not exist`, hint `Did you want "default::full_name(first: std::str, last: std::str)"?`. A function of another module is called by its module (`util::twice(2)`).

A function returning objects is a select of them: it takes a shape (`select top_posts(3) { title }`), and a schema computed calling it is a computed link. A function whose body writes (`new_post` above) makes the query calling it a write, which read-only mode refuses.

A function may call others. One that calls itself, directly or through others, is a schema error (`function 'default::rec(x: int64)' is defined recursively`, `definition dependency cycle between function … and function …`), and so is a second function with the same signature (`a function with the same signature is already defined`).

The block form, `{ volatility := '…'; using (…); }`, may also hold annotations. The volatility is recorded but not otherwise enforced, and the body is not checked against the declared return type. [Codegen](codegen.md) types a computed calling a function by its declared return type, but generates no client method for the function itself: call it in a query.

SDL functions are EdgeQL, inlined; the [custom functions extension](extensions.md#:~:text=The%20custom%20functions%20extension) is a separate mechanism, for SQL and PL/pgSQL functions created in PostgreSQL.

---

## String Functions

### `len`

Returns the length of a string.

```
len(val: str) -> int64
```

**Example:**

```edgeql
select len('hello');
```

**SQL equivalent:** `LENGTH('hello')`

---

### `str_lower`

Converts a string to lowercase.

```
str_lower(val: str) -> str
```

**Example:**

```edgeql
select str_lower('HELLO WORLD');
# => 'hello world'
```

**SQL equivalent:** `LOWER('HELLO WORLD')`

---

### `str_upper`

Converts a string to uppercase.

```
str_upper(val: str) -> str
```

**Example:**

```edgeql
select str_upper('hello world');
# => 'HELLO WORLD'
```

**SQL equivalent:** `UPPER('hello world')`

---

### `str_title`

Converts a string to title case (capitalizes the first letter of each word).

```
str_title(val: str) -> str
```

**Example:**

```edgeql
select str_title('hello world');
# => 'Hello World'
```

**SQL equivalent:** `INITCAP('hello world')`

---

### `str_trim`

Removes leading and trailing whitespace from a string.

```
str_trim(val: str) -> str
```

**Example:**

```edgeql
select str_trim('  hello  ');
# => 'hello'
```

**SQL equivalent:** `TRIM('  hello  ')`

---

### `str_ltrim`

Removes leading whitespace from a string.

```
str_ltrim(val: str) -> str
```

**Example:**

```edgeql
select str_ltrim('  hello');
# => 'hello'
```

**SQL equivalent:** `LTRIM('  hello')`

---

### `str_rtrim`

Removes trailing whitespace from a string.

```
str_rtrim(val: str) -> str
```

**Example:**

```edgeql
select str_rtrim('hello  ');
# => 'hello'
```

**SQL equivalent:** `RTRIM('hello  ')`

---

### `str_repeat`

Repeats a string a given number of times.

```
str_repeat(val: str, n: int64) -> str
```

**Example:**

```edgeql
select str_repeat('ab', 3);
# => 'ababab'
```

**SQL equivalent:** `REPEAT('ab', 3)`

---

### `str_replace`

Replaces all occurrences of a substring with another string.

```
str_replace(val: str, old: str, new: str) -> str
```

**Example:**

```edgeql
select str_replace('hello world', 'world', 'disc');
# => 'hello disc'
```

**SQL equivalent:** `REPLACE('hello world', 'world', 'disc')`

---

### `str_split`

Splits a string by a delimiter and returns an array.

```
str_split(val: str, delimiter: str) -> array<str>
```

**Example:**

```edgeql
select str_split('a,b,c', ',');
# => ['a', 'b', 'c']
```

**SQL equivalent:** `STRING_TO_ARRAY('a,b,c', ',')`

---

### `str_starts_with`

Returns true if the string starts with the given prefix.

```
str_starts_with(val: str, prefix: str) -> bool
```

**Example:**

```edgeql
select str_starts_with('hello', 'he');
# => true
```

**SQL equivalent:** `STARTS_WITH('hello', 'he')`

---

### `str_ends_with`

Returns true if the string ends with the given suffix.

```
str_ends_with(val: str, suffix: str) -> bool
```

**Example:**

```edgeql
select str_ends_with('hello', 'lo');
# => true
```

**SQL equivalent:** `RIGHT('hello', LENGTH('lo')) = 'lo'`

---

### `str_pad_start`

Pads a string on the left to a specified length. Uses spaces by default, or a custom fill character.

```
str_pad_start(val: str, n: int64, fill?: str) -> str
```

**Example:**

```edgeql
select str_pad_start('42', 5, '0');
# => '00042'

select str_pad_start('hi', 6);
# => '    hi'
```

**SQL equivalent:** `LPAD('42', 5, '0')`

---

### `str_pad_end`

Pads a string on the right to a specified length. Uses spaces by default, or a custom fill character.

```
str_pad_end(val: str, n: int64, fill?: str) -> str
```

**Example:**

```edgeql
select str_pad_end('hi', 6, '.');
# => 'hi....'
```

**SQL equivalent:** `RPAD('hi', 6, '.')`

---

### `contains`

Returns true if the haystack string contains the needle substring.

This function is overloaded -- when used with range arguments, it checks whether a range contains an element (see [Range Functions](#:~:text=equivalent%3A%20CONVERT_FROM(...%2C%20%27UTF8%27)-,Range%20Functions,-Range%20functions%20operate)).

```
contains(haystack: str, needle: str) -> bool
```

**Example:**

```edgeql
select contains('hello world', 'world');
# => true

select contains('hello world', 'xyz');
# => false
```

**SQL equivalent:** `STRPOS('hello world', 'world') > 0`

---

### `find`

Returns the 0-based index of the first occurrence of needle in haystack. Returns -1 if not found.

```
find(haystack: str, needle: str) -> int64
```

**Example:**

```edgeql
select find('hello world', 'world');
# => 6

select find('hello', 'xyz');
# => -1
```

**SQL equivalent:** `STRPOS('hello world', 'world') - 1`

Note: PostgreSQL’s `STRPOS` is 1-indexed and returns 0 when not found. Disc adjusts the result to match EdgeQL’s 0-indexed convention.

---

## Regex Functions

### `re_match`

Returns the first match of a regular expression pattern against a string. Returns an array of matched groups.

Note: Argument order in EdgeQL is `(pattern, string)`, but this compiles to PostgreSQL’s `REGEXP_MATCH(string, pattern)` with arguments swapped.

```
re_match(pattern: str, val: str) -> array<str>
```

**Example:**

```edgeql
select re_match('^[a-z]+$', 'hello');
# => ['hello']

select re_match('(\w+)@(\w+)', 'user@host');
# => ['user@host', 'user', 'host']
```

**SQL equivalent:** `REGEXP_MATCH('hello', '^[a-z]+$')`

---

### `re_match_all`

Returns all matches of a regular expression pattern against a string. Each match is an array of groups.

```
re_match_all(pattern: str, val: str) -> array<array<str>>
```

**Example:**

```edgeql
select re_match_all('[0-9]+', 'a1b2c3');
# => [['1'], ['2'], ['3']]
```

**SQL equivalent:** `REGEXP_MATCHES('a1b2c3', '[0-9]+', 'g')`

---

### `re_replace`

Replaces occurrences of a regex pattern with a substitution string.

Note: Argument order in EdgeQL is `(pattern, sub, string)`, but this compiles to PostgreSQL’s `REGEXP_REPLACE(string, pattern, sub)` with arguments reordered.

```
re_replace(pattern: str, sub: str, val: str) -> str
```

**Example:**

```edgeql
select re_replace('[0-9]', 'X', 'a1b2');
# => 'aXbX'
```

**SQL equivalent:** `REGEXP_REPLACE('a1b2', '[0-9]', 'X')`

---

### `re_test`

Returns true if the string matches the regular expression pattern.

```
re_test(pattern: str, val: str) -> bool
```

**Example:**

```edgeql
select re_test('^[a-z]+$', 'hello');
# => true

select re_test('^[0-9]+$', 'hello');
# => false
```

**SQL equivalent:** `'hello' ~ '^[a-z]+$'`

---

## Math Functions

### `random`

Returns a pseudo-random `float64` in the range `0.0 <= x < 1.0`. Volatile — a new value every call.

```
random() -> float64
```

**Example:**

```edgeql
# random row ordering
select User { name } order by random() limit 1;
```

**SQL equivalent:** `RANDOM()`

---

### `math_abs`

Returns the absolute value of a number.

```
math_abs(val: anyreal) -> anyreal
```

**Example:**

```edgeql
select math_abs(-42);
# => 42

select math_abs(-3.14);
# => 3.14
```

**SQL equivalent:** `ABS(-42)`

---

### `math_ceil`

Returns the smallest integer greater than or equal to the given value.

```
math_ceil(val: anyreal) -> float64
```

**Example:**

```edgeql
select math_ceil(3.2);
# => 4.0

select math_ceil(-1.5);
# => -1.0
```

**SQL equivalent:** `CEIL(3.2)`

---

### `math_floor`

Returns the largest integer less than or equal to the given value.

```
math_floor(val: anyreal) -> float64
```

**Example:**

```edgeql
select math_floor(3.8);
# => 3.0

select math_floor(-1.2);
# => -2.0
```

**SQL equivalent:** `FLOOR(3.8)`

---

### `round`

Rounds a number to the nearest integer.

```
round(val: anyreal) -> float64
```

**Example:**

```edgeql
select round(3.5);
# => 4.0

select round(3.4);
# => 3.0
```

**SQL equivalent:** `ROUND(3.5)`

---

### `math_sqrt`

Returns the square root of a number.

```
math_sqrt(val: anyreal) -> float64
```

**Example:**

```edgeql
select math_sqrt(16);
# => 4.0
```

Can also be invoked with the `math::` namespace prefix:

```edgeql
select math::sqrt(16);
```

**SQL equivalent:** `SQRT(16)`

---

### `math_pow`

Raises a base to the given exponent.

```
math_pow(base: anyreal, exp: anyreal) -> float64
```

**Example:**

```edgeql
select math::pow(2, 10);
# => 1024.0
```

**SQL equivalent:** `POWER(2, 10)`

---

### `math_power`

Alias for `math_pow`. Raises a base to the given exponent.

```
math_power(base: anyreal, exp: anyreal) -> float64
```

**Example:**

```edgeql
select math_power(3, 3);
# => 27.0
```

**SQL equivalent:** `POWER(3, 3)`

---

### `math_log`

Returns the logarithm of a value with the specified base.

```
math_log(base: anyreal, val: anyreal) -> float64
```

**Example:**

```edgeql
select math::log(10, 100);
# => 2.0
```

**SQL equivalent:** `LOG(10, 100)`

---

### `math_ln`

Returns the natural logarithm (base e) of a value.

```
math_ln(val: anyreal) -> float64
```

**Example:**

```edgeql
select math::ln(2.718);
# => ~1.0
```

**SQL equivalent:** `LN(2.718)`

---

### `math_log10`

Returns the base-10 logarithm of a value.

```
math_log10(val: anyreal) -> float64
```

**Example:**

```edgeql
select math_log10(100);
# => 2.0
```

**SQL equivalent:** `LOG(10, val)` (computed via PostgreSQL’s `LOG` function with base 10)

---

### `math_log2`

Returns the base-2 logarithm of a value.

```
math_log2(val: anyreal) -> float64
```

**Example:**

```edgeql
select math_log2(8);
# => 3.0
```

**SQL equivalent:** `LOG(2, val)` (computed via PostgreSQL’s `LOG` function with base 2)

---

### `math_pi`

Returns the value of pi.

```
math_pi() -> float64
```

**Example:**

```edgeql
select math::pi();
# => 3.141592653589793
```

**SQL equivalent:** `PI()`

---

### `math_e`

Returns the value of Euler’s number (e).

```
math_e() -> float64
```

**Example:**

```edgeql
select math::e();
# => 2.718281828459045
```

**SQL equivalent:** `EXP(1)`

---

### `math_mean`

Returns the arithmetic mean (average) of a set of values. This is an aggregate function and can also be used as a window function.

```
math_mean(expr: anyreal) -> float64
```

**Example:**

```edgeql
select math_mean(User.age);
```

**SQL equivalent:** `AVG(...)` (same as `avg`)

---

## Aggregate Functions

Aggregate functions operate on sets of values and return a single result. All aggregate functions listed here can also be used as window functions with an `OVER` clause.

In a shape, filter or `order by`, an aggregate over a value of the current object (`count(.visits)`, `sum(.n)`, `max(.best.title)`) aggregates that object’s set — for a single property, zero or one element — not the rows of the enclosing `select`: `select User { c := count(.visits) }` is `0` or `1` per user.

### `count`

Returns the number of elements in a set.

```
count(expr: any) -> int64
```

**Example:**

```edgeql
select count(User);

select count(User filter .active = true);
```

**SQL equivalent:** `COUNT(...)`

---

### `sum`

Returns the sum of a set of numeric values.

```
sum(expr: anyreal) -> int64
```

**Example:**

```edgeql
select sum(Order.total);
```

**SQL equivalent:** `SUM(...)`

---

### `min`

Returns the minimum value in a set.

```
min(expr: any) -> int64
```

**Example:**

```edgeql
select min(Product.price);
```

**SQL equivalent:** `MIN(...)`

---

### `max`

Returns the maximum value in a set.

```
max(expr: any) -> int64
```

**Example:**

```edgeql
select max(Product.price);
```

**SQL equivalent:** `MAX(...)`

---

### `avg`

Returns the arithmetic mean of a set of numeric values.

```
avg(expr: anyreal) -> float64
```

**Example:**

```edgeql
select avg(Order.total);
```

**SQL equivalent:** `AVG(...)`

---

### `stddev`

Returns the sample standard deviation (equivalent to `stddev_samp`).

```
stddev(expr: anyreal) -> float64
```

**Example:**

```edgeql
select stddev(Measurement.value);
```

**SQL equivalent:** `STDDEV(...)`

---

### `stddev_pop`

Returns the population standard deviation.

```
stddev_pop(expr: anyreal) -> float64
```

**Example:**

```edgeql
select stddev_pop(Measurement.value);
```

**SQL equivalent:** `STDDEV_POP(...)`

---

### `stddev_samp`

Returns the sample standard deviation.

```
stddev_samp(expr: anyreal) -> float64
```

**Example:**

```edgeql
select stddev_samp(Measurement.value);
```

**SQL equivalent:** `STDDEV_SAMP(...)`

---

### `array_agg`

Collects a set of values into an array.

```
array_agg(expr: any) -> array
```

**Example:**

```edgeql
select array_agg(User.name);
# => ['Ada', 'Billie', 'Cher']
```

**SQL equivalent:** `ARRAY_AGG(...)`

---

## Type Conversion Functions

Type conversion functions cast values from one type to another. They compile to PostgreSQL `CAST` expressions.

The string parsers `to_int16`, `to_int32`, `to_int64`, `to_float32`, `to_float64`, `to_bigint` and `to_decimal` take an optional format as a second argument, as in Gel: a PostgreSQL `to_number` pattern (`to_int64('1,234', '9,999')` is `1234`; an integer parser rounds, so `to_int64('12.7', '99.9')` is `13`). An empty format is an error (`to_int64(): "fmt" argument must be a non-empty string`), even for an empty value the query names (`to_int64(<str>{}, '')`); an empty-set format parses as without one.

### `to_str`

Converts any value to a string.

```
to_str(val: any, fmt: optional str = {}) -> str
```

**Example:**

```edgeql
select to_str(42);
# => '42'

select to_str(<datetime>'2024-01-02T00:00:00Z');
# => '2024-01-02T00:00:00+00:00'

select to_str(<datetime>'2024-01-02T03:04:05Z', 'YYYY-MM-DD HH24:MI:SS');
# => '2024-01-02 03:04:05'

select to_str(123, 'FM999');
# => '123'

select to_str(['a', 'b'], ', ');
# => 'a, b'
```

**SQL equivalent:** `CAST(42 AS text)`

A `datetime` or `cal::local_datetime` becomes its ISO 8601 text, as in Gel — for `<str>` casts too.

With a format, `to_str` follows Gel, which hands it to PostgreSQL’s `to_char`:

- A `datetime` is formatted in UTC (`TZ` is `UTC`). A `cal::local_datetime`, `cal::local_date` or `cal::local_time` is formatted as a local value (a local time on today’s UTC date).
- A `duration`, `cal::relative_duration` or `cal::date_duration` takes only Gel’s allowed fields (`YYYY`, `MM`, `DD`, `HH24`, `MI`, `SS`, `MS`, …); a name such as `Day` or `Mon` is `invalid format specification for an std::duration value`.
- A number takes a `to_char` number pattern: `to_str(123, '999')` is `' 123'`, `to_str(1234567, '9,999,999')` is `' 1,234,567'`.
- A `json` takes only `'pretty'`, which indents it; any other format is `to_str(): format '…' is invalid`.
- An `array<str>` is joined with the format as the delimiter, as `array_join` does.

An empty format is `to_str(): "fmt" argument must be a non-empty string`; an empty-set format gives the text without one. A `str` or `bool` takes no format.

For an integer, a float, a `decimal`, a `cal::local_time` or `json`, an empty format raises even when the value is an empty set the query names (`to_str(<int64>{}, '')`, or an `<optional int64>$v` given `null`), as do the number and `cal::to_local_date` / `cal::to_local_time` parsers. Disc raises this every time; Gel 7.1 raises it only the first time it runs such a query and answers `[]` from its query cache after. The other types, and a value of each row (`to_str(.n, '')` of an object without `n`), give the empty set.

---

### `to_int16`

Converts a value to a 16-bit integer.

```
to_int16(val: any, fmt: optional str = {}) -> int16
```

**Example:**

```edgeql
select to_int16('42');
```

**SQL equivalent:** `CAST('42' AS smallint)`

---

### `to_int32`

Converts a value to a 32-bit integer.

```
to_int32(val: any, fmt: optional str = {}) -> int32
```

**Example:**

```edgeql
select to_int32('42');
```

**SQL equivalent:** `CAST('42' AS integer)`

---

### `to_int64`

Converts a value to a 64-bit integer.

```
to_int64(val: any, fmt: optional str = {}) -> int64
```

**Example:**

```edgeql
select to_int64('42');
```

**SQL equivalent:** `CAST('42' AS bigint)`

---

### `to_float32`

Converts a value to a 32-bit floating-point number.

```
to_float32(val: any, fmt: optional str = {}) -> float32
```

**Example:**

```edgeql
select to_float32('3.14');
```

**SQL equivalent:** `CAST('3.14' AS real)`

---

### `to_float64`

Converts a value to a 64-bit floating-point number.

```
to_float64(val: any, fmt: optional str = {}) -> float64
```

**Example:**

```edgeql
select to_float64('3.14');
```

**SQL equivalent:** `CAST('3.14' AS double precision)`

---

### `to_bigint`

Converts a value to an arbitrary-precision integer.

```
to_bigint(val: any, fmt: optional str = {}) -> bigint
```

**Example:**

```edgeql
select to_bigint('999');
```

**SQL equivalent:** `CAST('999' AS numeric)`

---

### `to_decimal`

Converts a value to an arbitrary-precision decimal.

```
to_decimal(val: any, fmt: optional str = {}) -> decimal
```

**Example:**

```edgeql
select to_decimal('1.5');
```

**SQL equivalent:** `CAST('1.5' AS numeric)`

---

### `to_bool`

Converts a value to a boolean.

```
to_bool(val: any) -> bool
```

**Example:**

```edgeql
select to_bool('true');
# => true
```

**SQL equivalent:** `CAST('true' AS boolean)`

---

### `to_uuid`

Converts a string to a UUID.

```
to_uuid(val: any) -> uuid
```

**Example:**

```edgeql
select to_uuid('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
```

**SQL equivalent:** `CAST('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AS uuid)`

---

## JSON Functions

### `to_json`

Parses JSON text into a `json` value, as in Gel. To turn any other value into JSON, cast it: `<json>42` is the number `42`, and `<json>'hello'` is the JSON string `"hello"` (a cast never parses its string).

```
to_json(str: str) -> json
```

**Example:**

```edgeql
select to_json('{"name": "Ada", "tags": [1, 2]}');
select to_json('[1, 2, 3]');
```

**SQL equivalent:** `CAST('…' AS jsonb)`

---

### `json_typeof`

Returns the type of a JSON value as a string. Possible return values: `"string"`, `"number"`, `"boolean"`, `"null"`, `"object"`, `"array"`.

```
json_typeof(val: json) -> str
```

**Example:**

```edgeql
select json_typeof(<json>42);
# => 'number'

select json_typeof(<json>'hello');
# => 'string'
```

**SQL equivalent:** `JSONB_TYPEOF(...)`

---

### `json_get`

Retrieves a value from JSON by a path of object keys and array indexes, or `default` when the path finds nothing.

```
json_get(val: json, variadic path: str, named only default: optional json = {}) -> optional json
```

**Example:**

```edgeql
select json_get(to_json('{"name": "Ada", "age": 30}'), 'name');
# => '"Ada"'

select json_get(to_json('{"a": [{"b": 5}]}'), 'a', '0', 'b');
# => '5'

select json_get(to_json('{"a": 1}'), 'x', default := <json>'none');
# => '"none"'
```

An array index may be negative (`'-1'` is the last element). A path that finds nothing is the empty set — no row — unless a `default` is given; a JSON `null` found at the path is returned as `null`.

**SQL equivalent:** `jsonb_extract_path(val, 'a', '0', 'b')`, wrapped in `COALESCE(…, default)` when there is a default

---

### `json_array_unpack`

Expands a JSON array into a set of JSON elements.

```
json_array_unpack(val: json) -> set of json
```

**Example:**

```edgeql
select json_array_unpack(to_json('[1, 2, 3]'));
# => {1, 2, 3} (as individual JSON values)
```

**SQL equivalent:** `JSONB_ARRAY_ELEMENTS(...)`

---

### `json_object_unpack`

Expands a JSON object into a set of key-value pairs.

```
json_object_unpack(val: json) -> set of json
```

**Example:**

```edgeql
select json_object_unpack(to_json('{"a": 1, "b": 2}'));
```

**SQL equivalent:** `JSONB_EACH(...)`

---

## Array Functions

### `array_agg`

Collects a set of values into an array. See [Aggregate Functions](#:~:text=as%20avg\)-,Aggregate%20Functions,-Aggregate%20functions%20operate) for details.

---

### `array_unpack`

Unpacks an array into a set of individual elements.

```
array_unpack(val: array) -> set of any
```

**Example:**

```edgeql
select array_unpack([1, 2, 3]);
# => {1, 2, 3}
```

**SQL equivalent:** `UNNEST(ARRAY[1, 2, 3])`

---

### `array_join`

Joins array elements into a single string using a delimiter.

```
array_join(val: array<str>, delimiter: str) -> str
```

**Example:**

```edgeql
select array_join(['a', 'b', 'c'], ',');
# => 'a,b,c'

select array_join(['hello', 'world'], ' ');
# => 'hello world'
```

**SQL equivalent:** `ARRAY_TO_STRING(ARRAY['a','b','c'], ',')`

---

### `array_get`

Returns the element at a given 0-based index in an array.

```
array_get(val: array, index: int64) -> any
```

**Example:**

```edgeql
select array_get([10, 20, 30], 0);
# => 10

select array_get([10, 20, 30], 2);
# => 30
```

**SQL equivalent:** `(ARRAY[10,20,30])[0 + 1]`

Note: PostgreSQL arrays are 1-indexed. Disc automatically adjusts by adding 1 to the index. An index past the end is the empty set (no row), as in Gel.

---

## Set Functions

### `distinct`

Returns the distinct elements of a set, removing duplicates.

```
distinct(val: any) -> set of any
```

**Example:**

```edgeql
select distinct User.role;
```

**SQL equivalent:** `DISTINCT ...`

---

### `exists`

Returns true if a set is non-empty.

```
exists(val: any) -> bool
```

**Example:**

```edgeql
select exists(
  select User filter .email = 'admin@example.com'
);
# => true (if such a user exists)
```

Note: The EdgeQL parser treats `exists` as a unary keyword operator. It may compile to `EXISTS (subquery)` for subqueries or `expr IS NOT NULL` for scalar values.

---

### `enumerate`

Returns a set of (index, value) tuples, pairing each element with its 0-based position.

```
enumerate(val: any) -> set of tuple<int64, any>
```

**Example:**

```edgeql
select enumerate(User.name);
# => {(0, 'Ada'), (1, 'Billie'), (2, 'Cher')}
```

**SQL equivalent:** `jsonb_build_array(ROW_NUMBER() OVER () - 1, val)`

---

### `any`

Returns true if any element in a set of boolean values is true, and false for an empty set. The set can be any boolean expression — a comparison of a multi property or link path (`any(.tags.name = 'x')`), or one value of the current object — and is aggregated per object in a shape or filter.

```
any(vals: bool) -> bool
```

**Example:**

```edgeql
select any(User.is_admin);
# => true (if at least one admin exists)
```

**SQL equivalent:** `BOOL_OR(...)`

---

### `all`

Returns true if all elements in a set of boolean values are true, and true for an empty set. It takes any boolean expression, as `any` does.

```
all(vals: bool) -> bool
```

**Example:**

```edgeql
select all(User.email_verified);
# => true (only if every user is verified)
```

**SQL equivalent:** `BOOL_AND(...)`

---

## Assertion Functions

Assertion functions are pass-through functions that enforce cardinality constraints at runtime. They do not map to a specific SQL function -- they wrap the expression and validate the result.

### `assert_exists`

Asserts that the expression returns at least one result. Raises an error if the set is empty.

```
assert_exists(expr: any) -> any
```

**Example:**

```edgeql
select assert_exists(
  (select User filter .id = <uuid>$user_id)
);
```

---

### `assert_single`

Asserts that the expression returns at most one result. Raises a `CardinalityViolationError` (SQLSTATE `21000`) when the query runs if the set contains more than one element. Use it to assign a select that the compiler cannot prove returns at most one object to a single link (see [EdgeQL → Insert with Links](edgeql.md#:~:text=Insert%20with%20Links)).

```
assert_single(expr: any) -> any
```

**Example:**

```edgeql
select assert_single(
  (select User filter .email = 'unique@example.com')
);
```

---

## UUID Functions

### `uuid_generate_v4`

Generates a random UUID (version 4).

```
uuid_generate_v4() -> uuid
```

**Example:**

```edgeql
select uuid_generate_v4();
# => 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' (random each time)
```

**SQL equivalent:** `GEN_RANDOM_UUID()`

---

### `uuid_generate_v1mc`

Generates a UUID. In Disc, this maps to the same implementation as `uuid_generate_v4` because PostgreSQL 16 does not provide a built-in v1mc generator.

```
uuid_generate_v1mc() -> uuid
```

**Example:**

```edgeql
select uuid_generate_v1mc();
```

**SQL equivalent:** `GEN_RANDOM_UUID()`

---

### `disc_uuidv7`

Generates a time-ordered UUID (version 7, RFC 9562). The high 48 bits are a millisecond timestamp, so values sort chronologically and keep primary-key index inserts sequential. This is the **default** generator for every object type’s `id` (Disc diverges from Gel’s random v4 here). It’s provided by a bootstrapped stdlib function built on `pgcrypto`, so it works on PostgreSQL 16/17/18 without relying on PG 18’ native `uuidv7()`.

```
disc_uuidv7() -> uuid
```

**Example:**

```edgeql
select disc_uuidv7();
# => '019ef662-b2a4-77a9-a6b3-c1d5c2208af9' (time-ordered)
```

**SQL equivalent:** `disc_uuidv7()` (Disc stdlib function)

---

## Datetime Functions

### `datetime_current`

Returns the current date and time (with time zone).

```
datetime_current() -> datetime
```

**Example:**

```edgeql
select datetime_current();
# => '2026-03-20T14:30:00+00:00'
```

Commonly used as a default value in schema definitions:

```esdl
type User {
  created_at: datetime {
    default := datetime_current();
  };
};
```

**SQL equivalent:** `NOW()`

---

### `datetime_of_transaction`

Returns the timestamp of the current transaction. Unlike `datetime_current()`, this value remains constant for the duration of the transaction.

```
datetime_of_transaction() -> datetime
```

**Example:**

```edgeql
select datetime_of_transaction();
```

**SQL equivalent:** `TRANSACTION_TIMESTAMP()`

---

### `datetime_of_statement`

Returns the timestamp of the current statement. This value remains constant for the duration of a single statement but may change between statements in a transaction.

```
datetime_of_statement() -> datetime
```

**Example:**

```edgeql
select datetime_of_statement();
```

**SQL equivalent:** `STATEMENT_TIMESTAMP()`

---

### `datetime_get`

Extracts a component of a datetime, as a `float64`. The unit is one of Gel’s: `'epochseconds'`, `'century'`, `'day'`, `'decade'`, `'dow'`, `'doy'`, `'hour'`, `'isodow'`, `'isoyear'`, `'microseconds'`, `'millennium'`, `'milliseconds'`, `'minutes'`, `'month'`, `'quarter'`, `'seconds'`, `'week'`, `'year'`. Any other unit (PostgreSQL’s `'epoch'` included) is an `InvalidValueError`, at compile time for a literal and when the query runs otherwise.

```
datetime_get(val: datetime, field: str) -> float64
```

**Example:**

```edgeql
select datetime_get(datetime_current(), 'year');
# => 2026

select datetime_get(.created_at, 'epochseconds');
# => 1789862400
```

**SQL equivalent:** `date_part('year', NOW())`

---

### `duration_get`

Extracts a component of a duration, as a `float64`. A `duration` takes `'hour'`, `'minutes'`, `'seconds'`, `'milliseconds'`, `'microseconds'` and `'totalseconds'`; a `cal::relative_duration` also takes `'millennium'`, `'century'`, `'decade'`, `'year'`, `'quarter'`, `'month'` and `'day'`; a `cal::date_duration` takes those date units and `'totalseconds'`.

```
duration_get(val: duration, field: str) -> float64
```

**Example:**

```edgeql
select Post { age_days := <int64>(duration_get(datetime_current() - .created_at, 'totalseconds') // 86400) };
```

---

### `cal::time_get` and `cal::date_get`

Extract a component of a `cal::local_time` (`'hour'`, `'minutes'`, `'seconds'`, `'milliseconds'`, `'microseconds'`, `'midnightseconds'`) or a `cal::local_date` (`'century'`, `'day'`, `'decade'`, `'dow'`, `'doy'`, `'isodow'`, `'isoyear'`, `'millennium'`, `'month'`, `'quarter'`, `'week'`, `'year'`), as a `float64`.

```edgeql
select cal::time_get(<cal::local_time>'10:30:00', 'minutes');
# => 30

select cal::date_get(<cal::local_date>'2026-09-27', 'doy');
# => 270
```

---

### `cal::duration_normalize_days` and `cal::duration_normalize_hours`

`cal::duration_normalize_days` turns each whole 30 days into a month; `cal::duration_normalize_hours` turns each whole 24 hours into a day. Each returns its argument’s type.

```
cal::duration_normalize_days(val: cal::relative_duration) -> cal::relative_duration
cal::duration_normalize_days(val: cal::date_duration) -> cal::date_duration
cal::duration_normalize_hours(val: cal::relative_duration) -> cal::relative_duration
```

**Example:**

```edgeql
select cal::duration_normalize_days(<cal::date_duration>'45 days');
# => 'P1M15D'

select cal::duration_normalize_hours(<cal::relative_duration>'49 hours 3 minutes');
# => 'P2DT1H3M'
```

**SQL equivalent:** `justify_days(...)` / `justify_hours(...)`

---

### `datetime_truncate`

Truncates a datetime value to the specified precision. Valid fields include `'year'`, `'month'`, `'day'`, `'hour'`, `'minute'`, `'second'`.

```
datetime_truncate(val: datetime, field: str) -> datetime
```

**Example:**

```edgeql
select datetime_truncate(datetime_current(), 'month');
# => '2026-03-01T00:00:00+00:00'
```

**SQL equivalent:** `DATE_TRUNC('month', NOW())`

---

### `to_datetime`

Converts a string or other value to a datetime (timestamp with time zone).

```
to_datetime(val: any, fmt: optional str = {}) -> datetime
to_datetime(local: cal::local_datetime, zone: str) -> datetime
to_datetime(epochseconds: int64 | float64 | decimal) -> datetime
to_datetime(year: int64, month: int64, day: int64, hour: int64, min: int64, sec: float64, timezone: str) -> datetime
```

**Example:**

```edgeql
select to_datetime('2024-01-01');
select to_datetime('2024-01-01T12:00:00Z');
select to_datetime('2024-01-02 03:04:05 +02', 'YYYY-MM-DD HH24:MI:SS TZH');
# => 2024-01-02T01:04:05+00:00
select to_datetime(<cal::local_datetime>'2024-01-02T03:00', 'Europe/Berlin');
# => 2024-01-02T02:00:00+00:00
select to_datetime(1700000000);
# => 2023-11-14T22:13:20+00:00
select to_datetime(2024, 1, 2, 3, 4, 5.5, 'Europe/Berlin');
# => 2024-01-02T02:04:05.5+00:00
```

A format is a PostgreSQL `to_timestamp` pattern and, as in Gel, must include the time zone (`TZH`): without one it is `missing required time zone in format: '…'`, and an input without one is `missing required time zone in input '…'`. The result must fall in years 1 to 9999 (UTC), as in Gel: `to_datetime('10000-01-01 +00', 'YYYY-MM-DD TZH')` is `'std::datetime' value out of range`, as is a format without a year, which parses as year 1 BC.

**SQL equivalent:** `CAST('2024-01-01' AS timestamp with time zone)`

---

### `to_duration`

Converts a string to a duration (interval).

```
to_duration(val: any) -> duration
```

**Example:**

```edgeql
select to_duration('PT1H');
select to_duration('P1DT12H');
```

**SQL equivalent:** `CAST('PT1H' AS interval)`

---

### `cal_to_local_date`

Converts a value to a local date (date without time zone information).

```
cal_to_local_date(val: any, fmt: optional str = {}) -> cal::local_date
cal_to_local_date(dt: datetime, zone: str) -> cal::local_date
cal_to_local_date(year: int64, month: int64, day: int64) -> cal::local_date
```

**Example:**

```edgeql
select cal::to_local_date('2024-01-01');
select cal::to_local_date('02/01/2024', 'DD/MM/YYYY');                  # 2024-01-02
select cal::to_local_date(<datetime>'2024-01-02T20:00:00Z', 'Asia/Tokyo'); # 2024-01-03
select cal::to_local_date(2024, 1, 2);
```

A format for any of the `cal::to_local_*` parsers must not name a time zone, as in Gel: `TZH` in it is `unexpected time zone in format: '…'`. It should name a year: the parsed value must fall in years 1 to 9999, and a format without one (`cal::to_local_date('10 5', 'MM DD')`, `cal::to_local_time('10:30', 'HH24:MI')`) parses as year 1 BC, which is `'std::datetime' value out of range`, as in Gel. An empty format is `to_local_date(): "fmt" argument must be a non-empty string` (`to_local_time()` likewise), even for an empty value.

**SQL equivalent:** `CAST('2024-01-01' AS date)`

---

### `cal_to_local_time`

Converts a value to a local time (time without time zone information).

```
cal_to_local_time(val: any, fmt: optional str = {}) -> cal::local_time
cal_to_local_time(dt: datetime, zone: str) -> cal::local_time
cal_to_local_time(hour: int64, min: int64, sec: float64) -> cal::local_time
```

**Example:**

```edgeql
select cal::to_local_time('12:00:00');
select cal::to_local_time('2024 13:02', 'YYYY HH24:MI');                          # 13:02:00
select cal::to_local_time(<datetime>'2024-01-02T20:00:00Z', 'America/New_York'); # 15:00:00
select cal::to_local_time(3, 4, 5.5);
```

A format names a year (`YYYY`), which the time then drops: without one, `cal::to_local_time('10:30', 'HH24:MI')` is `'std::datetime' value out of range`, as in Gel.

**SQL equivalent:** `CAST('12:00:00' AS time without time zone)`

---

### `cal_to_local_datetime`

Converts a value to a local datetime (timestamp without time zone information).

```
cal_to_local_datetime(val: any, fmt: optional str = {}) -> cal::local_datetime
cal_to_local_datetime(dt: datetime, zone: str) -> cal::local_datetime
cal_to_local_datetime(year: int64, month: int64, day: int64, hour: int64, min: int64, sec: float64) -> cal::local_datetime
```

**Example:**

```edgeql
select cal::to_local_datetime('2024-01-01T12:00:00');
select cal::to_local_datetime('2024-01-02 03:04:05', 'YYYY-MM-DD HH24:MI:SS');
select cal::to_local_datetime(<datetime>'2024-01-02T20:00:00Z', 'Europe/Berlin'); # 2024-01-02T21:00:00
select cal::to_local_datetime(2024, 1, 2, 3, 4, 5.5);
```

**SQL equivalent:** `CAST('2024-01-01T12:00:00' AS timestamp without time zone)`

---

## Window Functions

Window functions operate over a partition (window) of rows and are used with the `OVER` clause. These functions cannot be called without a window specification.

### `row_number`

Returns the sequential number of the current row within its partition, starting from 1.

```
row_number() -> int64
```

**Example:**

```edgeql
select User {
  name,
  row_num := row_number() over (order by .name)
};
```

**SQL equivalent:** `ROW_NUMBER() OVER (...)`

---

### `rank`

Returns the rank of the current row within its partition, with gaps for ties.

```
rank() -> int64
```

**Example:**

```edgeql
select Student {
  name,
  score_rank := rank() over (order by .score desc)
};
```

**SQL equivalent:** `RANK() OVER (...)`

---

### `dense_rank`

Returns the rank of the current row within its partition, without gaps for ties.

```
dense_rank() -> int64
```

**Example:**

```edgeql
select Student {
  name,
  score_rank := dense_rank() over (order by .score desc)
};
```

**SQL equivalent:** `DENSE_RANK() OVER (...)`

---

### `ntile`

Distributes the rows in an ordered partition into a specified number of groups (buckets).

```
ntile(n: int64) -> int64
```

**Example:**

```edgeql
select Product {
  name,
  price_quartile := ntile(4) over (order by .price)
};
```

**SQL equivalent:** `NTILE(4) OVER (...)`

---

### `lag`

Returns the value of an expression evaluated at the row that is a given offset before the current row within the partition. Returns default (or null) if no such row exists.

```
lag(expr: any, offset?: int64, default?: any) -> any
```

**Example:**

```edgeql
select Sale {
  date,
  amount,
  prev_amount := lag(.amount, 1) over (order by .date)
};
```

**SQL equivalent:** `LAG(amount, 1) OVER (...)`

---

### `lead`

Returns the value of an expression evaluated at the row that is a given offset after the current row within the partition. Returns default (or null) if no such row exists.

```
lead(expr: any, offset?: int64, default?: any) -> any
```

**Example:**

```edgeql
select Sale {
  date,
  amount,
  next_amount := lead(.amount, 1) over (order by .date)
};
```

**SQL equivalent:** `LEAD(amount, 1) OVER (...)`

---

### `first_value`

Returns the value of an expression evaluated at the first row of the window frame.

```
first_value(expr: any) -> any
```

**Example:**

```edgeql
select Sale {
  date,
  amount,
  first_sale := first_value(.amount) over (order by .date)
};
```

**SQL equivalent:** `FIRST_VALUE(amount) OVER (...)`

---

### `last_value`

Returns the value of an expression evaluated at the last row of the window frame.

```
last_value(expr: any) -> any
```

**Example:**

```edgeql
select Sale {
  date,
  amount,
  last_sale := last_value(.amount) over (order by .date)
};
```

**SQL equivalent:** `LAST_VALUE(amount) OVER (...)`

---

## Bytes Functions

### `bytes_get_bit`

Returns the value of a specific bit (0 or 1) at the given index in a byte string.

```
bytes_get_bit(val: bytes, index: int64) -> int64
```

**Example:**

```edgeql
select bytes_get_bit(b'\xff', 0);
# => 1
```

**SQL equivalent:** `GET_BIT(..., 0)`

---

### `bytes_to_str`

Converts a byte string to a text string using the specified encoding.

```
bytes_to_str(val: bytes, encoding: str) -> str
```

**Example:**

```edgeql
select bytes_to_str(b'hello', 'UTF8');
# => 'hello'
```

**SQL equivalent:** `CONVERT_FROM(..., 'UTF8')`

---

### `base64_encode`

Encodes a byte string as base64 (RFC 4648, standard alphabet, padded, no line breaks — the same form `bytes` takes on the JSON wire).

```
std::base64_encode(data: bytes) -> str
```

**Example:**

```edgeql
select std::base64_encode(<bytes>$blob);
# => 'H4sIAAAAAAAA…'
```

**SQL equivalent:** `std_base64_encode(...)` (Disc stdlib function: `translate(encode(data, 'base64'), E'\n', '')`)

---

### `base64_decode`

Decodes base64 text into a byte string. Whitespace in the input is ignored. This is how `bytes` carried inside a `<json>` variable are turned back into `bytes` (a `<bytes>` cast from JSON is a compile error pointing here):

```
std::base64_decode(data: str) -> bytes
```

**Example:**

```edgeql
with rows := <json>$rows
for item in json_array_unpack(rows)
union (insert GitObject { content := std::base64_decode(<str>item['content']), … });
```

**SQL equivalent:** `std_base64_decode(...)` (Disc stdlib function over `decode(..., 'base64')`)

---

## Range Functions

Range functions operate on range types, which represent a span of values with optional inclusive/exclusive bounds.

### `range`

Creates a range from a lower and upper bound.

```
range(lower: any, upper: any) -> range
```

**Example:**

```edgeql
select range(1, 10);
```

---

### `range_get_lower`

Returns the lower bound of a range.

```
range_get_lower(r: range) -> any
```

**Example:**

```edgeql
select range_get_lower(range(1, 10));
# => 1
```

**SQL equivalent:** `LOWER(int4range(1, 10))`

---

### `range_get_upper`

Returns the upper bound of a range.

```
range_get_upper(r: range) -> any
```

**Example:**

```edgeql
select range_get_upper(range(1, 10));
# => 10
```

**SQL equivalent:** `UPPER(int4range(1, 10))`

---

### `range_is_empty`

Returns true if the range is empty.

```
range_is_empty(r: range) -> bool
```

**Example:**

```edgeql
select range_is_empty(range(1, 1));
# => true
```

**SQL equivalent:** `ISEMPTY(int4range(1, 1))`

---

### `range_unpack`

Unpacks a range into a set of its individual values (for discrete ranges like integer ranges).

```
range_unpack(r: range) -> set of any
```

**Example:**

```edgeql
select range_unpack(range(1, 5));
# => {1, 2, 3, 4}
```

**SQL equivalent:** `generate_series(lower(int4range(1, 5)), upper(int4range(1, 5)) - 1)` — integer ranges only (PostgreSQL has no `unnest(range)`). Usable as a `for` iterator.

---

### `range_is_inclusive_lower`

Returns true if the lower bound of the range is inclusive.

```
range_is_inclusive_lower(r: range) -> bool
```

**Example:**

```edgeql
select range_is_inclusive_lower(range(1, 10));
# => true
```

**SQL equivalent:** `LOWER_INC(int4range(1, 10))`

---

### `range_is_inclusive_upper`

Returns true if the upper bound of the range is inclusive.

```
range_is_inclusive_upper(r: range) -> bool
```

**Example:**

```edgeql
select range_is_inclusive_upper(range(1, 10));
# => false
```

**SQL equivalent:** `UPPER_INC(int4range(1, 10))`

---

### `multirange`

Creates a multirange from one or more ranges.

```
multirange(r: range) -> multirange
```

**Example:**

```edgeql
select multirange(range(1, 5));
```

---

### `overlaps`

Returns true if two ranges overlap.

```
overlaps(r1: range, r2: range) -> bool
```

**Example:**

```edgeql
select overlaps(range(1, 5), range(3, 8));
# => true

select overlaps(range(1, 3), range(5, 8));
# => false
```

**SQL equivalent:** `r1 && r2` (the `&&` overlap operator)

---

### `contains` (range overload)

Returns true if a range contains an element. This is the range overload of the `contains` function.

```
contains(r: range, elem: any) -> bool
```

**Example:**

```edgeql
select contains(range(1, 10), 5);
# => true
```

**SQL equivalent:** `r @> elem` (the `@>` containment operator)

---

## Sequence Functions

Sequence functions interact with PostgreSQL sequences for generating auto-incrementing values.

### `sequence_next`

Returns the next value from a named sequence.

```
sequence_next(name: str) -> int64
```

**Example:**

```edgeql
select sequence_next('my_seq');
# => 1 (then 2, 3, etc.)
```

**SQL equivalent:** `NEXTVAL('my_seq')`

---

### `sequence_reset`

Resets a named sequence to a specified value.

```
sequence_reset(name: str, val: int64) -> int64
```

**Example:**

```edgeql
select sequence_reset('my_seq', 1);
```

**SQL equivalent:** `SETVAL('my_seq', 1)`

---

## Schema Introspection Functions

Schema introspection functions provide runtime access to the database schema. They are resolved at compile time and return JSON representations of schema metadata.

### `schema::types`

Returns a JSON array describing all object types in the schema.

```
schema::types() -> json
```

**Example:**

```edgeql
select schema::types();
```

---

### `schema::get_type`

Returns a JSON object describing a specific type by name.

```
schema::get_type(name: str) -> json
```

**Example:**

```edgeql
select schema::get_type('User');
```

---

### `schema::functions`

Returns a JSON array describing all registered functions.

```
schema::functions() -> json
```

**Example:**

```edgeql
select schema::functions();
```

---

## Full-Text Search Functions

Full-text search functions are part of the `fts` extension (`ext::fts`). They require an `fts::index` to be defined on the target type in your schema.

### `fts::search`

Returns true if a row’s full-text search vector matches the given query string. Typically used in `filter` clauses.

```
fts::search(query: str) -> bool
```

**Example:**

```edgeql
select Article {
  title,
  body
} filter fts::search('database migration');
```

**SQL equivalent:** `fts_vector @@ plainto_tsquery('english', 'database migration')`

The query string is parsed using PostgreSQL’s `plainto_tsquery` with the English language configuration by default.

---

### `fts::rank`

Returns a relevance score for a full-text search query against a row’s search vector. Higher values indicate better matches. Useful for ordering search results.

```
fts::rank(query: str) -> float64
```

**Example:**

```edgeql
select Article {
  title,
  body,
  relevance := fts::rank('database migration')
}
filter fts::search('database migration')
order by fts::rank('database migration') desc;
```

**SQL equivalent:** `ts_rank(fts_vector, plainto_tsquery('english', 'database migration'))`

---

## Function Categories Quick Reference

| Category         | Functions                                                                                                                                                                                                            |
| :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| String           | `len`, `str_lower`, `str_upper`, `str_title`, `str_trim`, `str_ltrim`, `str_rtrim`, `str_repeat`, `str_replace`, `str_split`, `str_starts_with`, `str_ends_with`, `str_pad_start`, `str_pad_end`, `contains`, `find` |
| Regex            | `re_match`, `re_match_all`, `re_replace`, `re_test`                                                                                                                                                                  |
| Math             | `random`, `math_abs`, `math_ceil`, `math_floor`, `round`, `math_sqrt`, `math_pow`, `math_power`, `math_log`, `math_ln`, `math_log10`, `math_log2`, `math_pi`, `math_e`, `math_mean`                                  |
| Aggregate        | `count`, `sum`, `min`, `max`, `avg`, `stddev`, `stddev_pop`, `stddev_samp`, `array_agg`, `any`, `all`                                                                                                                |
| Type Conversion  | `to_str`, `to_int16`, `to_int32`, `to_int64`, `to_float32`, `to_float64`, `to_bigint`, `to_decimal`, `to_bool`, `to_uuid`                                                                                            |
| JSON             | `to_json`, `json_typeof`, `json_get`, `json_array_unpack`, `json_object_unpack`                                                                                                                                      |
| Array            | `array_agg`, `array_unpack`, `array_join`, `array_get`                                                                                                                                                               |
| Set              | `distinct`, `exists`, `enumerate`, `any`, `all`                                                                                                                                                                      |
| Assertion        | `assert_exists`, `assert_single`                                                                                                                                                                                     |
| UUID             | `disc_uuidv7`, `uuid_generate_v4`, `uuid_generate_v1mc`                                                                                                                                                              |
| Datetime         | `datetime_current`, `datetime_of_transaction`, `datetime_of_statement`, `datetime_get`, `duration_get`, `datetime_truncate`, `to_datetime`, `to_duration`                                                                            |
| Calendar         | `cal_to_local_date`, `cal_to_local_time`, `cal_to_local_datetime`, `cal::time_get`, `cal::date_get`, `cal::duration_normalize_days`, `cal::duration_normalize_hours`                                                                                                                                                    |
| Window           | `row_number`, `rank`, `dense_rank`, `ntile`, `lag`, `lead`, `first_value`, `last_value`                                                                                                                              |
| Bytes            | `bytes_get_bit`, `bytes_to_str`, `std::base64_encode`, `std::base64_decode`                                                                                                                                                                                   |
| Range            | `range`, `range_get_lower`, `range_get_upper`, `range_is_empty`, `range_unpack`, `range_is_inclusive_lower`, `range_is_inclusive_upper`, `multirange`, `overlaps`, `contains` (overload)                             |
| Sequence         | `sequence_next`, `sequence_reset`                                                                                                                                                                                    |
| Introspection    | `schema::types`, `schema::get_type`, `schema::functions`                                                                                                                                                             |
| Full-Text Search | `fts::search`, `fts::rank`                                                                                                                                                                                           |
