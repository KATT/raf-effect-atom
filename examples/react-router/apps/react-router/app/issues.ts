/**
 * The issue tracker's RPC client and its atoms. Browser-safe: it imports the
 * contract, and `#rpc-transport` picks where requests go.
 */
import { rpcTransport } from "#rpc-transport";
import {
	type IssueId,
	type IssueListInput,
	IssueRpcs,
} from "@examples/contract";
import { Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { Atom, AtomRpc } from "effect/reactivity";
import { RpcClient, RpcSerialization } from "effect/rpc";

/**
 * Where the RPC client sends requests. `#rpc-transport` picks one by export
 * condition: in-process on the server, `POST /rpc` in the browser.
 */
export interface RpcTransport {
	/** Replaces `globalThis.fetch`. */
	readonly fetch?: typeof globalThis.fetch;
	/** Sent with every request. */
	readonly headers?: Readonly<Record<string, string>>;
	readonly url: string;
}

const httpClient =
	rpcTransport.fetch === undefined
		? FetchHttpClient.layer
		: FetchHttpClient.layer.pipe(
				Layer.provide(Layer.succeed(FetchHttpClient.Fetch, rpcTransport.fetch)),
			);

/**
 * The page request's `cookie` header, set in each server request's registry,
 * so the backend reads the same session and latency as when the browser
 * calls it. Unset in the browser, which sends its own cookies.
 */
export const requestCookie = Atom.make<string | undefined>(undefined).pipe(
	Atom.keepAlive,
);

/**
 * The issue tracker's procedures as atoms. Each registry builds its own
 * client: one per request on the server, one in the browser.
 */
export class IssuesClient extends AtomRpc.Service<IssuesClient>()(
	"@examples/react-router/IssuesClient",
	{
		group: IssueRpcs,
		protocol: (get) => {
			const cookie = get(requestCookie);
			return RpcClient.layerProtocolHttp({
				transformClient: HttpClient.mapRequest((request) => {
					const sent = HttpClientRequest.setHeaders(
						request,
						rpcTransport.headers ?? {},
					);
					return cookie === undefined
						? sent
						: HttpClientRequest.setHeader(sent, "cookie", cookie);
				}),
				url: rpcTransport.url,
			}).pipe(Layer.provide([RpcSerialization.layerJson, httpClient]));
		},
	},
) {}

/**
 * Every query refreshes when a mutation names `issues`, and the browser's
 * registry keeps a result a minute after its last reader unmounts, so
 * `ensure` can show it without a request.
 */
const reactivityKeys = ["issues"];
const timeToLive = "1 minute";

/** One page of the list, from `cursor`. */
export const issuePage = (input: IssueListInput, cursor: number) =>
	IssuesClient.query(
		"ListIssues",
		{ ...input, cursor },
		{
			reactivityKeys,
			serializationKey: `${input.status}:${input.sort}:${cursor}`,
			timeToLive,
		},
	);

export const issueCounts = IssuesClient.query("CountIssues", undefined, {
	reactivityKeys,
	serializationKey: "all",
	timeToLive,
});

export const issue = (id: IssueId) =>
	IssuesClient.query(
		"GetIssue",
		{ id },
		{ reactivityKeys, serializationKey: String(id), timeToLive },
	);

export const assignee = (issueId: IssueId) =>
	IssuesClient.query(
		"GetIssueAssignee",
		{ issueId },
		{ reactivityKeys, serializationKey: String(issueId), timeToLive },
	);

/** One page of an issue's comments, newest first, from `cursor`. */
export const commentPage = (issueId: IssueId, cursor: number) =>
	IssuesClient.query(
		"ListComments",
		{ cursor, issueId },
		{
			reactivityKeys,
			serializationKey: `${issueId}:${cursor}`,
			timeToLive,
		},
	);

export const updateTitle = IssuesClient.mutation("UpdateTitle");
export const updateBody = IssuesClient.mutation("UpdateBody");
export const setStatus = IssuesClient.mutation("SetStatus");
export const addComment = IssuesClient.mutation("AddComment");

/** What every mutation passes, so the queries above refresh after it. */
export const refreshIssues = { reactivityKeys } as const;
