# React + TypeScript

Apply this policy when editing React components, hooks, JSX, or TSX files. Before changing data fetching, state management, forms, or styling, inspect the repository dependencies and nearby feature patterns.

## Component and state design

- Prefer small, declarative function components with typed props.
- Keep rendering, derived values, and event handling in the component. Extract a custom hook, service, or domain module only for a clear boundary or genuine reuse.
- Derive values from props and state during render. Do not store a value in state merely because it can be calculated from existing props or state.
- Put user-initiated work in the event handler or form action that caused it. Do not introduce state plus an Effect solely to react to a click, submit, toggle, or input change.
- Use the repository's established approach for server state, forms, client state, routing, styling, i18n, and component primitives. Do not add a competing library or provider without an explicit requirement.

## Effects are an external-system escape hatch

Do not introduce `useEffect` unless the work synchronises with a system outside React and a more idiomatic local or framework abstraction does not exist.

Do not use an Effect for:

- derived or transformed display data;
- synchronising one piece of React state from another;
- responding to a user event;
- resetting local state that can be modelled with component structure or a `key`;
- routine data fetching when the project has a framework data API, Server Components, TanStack Query, SWR, or an established equivalent.

Valid Effect cases include an unavoidable integration with a browser API, subscription, timer, observer, analytics lifecycle event, or imperative third-party widget.

When an Effect is justified:

1. Keep it narrow and document the external system being synchronised.
2. Use complete dependencies; do not suppress `exhaustive-deps`.
3. Return cleanup for listeners, subscriptions, timers, observers, and imperative integrations when applicable.
4. Extract a named custom hook when the integration is reusable or obscures the component.

## Memoisation and React Compiler

- Inspect the repository for React Compiler support before adding manual memoisation.
- Do not add `useMemo`, `useCallback`, or `React.memo` by default.
- With React Compiler enabled, avoid manual memoisation unless there is a demonstrated semantic or performance reason.
- Without it, memoise only a genuinely expensive calculation or a reference whose stability is required by a measured rendering issue or an existing hook/component contract.
- Do not use memoisation to silence an Effect dependency problem; simplify the control flow or move the work to the correct location first.

## Rendering, accessibility, and tests

- Use stable keys from domain identity, never array indexes for reorderable, insertable, or removable lists.
- Prefer semantic HTML and accessible names. Use real buttons, inputs, labels, landmarks, and native form behaviour before ARIA workarounds.
- Represent relevant loading, empty, error, and success states.
- Test observable user behaviour using the repository's designated React test layer; avoid testing component internals or hook implementation details.
