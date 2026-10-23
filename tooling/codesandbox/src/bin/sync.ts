#!/usr/bin/env node
/**
 * Regenerates the `codesandbox` branch from this checkout and pushes it to
 * `origin`. `.github/workflows/codesandbox.yaml` runs it after each push to
 * `main` that can change the copies.
 *
 * Usage: pnpm --filter @tooling/codesandbox sync
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer, Path } from "effect";

import { branch, writeCopies } from "../copies.ts";
import { Builder, syncBranch } from "../sync.ts";

Effect.gen(function* () {
	const path = yield* Path.Path;
	const root = path.join(import.meta.dirname, "../../../..");
	yield* syncBranch(root, "origin", branch, (dir) => writeCopies(root, dir));
}).pipe(
	Effect.provide(Builder.layer.pipe(Layer.provideMerge(NodeServices.layer))),
	NodeRuntime.runMain,
);
