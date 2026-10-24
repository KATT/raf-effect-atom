import { type ReactNode, useState, useSyncExternalStore } from "react";

/** Whether this document has painted, which an effect in the app's frame sets. */
declare const painted: { readonly get: () => boolean };
declare function Cover(props: { children: ReactNode }): ReactNode;

// #region late-boundary
const subscribeNever = () => () => {};

/** `true` while React hydrates the component, `false` once it mounts later. */
function useHydrating() {
	return useSyncExternalStore(
		subscribeNever,
		() => false,
		() => true,
	);
}

// A list that hydrates in a streamed boundary is part of the document the
// server rendered, even when the frame's effect has marked it painted.
function ArrivalCover(props: { children: ReactNode }) {
	const hydrating = useHydrating();
	const [arrived] = useState(() => !hydrating && painted.get());
	return arrived ? <Cover>{props.children}</Cover> : props.children;
}
// #endregion late-boundary

export { ArrivalCover };
