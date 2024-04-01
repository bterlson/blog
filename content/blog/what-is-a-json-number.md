---
title: What even is a JSON Number?
description: An exploration of numbers in JSON and various JSON implementations
date: 2024-04-01
tags:
  - JSON
  - TypeSpec
  - JSON Schema
  - OpenAPI
---

Not a question people generally ponder, and seems fairly straightforward. It's a number, _obviously_! But the question turns out to be somewhat hard to answer, and for API designers especially, the answer is really important to know! So lets explore by diving into the various JSON specifications and implementations. The findings are summarized at the end, so feel free to skip to the bottom if you just want to know the answer and not wade through the exploration.

<h2>Table of contents</h2>

[[toc]]

## Authoritative sources

JSON is defined by two primary standards: [Ecma-404](https://ecma-international.org/wp-content/uploads/ECMA-404_2nd_edition_december_2017.pdf) and [RFC 8259](https://datatracker.ietf.org/doc/html/rfc8259). Both standards are semantically identical, but RFC 8259 provides some additional recommendations for good interoperability. A related standard, [RFC 7493](https://datatracker.ietf.org/doc/html/rfc7493), describes the closely related Internet JSON format, a restricted profile of JSON which adds a bit more teeth to the recommendations found in RFC 8259. Additionally, in the context of API descriptions, [JSON Schema](https://json-schema.org/draft/2020-12/json-schema-core) defines a number data type, which is also normatively referenced by [OpenAPI](https://spec.openapis.org/oas/v3.1.0). Let's look at each of these specifications for clues.

### ECMA-404

> A number is a sequence of decimal digits with no superfluous leading zero. It may have a preceding minus sign (U+002D). It may have a fractional part prefixed by a decimal point (U+002E). It may have an exponent, prefixed by e (U+0065) or E (U+0045) and optionally + (U+002B) or – (U+002D)

So, a JSON number is a sequence of digits with an optional sign, fractional part, and exponent. The description is purely syntactical.

### RFC 8259

This specification provides an equivalent ABNF grammar to the railroad diagrams provided by ECMA-404. It also explicitly allows implementations to set limits on the range and precision of numbers accepted[^1]. It goes on to note:

[^1]: This additional restriction might seem to violate ECMA-404 at first glance, but it's really just acknowledging the reality that implementations are free to set such limits. If this weren't the case, no JSON parser could be standards compliant since they have to run in reality where hardware and software constraints exist.

> Since software that implements IEEE 754 binary64 (double precision) numbers is generally available and widely used, good interoperability can be achieved by implementations that expect no more precision or range than these provide

This is pointing out that some JSON implementations use doubles to store JSON number values. The implementation found in browsers and used by billions of people around the world is one such implementation. So a JSON number will be interoperable if its range and precision fit within a double.

### RFC 7493

This specification makes RFC 8259's informative note a normative SHOULD NOT:

> I-JSON messages SHOULD NOT include numbers that express greater magnitude or precision than an IEEE 754 double precision number provides

It goes on to recommend that if you need greater range or precision, that you should encode the number as a string.

### JSON Schema &amp; OpenAPI

JSON Schema describes a number as:

> An arbitrary-precision, base-10 decimal number value, from the JSON "number" value

JSON Schema and OpenAPI also define the concept of an integer. JSON schema defines an integer in terms of its value, as a number with a zero fractional part. It also notes that integer values SHOULD NOT be encoded with a fractional part. OpenAPI defines an integer in terms of its syntax, as a JSON number without a fractional part or exponent part.

## JSON numbers in practice

RFC 8259 raises the important point that ultimately implementations decide what a JSON number is. Certainly there are limits to range and precision in practice, but what are they? We know that at least one extremely widely deployed implementation is limited to double precision. Are there other interoperability concerns to consider? Let's investigate by going down two parallel tracks: JSON parsers and serializers across some common languages, and code generators in the OpenAPI ecosystem.

### Language implementations

Language implementations ultimately decide what a JSON number is, so let's look at a few examples and check for common patterns. For languages which have configurable serialization/deserialization, only the default behavior is covered.

#### JavaScript

JavaScript's built-in JSON implementation only works with the built-in `Number` type, so all values are limited to the range and precision of a double. Serialization of `BigInt` is not supported by default. JavaScript also makes it impossible to preserve a numeric literal exactly when round-tripping, e.g. integers-as-decimals like `1.0` will be put back on the wire as `1`. There is a [language proposal](https://github.com/tc39/proposal-json-parse-with-source) to allow fixing both of these issues without swapping out the entire parser.

#### Python 3.8

Integers, decimals, and exponentials are treated differently. Integers can round trip as JSON numbers within the range of -10<sup>4299</sup> to 10<sup>4299</sup>[^2], while decimals and exponentials use doubles and so are limited to double range and precision. Integers outside the range an `int` can be serialized to result in a `ValueError`. Exponentials and decimals outside the range of doubles result in `inf`. When parsing then serializing exponentials, the exponential formatting is lost.

[^2]: This limit used to be much higher, but it was found to be a DoS vector, so more recent versions of python limited the string length of an `int` to a paltry 4300 digits. This can be configured to a more reasonable value by calling `sys.set_int_max_str_digits` or setting the `PYTHONINTMAXSTRDIGITS` environment variable.

#### C# (.NET 8, System.Text.JSON)

C#'s `System.Text.JSON` library is the recommended way to handle JSON data these days, though `Newtonsoft.JSON` is also commonly used. We examine the behavior of the former, the latter likely differs.

C# supports deserializing into appropriate data types through the use of `TryGet*` APIs. Using this API, it is possible to deserialize integer types losslessly up to `int64` and somewhat larger integers into a `decimal`. `decimal` can also be used to represent decimal values, potentially with precision loss. If you know the schema in advance, you can add support for deserializing into other data types, like `BigInteger`.

#### Java (JDK 11+, Jackson)

Java typically uses the `Jackson` library to handle JSON serialization and deserialization. `Jackson` allows serialization and deserialization into any Java numeric type, including `BigDecimal`, allowing it to represent numeric literals of any range and precision without precision loss.

#### Rust (serde)

Rust's `serde_json` crate is commonly used for JSON serialization and deserialization. It supports deserialization of integer values that fit within the range of an `i64`/`u64`. It also supports deserialization of integer and decimal values that fit within the range of an `f64`, though doing so may result in precision loss. Integers and decimals outside the range of an `f64` result in an error. Exponentials are always deserialized as doubles. However, `serde` has a `arbitrary_precision` configuration flag that can be used to round-trip arbitrary numeric values without precision loss assuming they are not deserialized in a lossy fashion. Support for deseralizing into other data types can be added with some additional code, but requires knowing the schema of the data.

#### Go

Go's `encoding/json` library is capable of dynamically unmarshalling JSON number literals using the`float64` type. If you know the schema in advance, you can parse known integers into an appropriate integer type up to `int64`, and parse decimals into a `float32` type as appropriate. Support for unmarshalling e.g. decimal types or big integers can be added with some additional code, but also requires knowing the schema of the data.

#### Summary

To summarize the behavior of the various implementations, we can examine their behavior with the following values:

<style>
  #literal-table tr td:nth-child(1), #literal-table tr th:nth-child(1) {
    text-align: right;
  }
