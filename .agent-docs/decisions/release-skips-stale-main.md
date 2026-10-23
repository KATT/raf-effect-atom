# A release run stops if `main` moved (agent, from raf-query)

- A release publishes to npm before it pushes `chore: release vX.Y.Z`. If `main` moves while it builds, the `--atomic` push is rejected after the packages are already on npm (raf-query shipped 0.5.4 that way, with no tag or commit).
- So `before:git:release` fetches `origin/main` after building and stops before publishing if it isn't `HEAD`. The workflow treats that stop as success; a later run releases everything. With commits pushed straight to `main`, start a release when nobody is pushing.
