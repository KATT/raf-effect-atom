import { Context, Schema } from "effect";
import { RpcMiddleware } from "effect/rpc";

import type { User } from "./Issue.ts";

/**
 * The cookie that signs the example user out. The apps' settings menu sets it
 * to {@link SIGNED_OUT}, so every procedure fails with `Unauthorized` until
 * it's cleared. Without it, requests run as the signed-in example user.
 */
export const SESSION_COOKIE = "session";
export const SIGNED_OUT = "signed-out";

/** Who a request runs as. {@link Authorization} provides it to handlers. */
export class CurrentUser extends Context.Service<CurrentUser, User>()(
	"@examples/contract/CurrentUser",
) {}

/** Every procedure can fail with it: {@link Authorization} raises it. */
export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
	"Unauthorized",
	{},
) {}

/**
 * Runs on the server before every procedure. The contract declares it, so its
 * error is part of every procedure's error type; the backend implements it.
 */
export class Authorization extends RpcMiddleware.Service<
	Authorization,
	{ provides: CurrentUser }
>()("@examples/contract/Authorization", { error: Unauthorized }) {}
