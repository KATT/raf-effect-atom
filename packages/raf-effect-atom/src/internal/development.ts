import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

/** Whether `NODE_ENV` isn't `production`, read through `Config`. */
export const isDevelopment: Effect.Effect<boolean> = Config.String(
	"NODE_ENV",
).pipe(
	Config.withDefault("development"),
	Effect.map((env) => env !== "production"),
	Effect.orElseSucceed(() => true),
);
