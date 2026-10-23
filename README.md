<p align="center">
	<img src="./www/public/favicon.svg" alt="" width="96" height="96" />
</p>

<h1 align="center">raf-effect-atom</h1>

<p align="center">Render-as-you-fetch for <a href="https://github.com/Effect-TS/effect/tree/main/packages/atom/react">Effect Atom</a>: typed error boundaries, and atoms prefetched from route loaders.</p>

> [!NOTE]
> raf-effect-atom is early. Nothing is published yet, and the API can still change between minor releases.

Effect Atom's registry is the cache. These packages add only what it lacks, as thin layers over Effect Atom and [Effect RPC](https://github.com/Effect-TS/effect/tree/main/packages/effect/src/rpc):

| Package                | What                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `effect-atom-boundary` | Error boundaries typed by an atom's error type: catch failures by `_tag`.                            |
| `raf-effect-atom`      | Start atoms from TanStack Start, Next.js and React Router loaders before render, and stream them in. |

Both take `effect`, `@effect/atom-react` and `react` as peer dependencies.

## License

[MIT](./LICENSE)
