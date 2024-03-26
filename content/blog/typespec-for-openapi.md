---
title: Write OpenAPI with TypeSpec
description: Why and how TypeSpec makes API-First a reasonable approach
date: 2024-03-25
tags:
  - TypeSpec
  - OpenAPI
---

TypeSpec test

## Example

```TypeSpec
@maxLength(10)
scalar shortString extends string;

model Foo extends Bar {
  x: shortString;
}

model Page<T> {
  items: T[];
  pageSize: int32;
}
```
