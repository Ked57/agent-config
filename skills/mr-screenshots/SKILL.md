---
name: mr-screenshots
description: >-
  Put before/after screenshots of the visible changes in a merge or pull request
  description. Use when opening or updating an MR/PR whose diff changes a
  user-facing UI (browser page, component, style, native app screen). Not for
  backend, API, CLI, library, or documentation-only changes.
---

# MR screenshots

A reviewer should see what changed without checking out the branch. The screenshots are
proof of the result, so they come from the real code on each side, not from a mock-up.

## 1. Pick what to show

List each **visible change**: one screen, component, or state that looks or behaves
differently. Group by what the reviewer sees, not by file: three files that restyle one
dialog are one change, and one shared component that changes five screens is one change
shown on its most representative screen.

For each change choose one shot:

- **Before/after pair** for a modified UI. Same viewport, data, scroll position, and state
  on both sides, so the only difference is the change.
- **After only** for a new screen or state; **before only** for a removed one.
- **Key states** (closed/open, valid/error) when the change is an interaction. Use a short
  video (`.webm`/`.mp4`) only when the motion itself is the change.
- The **viewport where the change shows**. Add a second viewport only when the change
  behaves differently there (a layout fix at a breakpoint).

Crop to the changed region with enough context to locate it on the page; a full page only
when the layout is the change.

No visible change (a refactor that must look identical) needs no screenshots: write one line
saying so and how it was checked.

## 2. Capture

- **After** comes from the branch's running app. Reuse `manual-qa` screenshots when they
  match the shot list, and drive that app with `agent-browser` (via
  `~/.agents/skills/agent-browser/SKILL.md`).
- **Before** is captured from the merge base, not from that running app. `git worktree
  add` a checkout of the merge base in a temporary directory, install its dependencies,
  serve that checkout with the same fixture env on a free port, and capture there with
  the same steps. Before shooting, check that the changed region shows the base UI; if
  it shows the change, you are on the branch build. Remove the worktree afterwards.
- When a side cannot be served, mount the real page or component from that checkout in
  the project's component-test runner (Cypress component testing, Playwright CT,
  Storybook) with the same mock data on both sides. Keep that capture spec out of the
  commit unless it is a real regression test. If the base still cannot be captured, put
  the shot under **Not captured** with the reason instead of omitting it or reusing the
  after image.
- Use fixture or mock data only. No real customer data, credentials, tokens, or internal
  URLs in an image: uploads are reachable by anyone holding the link.
- Name files `before-<shot>.png` / `after-<shot>.png`, and keep them outside the repository.

## 3. Upload and write

GitLab: upload each file to the project and use the returned `markdown`:

```bash
glab api --method POST projects/:id/uploads --form file=@/abs/path/after-panel.png
```

GitHub has no CLI image upload: write the section with the local file paths, and tell the
user which files to drag into the PR description.

Put the section in the MR **description**, not a comment, and update it when the visible
result changes. Write it in the description's language:

```markdown
## Screenshots

<How it was captured: running app or component mount, viewport, data used.>

| Before (`main`) | After |
| --- | --- |
| ![before-panel](/uploads/…/before-panel.png) | ![after-panel](/uploads/…/after-panel.png) |

<One or two sentences: what to look at, and what is different.>
```

With several changes, give each a `###` heading naming the screen or state, then its
table and sentence.

**Large MRs.** Show at most four shots inline: the ones that carry the MR's main change.
Put the rest in a collapsed block per screen, so nothing is dropped and the description
stays readable:

```markdown
<details><summary>Volume settings (3 shots)</summary>

…same heading/table/sentence layout…

</details>
```

Every visible change from step 1 ends up either shown or under **Not captured** with the
reason (needs a host app, real account, or data the fixtures lack).

Done when the description shows each visible change, or names why it could not.
