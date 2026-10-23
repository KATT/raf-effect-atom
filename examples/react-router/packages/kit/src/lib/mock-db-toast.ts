import { toast } from "sonner";

/**
 * True on the deployed demos (not localhost). The in-memory db is fine in one
 * long-lived `pnpm dev` / `pnpm start` process; Vercel's functions each get
 * their own seed. Set `sessionStorage["raf-effect-atom-mock-db-toast"]` to
 * `"1"` to preview the toast locally.
 */
function isDeployedDemo() {
	if (window.sessionStorage.getItem("raf-effect-atom-mock-db-toast") === "1") {
		return true;
	}
	const hostname = window.location.hostname;
	return (
		hostname !== "localhost" &&
		hostname !== "127.0.0.1" &&
		hostname !== "[::1]" &&
		!hostname.endsWith(".local")
	);
}

/**
 * Warns that writes go to an in-memory db, which doesn't behave like a real
 * database on Vercel's functions. One toast id, so repeats refresh one notice
 * instead of stacking. Call it from the browser, after a write.
 */
export function warnMockDbWrite() {
	if (!isDeployedDemo()) {
		return;
	}
	toast.warning("Edits may not stick on this demo", {
		description:
			"This app uses an in-memory database. On Vercel, the next request can reach a different instance, so changes often disappear after a refresh.",
		duration: 8000,
		id: "mock-db-write",
	});
}