</style>

<div id="literal-table">

| Number literal        | Description                                            |
| --------------------- | ------------------------------------------------------ |
| 10                    | Small integer                                          |
| 1000000000            | Medium integer: beyond int32 range, within int64 range |
| 10000000000000001     | Large integer: beyond double range, within int64 range |
| 100000000000000000001 | Huge integer: beyond the range of an int64             |
| 1[309 zeros]          | Ridonculous integer: beyond the range of a decimal128  |
| 10.0                  | Low-precision decimal                                  |
| 10000000000000001.1   | High-precision decimal: precision > double             |
| 1.[34 ones]           | Ridonculous-precision decimal: precision > decimal128  |
| 1E2                   | Small expontential                                     |
| 1E309                 | Large exponential: beyond the range of a float         |

</div>

The following table shows the data type used to represent the literal in each language. Cells colored with grey are errors. Cells colored with red are non-errors with precision loss. Only the default serialization behavior is covered here. It may be possible to code defensively against these kinds of errors by configuring the serializer or through other mechanisms. Additionally, the test code I used attempts to use a dynamic/schemaless parsing path if it is available. For some languages, knowing the schema in advance can result in better behavior. The test code can be found in the appendix.

<style>
  #lrt tr td:nth-child(1), #lrt tr th:nth-child(1) {
    text-align: right;
  }

  #lrt tr:nth-child(3) td:nth-child(2),
  #lrt tr:nth-child(4) td:nth-child(2),
  #lrt tr:nth-child(5) td:nth-child(2),
  #lrt tr:nth-child(7) td:nth-child(2),
  #lrt tr:nth-child(8) td:nth-child(2),
  #lrt tr:nth-child(10) td:nth-child(2),

  #lrt tr:nth-child(8) td:nth-child(3),

  #lrt tr:nth-child(7) td:nth-child(4),
  #lrt tr:nth-child(8) td:nth-child(4),
  #lrt tr:nth-child(10) td:nth-child(4),

  #lrt tr:nth-child(3) td:nth-child(6),
  #lrt tr:nth-child(4) td:nth-child(6),
  #lrt tr:nth-child(5) td:nth-child(6),
  #lrt tr:nth-child(7) td:nth-child(6),
  #lrt tr:nth-child(8) td:nth-child(6),

  #lrt tr:nth-child(4) td:nth-child(7),
  #lrt tr:nth-child(7) td:nth-child(7),
  #lrt tr:nth-child(8) td:nth-child(7)
  {
    background-color: #f99;
  }

  #lrt tr:nth-child(5) td:nth-child(3),
  #lrt tr:nth-child(10) td:nth-child(3),
  
  #lrt tr:nth-child(5) td:nth-child(6),
  #lrt tr:nth-child(10) td:nth-child(6),

  #lrt tr:nth-child(5) td:nth-child(7),
  #lrt tr:nth-child(10) td:nth-child(7)
  {
    background-color: #ccc;
  }
