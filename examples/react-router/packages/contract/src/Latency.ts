import { Schema } from "effect";
import { RpcMiddleware } from "effect/rpc";

/**
 * The cookie the apps' settings menu stores the database latency in, in ms.
 * The backend reads it from each request, like a session cookie.
 */
export const LATENCY_COOKIE = "db-latency";

/** The latencies the settings menu offers, in ms. */
const LatencyMs = Schema.Literals([0, 100, 400, 1000, 3000]);

/** A latency cookie's value, or `None` when it's not one of {@link LatencyMs}. */
export const decodeLatencyCookie = Schema.decodeUnknownOption(
	Schema.NumberFromString.pipe(Schema.decodeTo(LatencyMs)),
);

/**
 * Applies the request's latency cookie on the server. Clients don't implement
 * it, like Effect's `TimingMiddleware` fixture.
 */
export class Latency extends RpcMiddleware.Service<Latency>()(
	"@examples/contract/Latency",
) {}
