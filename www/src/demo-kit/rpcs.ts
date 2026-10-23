import {
	EmptyBody,
	EmptyComment,
	EmptyTitle,
	IssueNotFound,
	IssueRpcs,
	Unauthorized,
} from "@examples/contract";
import { Schema } from "effect";
import { Rpc, RpcGroup, RpcMiddleware } from "effect/rpc";

/**
 * A failure no procedure declares, like a bug on the server. The worker dies
 * with it, so it reaches the client as a defect: an error of type `unknown`.
 */
export class Crash extends Schema.TaggedError<Crash>()("Crash", {
	message: Schema.String,
}) {}

/** What `failNext` can queue: the contract's errors, and {@link Crash}. */
export const InjectedError = Schema.Union([
	Unauthorized,
	IssueNotFound,
	EmptyTitle,
	EmptyBody,
	EmptyComment,
	Crash,
]);
export type InjectedError = typeof InjectedError.Type;

/**
 * Fails a request with the next queued error, after the demo's latency. An
 * error the procedure doesn't declare (`IssueNotFound` for `CountIssues`, or
 * a {@link Crash}) becomes a defect, as an undeclared error would on a real
 * server.
 */
export class InjectedFailure extends RpcMiddleware.Service<InjectedFailure>()(
	"www/demo-kit/InjectedFailure",
) {}

/**
 * Logs each request the client sends, for the demo's Queries panel. Its
 * client part does the work; the worker's part passes requests through.
 */
export class RequestLog extends RpcMiddleware.Service<RequestLog>()(
	"www/demo-kit/RequestLog",
	{ requiredForClient: true },
) {}

/** The latencies a demo's toolbar offers, in ms. */
export const latencies = [
	{ label: "Fast", ms: 250 },
	{ label: "3G", ms: 900 },
	{ label: "Slow", ms: 2500 },
] as const;

/** A demo's server starts at `3G`. */
export const initialLatency: number = latencies[1].ms;

/** The demo server's settings, as its toolbar shows them. */
export class DemoControls extends Schema.Class<DemoControls>(
	"www/demo-kit/DemoControls",
)({
	/** Each request waits about this long, in ms. */
	latency: Schema.Number,
	/** The `_tag`s of the queued failures, next first. */
	queued: Schema.Array(Schema.String),
}) {}

/** What the demo's server did with a request, for the request trace. */
export class ServerEvent extends Schema.Class<ServerEvent>(
	"www/demo-kit/ServerEvent",
)({
	/** When, by the worker's clock, which is the page's. */
	at: Schema.Number,
	/** The latency set when it arrived, in ms: it takes about that long. */
	latency: Schema.Number,
	phase: Schema.Literals(["received", "responded"]),
	/** The id the client gave the request. */
	requestId: Schema.String,
}) {}

/** Drive the demo's server. They skip the issue procedures' middleware. */
const ControlRpcs = RpcGroup.make(
	Rpc.make("GetControls", { success: DemoControls }),
	Rpc.make("ServerEvents", { stream: true, success: ServerEvent }),
	Rpc.make("SetLatency", {
		payload: { ms: Schema.Number },
		success: DemoControls,
	}),
	Rpc.make("FailNext", {
		payload: {
			count: Schema.Int.check(Schema.isGreaterThan(0)),
			error: InjectedError,
		},
		success: DemoControls,
	}),
);

/** What a demo's worker serves: the contract's procedures, and the controls. */
export const DemoRpcs = IssueRpcs.middleware(InjectedFailure)
	.middleware(RequestLog)
	.merge(ControlRpcs);

/** The control procedures, which the request trace leaves out. */
export const controlTags: ReadonlySet<string> = new Set(
	ControlRpcs.requests.keys(),
);
