import { Cause, Option, Predicate } from "effect";
import { AsyncResult, Atom, type AtomRegistry } from "effect/reactivity";

/** How a request or an atom's result ended. */
export type Outcome =
	/** The server died while handling it: an error of type `unknown`. */
	| { readonly status: "defect" }
	/** A typed failure, by its tag. */
	| { readonly error: string; readonly status: "failure" }
	| { readonly status: "interrupted" }
	| { readonly status: "success" };

/**
 * How a failure ended: its typed error by `_tag`, or by `name` for an error
 * without one, or a defect.
 */
export const failureOf = (cause: Cause.Cause<unknown>): Outcome =>
	Option.match(Cause.findErrorOption(cause), {
		onNone: () =>
			Cause.hasDies(cause) ? { status: "defect" } : { status: "interrupted" },
		onSome: (error) => {
			// oxlint-disable-next-line eslint/no-underscore-dangle -- Effect's errors are told apart by `_tag`
			const tag = Predicate.hasProperty(error, "_tag") ? error._tag : undefined;
			const name = Predicate.hasProperty(error, "name")
				? error.name
				: undefined;
			return {
				error: Predicate.isString(tag)
					? tag
					: Predicate.isString(name)
						? name
						: "Error",
				status: "failure",
			};
		},
	});

/**
 * A request the demo's client sent to its worker, with when each side saw
 * it: the client sends it, the worker's server receives it and responds, and
 * the client settles it when the exit arrives.
 */
export interface TracedRequest {
	readonly endedAt: number | undefined;
	readonly id: string;
	/** The procedure and its payload, e.g. `GetIssue {"id":1}`. */
	readonly label: string;
	/** The latency the server had set, in ms. */
	readonly latency: number | undefined;
	/** `undefined` while it's in flight. */
	readonly outcome: Outcome | undefined;
	readonly receivedAt: number | undefined;
	readonly respondedAt: number | undefined;
	readonly sentAt: number;
}

/** The demo's requests, oldest first. Each registry has its own. */
export const requestsAtom = Atom.make<ReadonlyArray<TracedRequest>>([]).pipe(
	Atom.keepAlive,
	Atom.withLabel("demo-kit:requests"),
);

/** What an atom's `AsyncResult` holds. */
export type AtomPhase = Outcome | { readonly status: "initial" };

export const phaseOf = (
	result: AsyncResult.AsyncResult<unknown, unknown>,
): AtomPhase =>
	AsyncResult.match(result, {
		onFailure: (failure) => failureOf(failure.cause),
		onInitial: () => ({ status: "initial" }),
		onSuccess: () => ({ status: "success" }),
	});

/** A stretch of time an atom spent in one state. */
interface AtomSegment {
	readonly from: number;
	readonly phase: AtomPhase;
	/** `undefined` for the current state. */
	readonly to: number | undefined;
	readonly waiting: boolean;
}

/** One atom's states over time, as the trace sampled them. */
export interface AtomTrack {
	/** The atom's label, without `AtomRpc:`, e.g. `GetIssue:1`. */
	readonly label: string;
	/** How many subscriptions keep it mounted: hooks, and loader leases. */
	readonly readers: number;
	/** When the registry removed it, once nothing read it for its idle TTL. */
	readonly removedAt: number | undefined;
	readonly segments: ReadonlyArray<AtomSegment>;
}

const maxTracks = 12;

const samePhase = (a: AtomPhase, b: AtomPhase) =>
	a.status === b.status &&
	(a.status !== "failure" || b.status !== "failure" || a.error === b.error);

/**
 * The registry's labelled atoms that hold an `AsyncResult`, such as an
 * `AtomRpc` query with a `serializationKey`, and their current state.
 */
const sampleNodes = (registry: AtomRegistry.AtomRegistry) => {
	const live = new Map<
		string,
		{
			readonly readers: number;
			readonly result: AsyncResult.AsyncResult<unknown, unknown>;
		}
	>();
	for (const node of registry.getNodes().values()) {
		const label = node.atom.label?.[0];
		const value = Option.getOrUndefined(node.valueOption());
		if (
			label === undefined ||
			label.startsWith("demo-kit:") ||
			label.startsWith("AtomRpc:mutation:") ||
			!AsyncResult.isAsyncResult(value)
		) {
			continue;
		}
		live.set(label.replace(/^AtomRpc:/, ""), {
			readers: node.listeners.size,
			result: value,
		});
	}
	return live;
};

const advance = (
	tracks: ReadonlyArray<AtomTrack>,
	registry: AtomRegistry.AtomRegistry,
	now: number,
): ReadonlyArray<AtomTrack> => {
	const live = sampleNodes(registry);
	let changed = false;
	const next = tracks.map((track): AtomTrack => {
		const sample = live.get(track.label);
		live.delete(track.label);
		const last = track.segments.at(-1);
		if (sample === undefined) {
			if (track.removedAt !== undefined || last === undefined) {
				return track;
			}
			changed = true;
			return {
				...track,
				removedAt: now,
				segments: [...track.segments.slice(0, -1), { ...last, to: now }],
			};
		}
		const phase = phaseOf(sample.result);
		const waiting = sample.result.waiting;
		const same =
			track.removedAt === undefined &&
			last !== undefined &&
			samePhase(last.phase, phase) &&
			last.waiting === waiting;
		if (same && sample.readers === track.readers) {
			return track;
		}
		changed = true;
		if (same) {
			return { ...track, readers: sample.readers };
		}
		const closed =
			last === undefined || last.to !== undefined
				? track.segments
				: [...track.segments.slice(0, -1), { ...last, to: now }];
		return {
			label: track.label,
			readers: sample.readers,
			removedAt: undefined,
			segments: [...closed, { from: now, phase, to: undefined, waiting }],
		};
	});
	for (const [label, sample] of live) {
		changed = true;
		next.push({
			label,
			readers: sample.readers,
			removedAt: undefined,
			segments: [
				{
					from: now,
					phase: phaseOf(sample.result),
					to: undefined,
					waiting: sample.result.waiting,
				},
			],
		});
	}
	return changed ? next.slice(-maxTracks) : tracks;
};

/**
 * The demo's atoms over time, sampled every animation frame while mounted.
 * Sampling reads the registry's nodes without subscribing, so it doesn't
 * keep an atom mounted or count as a reader.
 */
export const atomTracksAtom = Atom.make((get) => {
	const registry = get.registry;
	let tracks: ReadonlyArray<AtomTrack> = [];
	let frame = 0;
	const sample = () => {
		const next = advance(tracks, registry, Date.now());
		if (next !== tracks) {
			tracks = next;
			get.setSelf(tracks);
		}
		frame = requestAnimationFrame(sample);
	};
	frame = requestAnimationFrame(sample);
	get.addFinalizer(() => {
		cancelAnimationFrame(frame);
	});
	return tracks;
}).pipe(Atom.keepAlive, Atom.withLabel("demo-kit:atom-tracks"));

/** The state an atom is in at the end of its track. */
export const currentSegment = (track: AtomTrack) => track.segments.at(-1);