</style>

<div id="lrt">

| Literal                       | JavaScript | C#      | Python | Java       | Go      | Rust  |
| ----------------------------- | ---------- | ------- | ------ | ---------- | ------- | ----- |
| Small integer                 | Number     | int16   | int    | int        | float64 | i8    |
| Medium integer                | Number     | int64   | int    | long       | float64 | i64   |
| Large integer                 | Number     | int64   | int    | long       | float64 | i64   |
| Huge integer                  | Number     | decimal | int    | BigInteger | float64 | f64   |
| Ridonculous integer           | Number     | error   | int    | BigInteger | error   | error |
| Low-precision decimal         | Number     | decimal | double | float      | float64 | f64   |
| High-precision decimal        | Number     | decimal | double | BigDecimal | float64 | f64   |
| Ridonculous-precision decimal | Number     | decimal | double | BigDecimal | float64 | f64   |
| Small exponential             | Number     | decimal | double | float      | float64 | f64   |
| Large exponential             | Number     | error   | double | BigDecimal | error   | error |

</div>

Notes:

- **C#**: The test code attempts to deserialize into the smallest supported int `int16`, then `int64`, then `decimal`. No attempt is made to deserialize into a `double` at this point, since it would only have the value of `+/- Infinity`. Also note that `decimal` is not an IEEE `decimal128` - the former has 28-29 significant digits, whereas `decimal128` has 34.
- **Rust**: The type in this column represents the smallest possible type the value will deserialize into without error. If you know the schema in advance, you can make trivially make the huge integer case an error to avoid precision loss.
- **Go**: You can serialize into integer types if you know the schema of the data and can ask the unmarshaller to give you an int64. The table represents the best you can do if you don't know the schema in advance. If you know the schema, you can handle the large integer case without precision loss, and also make the huge integer case an error.

### OpenAPI code generators

In the context of JSON APIs, an argument could be made that OpenAPI and its ecosystem of code generators matter as much as the parsers found in various implementations. Even if a language's JSON parser is capable of parsing a number literal of a particular size, it's possible OpenAPI's signatures could be more or less restrictive, especially for strongly typed languages.

