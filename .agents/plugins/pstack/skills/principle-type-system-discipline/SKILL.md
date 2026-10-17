---
name: principle-type-system-discipline
description: "Apply when designing types, reviewing a function signature, or writing code in any statically-typed language. Make illegal states unrepresentable, brand semantic primitives, parse external data at boundaries, exhaust variants, derive from authoritative schemas."
disable-model-invocation: true
---

# Type System Discipline

Make the compiler reject impossible states, mismatched primitives, and unhandled variants. Prefer defining errors and special cases out of existence over proliferating handlers. For TypeScript syntax, see the `typescript-best-practices` skill.

- **Brand semantic primitives.** `UserId` and `OrderId` are strings underneath but should not be interchangeable. Give each its own type, such as a branded intersection in TypeScript or a newtype elsewhere. Validate once at creation, trust the type downstream. If two arguments share a primitive type but mean different things, brand them.
- **External data is untyped until parsed.** RPC payloads, JSON, IPC messages, CLI args, config files, environment variables, database rows. Have a parse function at every boundary that turns unstructured input into the typed model. The **boundary-discipline** principle skill says where to put validation.
- **Derive types from authoritative schemas.** When a protocol buffer, OpenAPI spec, GraphQL schema, database migration, design-token file, or another file owns the same concept, derive from it where the dependency direction is permitted. Check package boundaries before consolidating types. Equal fields do not establish shared ownership; an independently owned component input may retain the same shape without an artificial mapper or transformation. For a transport type, "authoritative" means the concrete serialized endpoint boundary, not a broader domain or persistence model. Trace enrichment, persistence-time mutation, and serialization before copying optionality across that boundary. See the **encode-lessons-in-structure** principle skill.
- **Weigh callers before splitting a response type.** Before splitting a public response type by endpoint, check what its callers need and whether the existing name still fits. If one endpoint merely adds a field that others omit, keep a shared type with that field optional unless callers or boundary validation depend on the stronger shape.
