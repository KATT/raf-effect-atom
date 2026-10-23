import { data } from "react-router";

export { NotFound as default } from "~/components/not-found.tsx";

/** Any other path. */
export function loader() {
	return data(null, { status: 404 });
}