In order to understand how the various languages behave, we will test with numeric types and formats defined in the OpenAPI 3 spec itself, as well as the numeric formats defined in the [OpenAPI Format Registry](https://spec.openapis.org/registry/format/):

| Type    | Format     | Description                                                      |
| ------- | ---------- | ---------------------------------------------------------------- |
| number  |            | Arbitrary-precision, base-10 decimal number value                |
| integer |            | JSON number without a fraction or exponent part                  |
| number  | float      | Single precision floating point number                           |
| number  | double     | Double precision floating point number                           |
| number  | decimal    | Fixed point decimal number of unspecified precision and range    |
| number  | decimal128 | Decimal floating-point number with 34 significant decimal digits |
| integer | int8       | Signed 8-bit integer                                             |
| integer | uint8      | Unsigned 8-bit integer                                           |
| integer | int16      | Signed 16-bit integer                                            |
| integer | int32      | Signed 32-bit integer                                            |
| integer | int64      | Signed 64-bit integer                                            |

Unsigned ints other than `uint8` are not defined in either OpenAPI or the format registry. `double-int` was recently added[^3] and is unlikely to be supported anywhere.

[^3]: The [TypeSpec](https://typespec.io) team proposed adding double-int to the format registry to represent an integer that can fit as a double, which would eventually serve as the output target for `safeint`. For reasons of compatibility with the current ecosystem, TypeSpec continues to emit `safeint` with the `int64` format.

The table below summarizes the output for each language using the [OpenAPI-Generator](https://openapi-generator.tech/) code generators. Cells higlighted in red show cases where the generated code creates a situation where either precision loss or an error may occur when providing certain values in OpenAPI's spec-defined range and precision.

<style>
#result-table tr:nth-child(1) td:nth-child(2),
#result-table tr:nth-child(2) td:nth-child(2),
#result-table tr:nth-child(8) td:nth-child(2),
#result-table tr:nth-child(11) td:nth-child(2),
#result-table tr:nth-child(12) td:nth-child(2),

#result-table tr:nth-child(1) td:nth-child(3),
#result-table tr:nth-child(2) td:nth-child(3),
#result-table tr:nth-child(7) td:nth-child(3),
#result-table tr:nth-child(11) td:nth-child(3),

#result-table tr:nth-child(1) td:nth-child(4),
#result-table tr:nth-child(12) td:nth-child(4),
#result-table tr:nth-child(11) td:nth-child(4),
#result-table tr:nth-child(12) td:nth-child(4),

#result-table tr:nth-child(2) td:nth-child(5),
#result-table tr:nth-child(7) td:nth-child(5),

#result-table tr:nth-child(1) td:nth-child(6),
#result-table tr:nth-child(2) td:nth-child(6),
#result-table tr:nth-child(7) td:nth-child(6),
#result-table tr:nth-child(11) td:nth-child(6),
#result-table tr:nth-child(12) td:nth-child(6),

#result-table tr:nth-child(1) td:nth-child(7),
#result-table tr:nth-child(2) td:nth-child(7),
#result-table tr:nth-child(7) td:nth-child(7),
#result-table tr:nth-child(11) td:nth-child(7),
#result-table tr:nth-child(12) td:nth-child(7)
{
  background-color: #f99;
}
</style>

<div id="result-table">

| OpenAPI    | JavaScript | C#         | Python     | Java       | Go      | Rust |
| ---------- | ---------- | ---------- | ---------- | ---------- | ------- | ---- |
| number     | number     | decimal128 | int, float | BigDecimal | float32 | f32  |
| integer    | number     | int32      | int        | Integer    | int32   | i32  |
| int8       | number     | int32      | int        | Integer    | int32   | i32  |
| uint8      | number     | int32      | int        | Integer    | int32   | i32  |
| int16      | number     | int32      | int        | Integer    | int32   | i32  |
| int32      | number     | int32      | int        | Integer    | int32   | i32  |
| double-int | number     | int32      | int        | Integer    | int32   | i32  |
| int64      | number     | int64      | int        | Long       | int64   | i64  |
| single     | number     | float      | int, float | Float      | float32 | f32  |
| double     | number     | double     | int, float | Double     | float64 | f64  |
| decimal    | number     | decimal128 | int, float | BigDecimal | float32 | f32  |
| decimal128 | number     | decimal128 | int, float | BigDecimal | float32 | f32  |

</div>

From this we can see that the OpenAPI-generator suite considers an `integer` to be an int32, despite the spec suggesting it has arbitrary range. As such, when using these tools, there seems to be no way to define an arbitrary-length integer across all languages that have a corresponding data type. Moreover, `number` is often understood as a 32-bit `float` despite the spec suggesting it has arbitrary range and precision.

## Summary of findings

Let's answer the question then: what is a JSON number?

- According to the authoritative specs, a numeric literal of any length and precision.
- According to an interoperable profile of JSON, a numeric literal with the length and precision of a double.
- According to various JSON implementations, a numeric literal with constraints that differ wildly depending on the implementation.
- According to OpenAPI, either:
  - An integer of any length
  - A decimal value of any length and precision
- According to OpenAPI code generators,
  - Without a format, either:
    - For `number`, some floating point representation as small as float32
    - For `integer`, an int32
  - With a format, either:
    - the closest data type approximating the specified format in that language
    - `int32` or its closest approximation if the format is not supported.

We have also confirmed that interoperability of numbers outside the range of a double is spotty. All implementations tested can transact numbers inside the double range safely. All implementations except JavaScript can transact integer literals within the range of an `int64`[^4] (though go requires knowing the schema in advance).

[^4]: This likely explains my observation that folks don't tend to worry much when putting an `int64` on the wire. Poor JavaScript :(

For those using OpenAPI, we can infer some best practices for defining APIs that use numbers:

- Always specify a format in OpenAPI. Neither `integer` or `number` is likely to do what you want.
- Avoid `double-int`. It's not supported and results in potential errors or data loss in many languages.
- Avoid `decimal` and `decimal128`. They are also not widely supported.
- Avoid `int64` with a `number` type if you have JavaScript consumers. Use with the `string` type instead.

If you're using TypeSpec, this advice can be summed up as:

- Avoid using `decimal`, `decimal128`, `integer`, and `numeric` types.
- If you use `int64` and you have JavaScript consumers, encode it as a string via `@encode("int64", string)`.

Finally, due to some languages handling numeric literals with exponential and decimal parts differently, implementations should preserve the format when round tripping (e.g. `10.0` should be put back as `10.0`).

## Appendix: Test Code

This code is garbage, LLMs were heavily involved in their creation. The output needs some interpretation. Feel free to [suggest improvements on GitHub](https://github.com/bterlson/blog/blob/main/content/blog/what-is-a-json-number.md).

### JavaScript

```js
const jsonValues = [
	"10",
	"1000000000",
	"10000000000000001",
	"100000000000000000001",
	"1" + "0".repeat(309),
	"10.0",
	"10000000000000001.1",
	"1.1111111111111111111111111111111111",
	"1E2",
	"1E309",
];

for (const jsonValue of jsonValues) {
	console.log(`Testing JSON value: ${jsonValue}`);

	try {
		// Deserialize the JSON value
		const deserialized = JSON.parse(jsonValue);
		if (String(deserialized) !== jsonValue) {
			console.log("precision loss detected", jsonValue, deserialized);
		}
		const serialized = JSON.stringify(deserialized);
		if (jsonValue !== serialized) {
			console.log("round-trip error detected", jsonValue, serialized);
		}
	} catch (error) {
		console.log(`Deserialization error: ${error.message}`);
	}

	console.log();
}
```

### C#

```csharp
using System;
using System.Text.Json;

class Program
{
    static void Main()
    {
        string[] jsonValues = {
            "10",
            "1000000000",
            "10000000000000001",
            "100000000000000000001",
            "1" + new string('0', 309),
            "10.0",
            "10000000000000001.1",
            "1.1111111111111111111111111111111111",
            "1E2",
            "1E309",
        };

        foreach (string jsonValue in jsonValues)
        {
            Console.WriteLine($"Testing JSON value: {jsonValue}");

            try
            {
                // Deserialize the JSON value
                JsonElement deserialized = JsonSerializer.Deserialize<JsonElement>(jsonValue);

                // Check the deserialized type and precision loss
                switch (deserialized.ValueKind)
                {
                    case JsonValueKind.Number:
						if (deserialized.TryGetInt16(out short smallValue))
                        {
                            Console.WriteLine("Deserialized as: short");
                        }
                        else if (deserialized.TryGetInt64(out long longValue))
                        {
                            Console.WriteLine("Deserialized as: long");
                        }
                        else if (deserialized.TryGetDecimal(out decimal decimalValue))
                        {
                            Console.WriteLine("Deserialized as: decimal");
                            string deserializedString = decimalValue.ToString("G29");
                            if (deserializedString != jsonValue)
                            {
                                Console.WriteLine("Precision loss detected!");
                                Console.WriteLine($"Original value: {jsonValue}");
                                Console.WriteLine($"Deserialized value: {deserializedString}");
                            }
                        }
                        else
                        {
                            Console.WriteLine("Deserialized as: unknown number");
                        }
                        break;
                    default:
                        Console.WriteLine($"Deserialized as: {deserialized.ValueKind}");
                        break;
                }

                // Serialize the value back to JSON
                string serialized = JsonSerializer.Serialize(deserialized);

                // Check if the serialized value matches the original JSON value
                if (serialized != jsonValue)
                {
                    Console.WriteLine("Round-tripping error detected!");
                    Console.WriteLine($"Original: {jsonValue}");
                    Console.WriteLine($"Serialized: {serialized}");
                }
            }
            catch (JsonException ex)
            {
                Console.WriteLine($"Deserialization error: {ex.Message}");
            }

            Console.WriteLine();
        }
    }
}
```

### Python (3.8)

```python
import json
import decimal

def test_json_number(number_literal):
    print(f"Testing number literal: {number_literal}")

    # Deserialize the JSON number
    deserialized = json.loads(number_literal)

    # Check for precision loss during deserialization
    if str(deserialized) != number_literal:
        print("  Precision loss during deserialization")
    else:
        print("  No precision loss during deserialization")

    # Serialize the deserialized number back to JSON
    serialized = json.dumps(deserialized)

    # Check for round-tripping errors
    if serialized != number_literal:
        print("  Round-tripping error")
    else:
        print("  No round-tripping error")

    print()

# Test the JSON number literals
test_json_number("10")
test_json_number("1000000000")
test_json_number("10000000000000001")
test_json_number("100000000000000000001")
test_json_number("1" + "0" * 4301)
test_json_number("10.0")
test_json_number("10000000000000001.1")
test_json_number("1." + "1" * 34)
test_json_number("1E2")
test_json_number("1E309")
```

### Java (JDK 21, Jackson)

```java
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

public class NumberTest {
    private static final String[] testCases = {
        "10",
        "1000000000",
        "10000000000000001",
        "100000000000000000000",
        "1" + "0".repeat(309),
        "10.0",
        "10000000000000001.1",
        "1.1111111111111111111111111111111111",
        "1E2",
        "1E309"
    };

    public static void main(String[] args) {
        ObjectMapper objectMapper = new ObjectMapper();

        for (String testCase : testCases) {
            System.out.println("Testing JSON value: " + testCase);

            try {
                // Parse the JSON value
                JsonNode jsonNode = objectMapper.readTree(testCase);

                // Check the deserialized type and precision loss
                if (jsonNode.isInt()) {
                    System.out.println("Deserialized as: int");
                } else if (jsonNode.isLong()) {
                    System.out.println("Deserialized as: long");
                } else if (jsonNode.isBigInteger()) {
                    System.out.println("Deserialized as: BigInteger");
                    String deserializedString = jsonNode.bigIntegerValue().toString();
                    if (!deserializedString.equals(testCase)) {
                        System.out.println("Precision loss detected!");
                        System.out.println("Original value: " + testCase);
                        System.out.println("Deserialized value: " + deserializedString);
                    }
                } else if (jsonNode.isDouble()) {
                    System.out.println("Deserialized as: double");
                    String deserializedString = jsonNode.doubleValue() + "";
                    if (!deserializedString.equals(testCase)) {
                        System.out.println("Precision loss detected!");
                        System.out.println("Original value: " + testCase);
                        System.out.println("Deserialized value: " + deserializedString);
                    }
                } else if (jsonNode.isDecimal()) {
                    System.out.println("Deserialized as: BigDecimal");
                    String deserializedString = jsonNode.decimalValue().toString();
                    if (!deserializedString.equals(testCase)) {
                        System.out.println("Precision loss detected!");
                        System.out.println("Original value: " + testCase);
                        System.out.println("Deserialized value: " + deserializedString);
                    }
                } else {
                    System.out.println("Deserialized as: " + jsonNode.getNodeType());
                }

                // Serialize the value back to JSON
                String serialized = objectMapper.writeValueAsString(jsonNode);

                // Check if the serialized value matches the original JSON value
                if (!serialized.equals(testCase)) {
                    System.out.println("Round-tripping error detected!");
                    System.out.println("Original: " + testCase);
                    System.out.println("Serialized: " + serialized);
                }
            } catch (Exception e) {
                System.out.println("Deserialization error: " + e.getMessage());
            }

            System.out.println();
        }
    }
}
```

### Rust

```rust
use serde_json::Value;

fn main() {
    let json_values = vec![
        "10",
        "1000000000",
        "10000000000000001",
        "100000000000000000001",
        "1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
        "10.0",
        "10000000000000001.1",
        "1.1111111111111111111111111111111111",
        "1E2",
        "1E309",
    ];

    for json_value in json_values {
        println!("Testing JSON value: {}", json_value);

        // Deserialize the JSON value
        let deserialized: Result<Value, _> = serde_json::from_str(json_value);

        match deserialized {
            Ok(value) => {
                // Check the deserialized type and precision loss
                match &value {
                    Value::Number(num) => {
                        if num.is_i64() {
                            println!("Deserialized as: i64");
                        } else if num.is_u64() {
                            println!("Deserialized as: u64");
                        } else if num.is_f64() {
                            println!("Deserialized as: f64");
                            let deserialized_value = num.as_f64().unwrap().to_string();
                            if deserialized_value != json_value {
                                println!("Precision loss detected!");
                                println!("Original value: {}", json_value);
                                println!("Deserialized value: {}", deserialized_value);
                            }
                        }
                    }
                    _ => {
                        println!("Deserialized as: {:?}", value);
                    }
                }

                // Serialize the value back to JSON
                let serialized = serde_json::to_string(&value).unwrap();

                // Check if the serialized value matches the original JSON value
                if serialized != json_value {
                    println!("Round-tripping error detected!");
                    println!("Original: {}", json_value);
                    println!("Serialized: {}", serialized);
                }
            }
            Err(e) => {
                println!("Deserialization error: {}", e);
            }
        }

        println!();
    }
}
```

### Go

This code demonstrates the default behavior:

```go
package main

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

func main() {
	testCases := []string{
		"10",
		"1000000000",
		"10000000000000001",
		"100000000000000000000",
		"1" + strings.Repeat("0", 309),
		"10.0",
		"10000000000000001.1",
		"1.1111111111111111111111111111111111",
		"1E2",
		"1E309",
	}

	for _, testCase := range testCases {
		fmt.Printf("Testing JSON value: %s\n", testCase)

		// Unmarshal the JSON value into a float64
		var value float64
		err := json.Unmarshal([]byte(testCase), &value)
		if err != nil {
			fmt.Printf("Deserialization error: %v\n", err)
			fmt.Println()
			continue
		}

		fmt.Println("Deserialized as: float64")

		// Check for precision loss
		deserializedString := strconv.FormatFloat(value, 'g', -1, 64)
		if deserializedString != testCase {
			fmt.Println("Precision loss detected!")
			fmt.Printf("Original value: %s\n", testCase)
			fmt.Printf("Deserialized value: %s\n", deserializedString)
		}

		// Serialize the value back to JSON
		serialized, err := json.Marshal(value)
		if err != nil {
			fmt.Printf("Serialization error: %v\n", err)
			fmt.Println()
			continue
		}

		// Check if the serialized value matches the original JSON value
		if string(serialized) != testCase {
			fmt.Println("Round-tripping error detected!")
			fmt.Printf("Original: %s\n", testCase)
			fmt.Printf("Serialized: %s\n", string(serialized))
		}

		fmt.Println()
	}
}
```

This code demonstrates deserializing into a struct of a known shape:

```go
package main

import (
	"encoding/json"
	"fmt"
	"math/big"
	"strconv"
	"strings"
)

type TestCase struct {
	Name  string  `json:"name"`
	Int8  int8    `json:"int8,omitempty"`
	Int16 int16   `json:"int16,omitempty"`
	Int32 int32   `json:"int32,omitempty"`
	Int64 int64   `json:"int64,omitempty"`
	Float float64 `json:"float,omitempty"`
}

func main() {
	testCases := []string{
		`{"name": "Small integer", "int8": 10}`,
		`{"name": "Medium integer", "int32": 1000000000}`,
		`{"name": "Large integer", "int64": 10000000000000001}`,
		`{"name": "Huge integer", "int64": 100000000000000000001}`,
		`{"name": "Ridonculous integer", "int64": 1` + strings.Repeat("0", 309) + `}`,
		`{"name": "Low-precision decimal", "float": 10.0}`,
		`{"name": "High-precision decimal", "float": 10000000000000001.1}`,
		`{"name": "Ridonculous-precision decimal", "float": 1.1111111111111111111111111111111111}`,
		`{"name": "Small exponential", "float": 1E2}`,
		`{"name": "Large exponential", "float": 1E309}`,
	}

	for _, testCase := range testCases {
		var tc TestCase
		err := json.Unmarshal([]byte(testCase), &tc)
		if err != nil {
			fmt.Printf("Deserialization error: %v\n", err)
			fmt.Println()
			continue
		}

		fmt.Printf("Testing: %s\n", tc.Name)

		// Check the deserialized type and precision loss
		switch {
		case tc.Int8 != 0:
			fmt.Println("Deserialized as: int8")
		case tc.Int16 != 0:
			fmt.Println("Deserialized as: int16")
		case tc.Int32 != 0:
			fmt.Println("Deserialized as: int32")
		case tc.Int64 != 0:
			fmt.Println("Deserialized as: int64")
			if tc.Name == "Ridonculous integer" {
				bigInt := new(big.Int)
				bigInt.SetString(strconv.FormatInt(tc.Int64, 10), 10)
				if bigInt.String() != strconv.FormatInt(tc.Int64, 10) {
					fmt.Println("Precision loss detected!")
					fmt.Printf("Original value: %s\n", strconv.FormatInt(tc.Int64, 10))
					fmt.Printf("Deserialized value: %s\n", bigInt.String())
				}
			}
		default:
			fmt.Println("Deserialized as: float64")
			deserializedString := strconv.FormatFloat(tc.Float, 'g', -1, 64)
			if deserializedString != strconv.FormatFloat(tc.Float, 'f', -1, 64) {
				fmt.Println("Precision loss detected!")
				fmt.Printf("Original value: %s\n", strconv.FormatFloat(tc.Float, 'f', -1, 64))
				fmt.Printf("Deserialized value: %s\n", deserializedString)
			}
		}

		// Serialize the value back to JSON
		serialized, err := json.Marshal(tc)
		if err != nil {
			fmt.Printf("Serialization error: %v\n", err)
			fmt.Println()
			continue
		}

		// Check if the serialized value matches the original JSON value
		var originalTC TestCase
		json.Unmarshal([]byte(testCase), &originalTC)
		var serializedTC TestCase
		json.Unmarshal(serialized, &serializedTC)

		if originalTC != serializedTC {
			fmt.Println("Round-tripping error detected!")
			fmt.Printf("Original: %+v\n", originalTC)
			fmt.Printf("Serialized: %+v\n", serializedTC)
		}

		fmt.Println()
	}
}
```
