---
title: Loader failures
description: A typed failure a loader hit on the server crosses to the browser as the same tagged error, where a boundary catches it or the loader turns it into a redirect.
section: Together
order: 1
---

`ensure` and `fetch` return a typed failure as a result instead of rejecting. A failure from the server reaches the browser as the same tagged error, decoded by the procedure's Schema, so there are two places to handle it.

## In a boundary

Let the route render and the read throw the failure to the boundary that claims it. The issue route reads `useIssueBoundary().wrap(issue(id))`, so `IssueNotFound` goes to `<IssueBoundary>` and `Unauthorized` to `<AuthBoundary>`:

```sample
tanstack-start/src/boundaries.tsx#issue
```

```sample
tanstack-start/src/routes/issues.$id.tsx#hero
```

The server sends the failed result with the page. The browser hydrates it, the read throws it, and the boundary renders its handler, all without a request. `reset` refreshes the atom in the browser.

## In the loader

When a failure should be the router's not-found page or a redirect, the loader reads the result's error:

```sample
tanstack-start/src/docs/loader-failures.tsx#not-found
```

The typed failure stays a value until the loader decides what it means. Only a defect or an interruption rejects, and goes to the router's error component.
