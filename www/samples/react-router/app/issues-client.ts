import { IssueRpcs } from "@examples/contract";
import { Layer } from "effect";
import { AtomRpc } from "effect/reactivity";
import { RpcClient, RpcSerialization } from "effect/rpc";

import { RpcHttpClient, rpcUrl } from "#rpc-transport";

// #region client
export class IssuesClient extends AtomRpc.Service<IssuesClient>()(
	"IssuesClient",
	{
		group: IssueRpcs,
		protocol: RpcClient.layerProtocolHttp({ url: rpcUrl }).pipe(
			Layer.provide([RpcHttpClient, RpcSerialization.layerJson]),
		),
	},
) {}
// #endregion client
