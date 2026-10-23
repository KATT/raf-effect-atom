import { DateTime } from "effect";

// UTC, so the server and the browser render the same text and hydration
// doesn't see a mismatch.
const day = new Intl.DateTimeFormat("en", {
	day: "numeric",
	month: "short",
	timeZone: "UTC",
});

const dayAndTime = new Intl.DateTimeFormat("en", {
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
	month: "short",
	timeZone: "UTC",
});

/** "Jan 5". */
export function formatDay(date: DateTime.Utc) {
	return day.format(DateTime.toDateUtc(date));
}

/** "Jan 5, 3:04 PM", in UTC. */
export function formatDayAndTime(date: DateTime.Utc) {
	return dayAndTime.format(DateTime.toDateUtc(date));
}
