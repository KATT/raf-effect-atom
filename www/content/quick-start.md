---
title: Quick start
description: An AtomRpc client, atoms with serialization keys, a router that streams the registry, a loader and a boundary, in a TanStack Start app.
section: Getting started
order: 3
---

This page builds one route of a [TanStack Start](https://tanstack.com/start/latest) app on an Effect RPC contract: an issue tracker's `IssueRpcs` group, whose `GetIssue` fails with `IssueNotFound` and whose every procedure can fail with `Unauthorized`.

## 1. The client

`AtomRpc.Service` makes the RPC client a service with query atoms. During server rendering, the transport calls the RPC handler in the same process; in the browser it posts to the app's `/rpc` route.

```sample
tanstack-start/src/issues-client.ts#client
```

## 2. The atoms

A query atom with a `serializationKey` can cross from the server to the browser. Without one, the browser requests it again.

```sample
tanstack-start/src/issues.ts#atoms
```

## 3. The router

`makeRegistry` makes one registry per request on the server and one for the page in the browser. `setupRouterAtoms` provides it to the app and sends it to the browser with the router's own dehydrated state.

```sample
tanstack-start/src/router.tsx#router
```

The root route types the loader verbs on the router context and mounts the app's sign-in boundary.

```sample
tanstack-start/src/routes/__root.tsx#root
```

## 4. The boundaries

```sample
tanstack-start/src/boundaries.tsx#auth
```

```sample
tanstack-start/src/boundaries.tsx#issue
```

## 5. The route

```sample
tanstack-start/src/routes/issues.$id.tsx#route
```

```sample
tanstack-start/src/routes/issues.$id.tsx#component
```

Open `/issues/1`: the server waits for the issue, renders the title, and streams the assignee in when it arrives. The browser reads both from its registry without requesting them again. Open `/issues/999` and the server sends the `IssueNotFound` failure instead: the browser renders the issue boundary's message from it, still without a request.
