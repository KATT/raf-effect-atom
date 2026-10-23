// The parts of React's webpack Flight bindings the server component tests
// use; the package ships no types.

declare module "react-server-dom-webpack/server" {
	import type * as React from "react";

	export function registerClientReference<T>(
		proxyImplementation: T,
		id: string,
		exportName: string,
	): T;
	export function renderToReadableStream(
		model: React.ReactNode,
		webpackMap: Record<
			string,
			{
				readonly chunks: ReadonlyArray<string>;
				readonly id: string;
				readonly name: string;
			}
		>,
		options?: {
			readonly onError?: (() => void) | undefined;
			readonly signal?: AbortSignal | undefined;
		},
	): ReadableStream<Uint8Array>;
}

declare module "react-server-dom-webpack/client" {
	export function createFromReadableStream<T>(
		stream: ReadableStream<Uint8Array>,
		options: {
			readonly serverConsumerManifest: {
				readonly moduleLoading: null;
				readonly moduleMap: Record<
					string,
					Record<
						string,
						{
							readonly chunks: ReadonlyArray<string>;
							readonly id: string;
							readonly name: string;
						}
					>
				>;
				readonly serverModuleMap: null;
			};
		},
	): Promise<T>;
}
