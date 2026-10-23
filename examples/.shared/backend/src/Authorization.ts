import {
	Authorization,
	CurrentUser,
	SESSION_COOKIE,
	SIGNED_OUT,
	Unauthorized,
} from "@examples/contract";
import { exampleUser } from "@examples/db";
import { Effect, Layer } from "effect";
import { Cookies } from "effect/http";

/**
 * The contract's `Authorization` middleware: a request runs as the example
 * user unless its session cookie says it signed out.
 */
export const AuthorizationLayer = Layer.succeed(Authorization)(
	Authorization.of(
		Effect.fnUntraced(function* (effect, options) {
			const cookies = Cookies.parseHeader(options.headers.cookie ?? "");
			if (cookies[SESSION_COOKIE] === SIGNED_OUT) {
				return yield* new Unauthorized();
			}
			return yield* Effect.provideService(effect, CurrentUser, exampleUser);
		}),
	),
);
