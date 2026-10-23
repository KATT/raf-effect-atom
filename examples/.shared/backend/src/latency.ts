import {
	decodeLatencyCookie,
	Latency,
	LATENCY_COOKIE,
} from "@examples/contract";
import { DbLatency } from "@examples/db";
import { Effect, Layer, Option } from "effect";
import { Cookies } from "effect/http";

/** The contract's `Latency` middleware: the db waits what the cookie asks. */
export const LatencyLayer = Layer.succeed(Latency)(
	Latency.of((effect, options) =>
		Option.match(
			decodeLatencyCookie(
				Cookies.parseHeader(options.headers.cookie ?? "")[LATENCY_COOKIE],
			),
			{
				onNone: () => effect,
				onSome: (ms) => Effect.provideService(effect, DbLatency, ms),
			},
		),
	),
);
