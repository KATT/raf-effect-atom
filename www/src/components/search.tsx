import { Button } from "@examples/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@examples/ui/components/dialog";
import { cn } from "@examples/ui/lib/utils";
import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { Effect } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";
import { FileText, Hash, Search } from "lucide-react";
import { use, useState } from "react";

import { allDocs } from "~/content/docs.ts";
import {
	loadSearchIndex,
	searchDocs,
	type SearchHit,
} from "~/search/docs-index.ts";

const pageHits: ReadonlyArray<SearchHit> = allDocs.map((doc) => ({
	context: doc.section,
	hash: undefined,
	id: doc.slug,
	slug: doc.slug,
	title: doc.title,
}));

/** The index is its own chunk, loaded once the search is about to open. */
const searchIndexAtom = Atom.make(
	Effect.promise(async () => {
		const index = await import("virtual:docs-search");
		return loadSearchIndex(index.default);
	}),
).pipe(Atom.keepAlive, Atom.withLabel("search-index"));

export function SearchButton() {
	const registry = use(RegistryContext);
	const [open, setOpen] = useState(false);
	const loadIndex = () => {
		registry.get(searchIndexAtom);
	};
	const openSearch = () => {
		loadIndex();
		setOpen(true);
	};
	const openOnShortcut = (event: KeyboardEvent) => {
		if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			openSearch();
		}
	};
	return (
		<>
			<Button
				aria-keyshortcuts="Meta+K Control+K"
				className="w-9 justify-start px-0 text-muted-foreground sm:w-56 sm:px-3"
				onClick={openSearch}
				onFocus={loadIndex}
				onPointerEnter={loadIndex}
				ref={(button) => {
					if (button === null) {
						return;
					}
					window.addEventListener("keydown", openOnShortcut);
					return () => {
						window.removeEventListener("keydown", openOnShortcut);
					};
				}}
				size="sm"
				title="Search docs (⌘K)"
				variant="outline"
			>
				<Search className="mx-auto sm:mx-0" />
				<span className="hidden sm:inline">Search docs…</span>
				<kbd className="ml-auto hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">
					⌘K
				</kbd>
			</Button>
			<Dialog onOpenChange={setOpen} open={open}>
				<DialogContent className="top-[15%] translate-y-0 gap-0 p-0 sm:max-w-xl">
					<DialogTitle className="sr-only">Search the docs</DialogTitle>
					<DialogDescription className="sr-only">
						Type to find a page or a section
					</DialogDescription>
					{open ? (
						<SearchPanel
							onClose={() => {
								setOpen(false);
							}}
						/>
					) : null}
				</DialogContent>
			</Dialog>
		</>
	);
}

function SearchPanel(props: { readonly onClose: () => void }) {
	const navigate = useNavigate();
	const [query, setQuery] = useState("");
	const [active, setActive] = useState(0);
	const searchIndex = useAtomValue(searchIndexAtom);
	const loading = query.trim() !== "" && !AsyncResult.isSuccess(searchIndex);
	let results: ReadonlyArray<SearchHit> = [];
	if (query.trim() === "") {
		results = pageHits.slice(0, 8);
	} else if (AsyncResult.isSuccess(searchIndex)) {
		results = searchDocs(searchIndex.value, query);
	}
	const selected = Math.min(active, Math.max(results.length - 1, 0));

	const go = (entry: SearchHit) => {
		props.onClose();
		void navigate({
			hash: entry.hash,
			params: { slug: entry.slug },
			to: "/docs/$slug",
		});
	};

	return (
		<div className="grid">
			<label className="flex items-center gap-3 border-b px-4">
				<Search className="size-4 text-muted-foreground" />
				<span className="sr-only">Search</span>
				<input
					aria-activedescendant={
						results[selected] ? `search-${results[selected].id}` : undefined
					}
					aria-controls="search-results"
					aria-expanded="true"
					autoFocus
					className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
					onChange={(event) => {
						setQuery(event.target.value);
						setActive(0);
					}}
					onKeyDown={(event) => {
						if (event.key === "ArrowDown") {
							event.preventDefault();
							setActive((selected + 1) % Math.max(results.length, 1));
						} else if (event.key === "ArrowUp") {
							event.preventDefault();
							setActive(
								(selected - 1 + results.length) % Math.max(results.length, 1),
							);
						} else if (event.key === "Enter" && results[selected]) {
							event.preventDefault();
							go(results[selected]);
						}
					}}
					placeholder="Search guides, APIs, options…"
					role="combobox"
					value={query}
				/>
			</label>
			<ul
				className="max-h-[60vh] overflow-y-auto p-2"
				id="search-results"
				role="listbox"
			>
				{results.length === 0 ? (
					<li className="px-3 py-6 text-center text-sm text-muted-foreground">
						{loading ? "Searching…" : `No results for “${query}”`}
					</li>
				) : null}
				{results.map((entry, index) => (
					<li
						aria-selected={index === selected}
						className={cn(
							"flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm",
							index === selected && "bg-accent",
						)}
						id={`search-${entry.id}`}
						key={entry.id}
						onClick={() => {
							go(entry);
						}}
						onPointerMove={() => {
							setActive(index);
						}}
						role="option"
					>
						{entry.hash === undefined ? (
							<FileText className="size-4 shrink-0 text-muted-foreground" />
						) : (
							<Hash className="size-4 shrink-0 text-muted-foreground" />
						)}
						<span className="truncate">{entry.title}</span>
						<span className="ml-auto shrink-0 text-xs text-muted-foreground">
							{entry.context}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}
