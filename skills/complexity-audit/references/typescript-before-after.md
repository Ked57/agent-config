# TypeScript complexity shapes

Load this file when reducing a TypeScript or JavaScript hotspot. Keep the repository's naming, error handling, and types.

## Guard clauses

Before (nesting 3, CC 5):

```ts
function submit(form: Form): Result {
  if (form) {
    if (form.valid) {
      if (!form.locked) {
        return persist(form);
      } else {
        return { ok: false, reason: 'locked' };
      }
    } else {
      return { ok: false, reason: 'invalid' };
    }
  } else {
    return { ok: false, reason: 'missing' };
  }
}
```

After (nesting 1, CC 4):

```ts
function submit(form: Form | undefined): Result {
  if (!form) return { ok: false, reason: 'missing' };
  if (!form.valid) return { ok: false, reason: 'invalid' };
  if (form.locked) return { ok: false, reason: 'locked' };
  return persist(form);
}
```

## Dispatch table

Before (CC grows with every kind):

```ts
function labelFor(kind: Kind): string {
  if (kind === 'draft') return 'Draft';
  if (kind === 'review') return 'In review';
  if (kind === 'shipped') return 'Shipped';
  return 'Unknown';
}
```

After (caller CC 2; labels are data):

```ts
const LABELS: Record<Kind, string> = {
  draft: 'Draft',
  review: 'In review',
  shipped: 'Shipped',
};

function labelFor(kind: Kind): string {
  return LABELS[kind] ?? 'Unknown';
}
```

Use polymorphism instead when the arms are non-trivial behaviour that belongs on the type, and the same switch already repeats at two or more call sites.
