---
title: Shapes that force waterfalls
description: The API and URL shapes that leave a loader unable to start a page's reads together, the escape hatch for each, and the change that removes it.
section: raf-effect-atom
order: 2.5
---

A loader starts every read the URL names, all at once. It can't start a read whose input only another response, a click or a background job has: that read waits a round trip, whatever the frontend does. These waterfalls come from the shape of the API and the URL, so the fix is there. Each shape below has an escape hatch, which pays the round trip but keeps it in the loader or the handler instead of a render, and the change that removes it.

The samples use hypothetical endpoints: each shows what a shape costs a loader.

## An id only another response has

A page whose URL names a project, but whose files are listed per release, has to read the project to find its current release:

```
1. |-> GetProject
2.   |-> ListReleaseFiles (the release from GetProject)
```

The escape hatch is the one in [Dependent atoms](./request-waterfalls.md#dependent-atoms): `ensure` the parent, and start the child from [`Loader.result`](./loader-verbs.md#typed-failures-are-results). When a link already knows the id, put it in the URL so the loader starts both at once:

```sample
tanstack-start/src/docs/data-shapes.tsx#id-from-response
```

What removes it:

- **An endpoint that takes the key the URL has.** `ListReleaseFiles({ projectId })` resolving the current release on the server starts beside `GetProject`.
- **A URL that names the id.** Links from pages that know the release pass it, and a page that shows one release has it in a search param, so a reload or a shared link keeps it.

## A child that needs its parent's data

A child endpoint that takes a value from the parent's response, such as a package's files taking the commit its publication returns, waits for the parent even when the URL names everything the page shows:

```
1. |-> GetPackage
2.   |-> GetFilesAtCommit (the commit from GetPackage)
```

The escape hatch is the same `ensure`, then `prefetch` from its result. A page with no loader, such as a client-only island, starts the child with [`useWaterfall`](./request-waterfalls.md#render-time-inputs-usewaterfall) from the parent's result instead.

What removes it is a child endpoint keyed by what the URL holds, which resolves the parent's value itself, or a parent response that includes the child when the page always shows both. Either way the loader starts every read at once:

```sample
tanstack-start/src/docs/data-shapes.tsx#child-with-parent
```

## A shell that gates the reads inside it

A layout that checks the session, then access to the workspace, then renders the page, chains three levels when each waits for the one before. A shell component that reads the check and renders its children only once it passes is [fetch-on-render](./request-waterfalls.md#fetch-on-render): the children's reads start when they render.

```
1. |-> GetSession
2.   |-> CheckWorkspaceAccess
3.     |-> ListMembers
3.     |-> ListActivity
```

The escape hatch keeps the check in the loader: `ensure` it, and start the reads it guards only once it succeeded, as [Reads behind a check](./loader-failures.md#reads-behind-a-check) shows. The guarded reads still wait one round trip, but they run alongside each other, and a failed check sends none of them.

What removes it is endpoints that authorize each request themselves. The loader then starts the reads with the check, and when the check fails they fail with their own `Unauthorized`, so nothing guarded reaches the page:

```sample
tanstack-start/src/docs/data-shapes.tsx#gate
```

Fold the session into the check as well: an access check that reads the session cookie needs no session read before it. Another way is one endpoint that returns the verdict with the page's data.

## A key that isn't in the URL

A read keyed by state the URL doesn't hold, such as a selected item in component state, a page cursor or an entry picked in a dialog, can't start in the loader. The read starts when the component that holds the state renders, after everything above it:

```
1. |-> GetPage
2.   |-> GetSelectedItem (the selection from component state)
```

- **Escape hatches:** start it in the [event handler](./request-waterfalls.md#event-handlers) that changes the state, with `Loader.make(registry).prefetch`, or with [`useWaterfall`](./request-waterfalls.md#render-time-inputs-usewaterfall) when only a render has the key. A key only the browser has, such as one in the URL's fragment, in `sessionStorage` or in history state, starts in the loader with [`prefetchInBrowser`](./request-waterfalls.md#inputs-only-the-browser-has).
- **What removes it:** [put the state in the URL](./request-waterfalls.md#put-the-state-in-the-url). A key that should survive a reload or a shared link, such as a selected item, a tab or a filter, belongs in a search param, and the loader starts its read with the page's. A key that shouldn't, such as a cursor for a later page or a file picked from disk, stays a start in the handler.

## One read per item

A list whose items each need a read of their own, such as each linked account's tools, starts those reads only once the list is in:

```
1. |-> ListLinkedAccounts
2.   |-> ListAccountTools (account 1)
2.   |-> ListAccountTools (account 2)
2.   |-> ListAccountTools (account 3)
```

The escape hatch is `ensure` on the list, then a `prefetch` per item, so the item reads start together one round trip later. A list that only a render has, such as one a component reads from another atom, starts each item with `useWaterfall` in its row:

```sample
tanstack-start/src/docs/data-shapes.tsx#per-item
```

What removes it:

- **Return the children with the list.** A response that includes each account's tools is one request.
- **Take the ids.** A batch endpoint that takes the item ids, from the URL or from a link that knows them, starts beside the list.
- **Key the response by every input it depends on.** An endpoint that answers for "the accounts linked now", with no ids in its arguments, can't be started for a known set and can't be told apart after a link changes: the client refreshes the same key and reads it again. With the ids in its arguments, each set has its own atom, and a loader can start it.

## Data that arrives later

A resource a background job creates, such as the default apps of a new workspace, isn't in the first read: the list answers with a pending flag, and the page polls. The server renders the page once, with the pending list:

```
1. |-> CreateWorkspace
2.   |-> ListApps (pending)
     ... the job runs
3.     |-> ListApps
```

The escape hatch is a bounded wait in the loader: read again with `Loader.fetch` while the list is pending, on a schedule, and send what it has when the bound runs out. [`Effect.repeat`](https://github.com/Effect-TS/effect/blob/effect%404.0.6/packages/effect/src/Effect.ts) does the waiting, and `atoms.run` runs it on the loader's registry. The page still shows a pending state and polls for a list the bound didn't reach:

```sample
tanstack-start/src/docs/data-shapes.tsx#provisioning
```

What removes it is an API whose first read is the list the page shows: a create endpoint that answers once the job is done, or one whose response includes the resources it made, or a list endpoint that waits for the pending job before it answers.

## Summary

| Shape                                | Escape hatch                                                          | What removes it                                                          |
| ------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| An id only another response has      | `ensure` the parent, then `prefetch` from its result                  | An endpoint that takes the URL's key, or the id in the URL               |
| A child that needs its parent's data | `ensure`, then `prefetch`; `useWaterfall` with no loader              | A child keyed by the URL's values, or the child in the parent's response |
| A shell that gates its reads         | `ensure` the check in the loader, then start the reads                | Endpoints that authorize themselves, started with the check              |
| A key that isn't in the URL          | Start it in the event handler, `useWaterfall`, or `prefetchInBrowser` | The key in a search param                                                |
| One read per item                    | `ensure` the list, then `prefetch` each item                          | The children in the list's response, or a batch endpoint by ids          |
| Data that arrives later              | A bounded `Loader.fetch` repeat in the loader                         | A first read that waits for the job, or returns what it made             |
