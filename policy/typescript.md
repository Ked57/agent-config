# TypeScript standards

Apply this policy when editing TypeScript, including TSX, MTS, CTS, and Vue SFC scripts.

## Type safety

- Follow the repository TypeScript configuration; preserve strictness.
- Do not introduce `any`. Use concrete types, generics, unions, type guards, or `unknown` with narrowing.
- Prefer discriminated unions for state with distinct variants.
- Handle discriminated unions and enums exhaustively. A newly added variant must produce a compile-time failure until handled.
- Prefer `satisfies` and `as const` when they improve inference without hiding type errors.
- Avoid broad type assertions. If one is unavoidable, keep it narrow.
- Validate untrusted API, storage, and user data with the existing boundary parser before treating it as a domain type; cover malformed, missing, and unsupported input.
- Treat dictionary and positional array lookups as possibly missing; narrow the result and cover absent keys or out-of-range input.
- Where field presence affects updates or contracts, preserve omitted fields versus explicit `undefined` and test the actual transport, which may erase `undefined`.
- Express shared read-only ownership with `readonly` properties or collections where callers must not mutate; this compile-time constraint can be shallow and does not freeze values or remove mutable aliases.

## Code design

- Use clear names that describe behaviour and domain meaning.
- Keep functions and watchers focused on one responsibility. When branching, nesting, or path count is the problem, follow `complexity-audit`.
- Prefer pure functions for business rules and transformations.
- Separate domain logic from framework, UI, and transport concerns.
- Use dependency injection at I/O boundaries when it materially improves testability; do not add abstraction layers without a concrete benefit.
- Use `async` / `await` for asynchronous control flow; await or return each promise, or attach a deliberate rejection handler to background work. `void` alone does not handle failure. Cover rejection paths and keep errors observable.

## Imports and organisation

- Keep static imports at the top of the module.
- Use dynamic imports only for deliberate lazy loading, bundling boundaries, or a documented dependency-cycle workaround.
- Follow the repository's conventions for `type` versus `interface`, file layout, naming, and constant casing.
- Keep files cohesive. Extract a focused module or composable before a file becomes a catch-all.

## Testing

- Add or update behaviour-focused tests for changed business logic.
- Test externally observable behaviour, not implementation details.
- Use the repository's designated test layer: pure domain/non-DOM composable behaviour belongs in unit tests; UI component behaviour belongs in component tests; critical user journeys belong in end-to-end tests.
- For intentional negative type tests, use a narrowly placed `@ts-expect-error` explaining the expected failure; keep the case minimal and included in typecheck so obsolete suppressions fail. This tests the presence of a diagnostic, not its identity, and does not authorise suppressing production errors.
