import { Effect, Schema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

declare global {
	/** Each atom run, by key. The RSC and SSR builds share it. */
	var atomRuns: Array<string> | undefined;
}

const record = (key: string) =>
	Effect.sync(() => {
		globalThis.atomRuns ??= [];
		globalThis.atomRuns.push(key);
	});

export const post = Atom.family((slug: string) =>
	Atom.make(
		record(`post ${slug}`).pipe(Effect.as({ title: `Post ${slug}` })),
	).pipe(
		Atom.serializable({
			key: `post:${slug}`,
			schema: AsyncResult.Schema({
				success: Schema.Struct({ title: Schema.String }),
			}),
		}),
	),
);

export const comments = Atom.family((slug: string) =>
	Atom.make(
		record(`comments ${slug}`).pipe(
			// Still loading when the page renders, so it streams.
			Effect.andThen(Effect.sleep("20 millis")),
			Effect.as<ReadonlyArray<string>>([`First comment on ${slug}`]),
		),
	).pipe(
		Atom.serializable({
			key: `comments:${slug}`,
			schema: AsyncResult.Schema({ success: Schema.Array(Schema.String) }),
		}),
	),
);
