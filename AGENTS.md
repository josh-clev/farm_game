# Efficient Codex Workflow

- Cybersecurity: Ensure no sensitive or personal information is contained within any files in this project. It will be publicly hosted on GitHub.

- The project you are working in is a game running from an HTML index file, with supporting assets and JavaScript files. Use a folder and file structure that is neat and tidy, as well as effective.

- Make the minimum targeted edits needed to satisfy the task. Do not refactor, reformat, rename, or alter unrelated code unless the task requires it.
- Inspect the relevant files before editing and preserve existing project conventions.
- Prefer existing project utilities, patterns, and dependencies over adding new ones.
- Run only the tests, linters, builds, or checks that cover code changed by the task or behavior that could reasonably have been affected. Avoid broad test suites when a focused check is sufficient.
- Do not rerun checks that have already passed unless later changes could affect their result.
- Keep tool output and investigation focused: search targeted paths first and avoid reading large unrelated files.
- Summarize changed files and the verification performed; call out any validation not run and why.

## Runtime Performance

- Keep game performance and perceived responsiveness in mind for every gameplay or rendering change, especially on lower-powered devices.
- Avoid work in per-frame or per-entity loops when it can be cached, batched, precomputed, or updated only when state changes.
- Avoid unnecessary canvas redraws, DOM updates, allocations, image decoding, and repeated layout/style recalculation during active play.
- Preserve or add asset caching, sprite reuse, and bounded collections; check for memory growth when adding effects, timers, listeners, or generated assets.
- For performance-sensitive changes, run a focused validation that covers frame/render behavior and report any profiling or device testing that was not possible.

## Completion And Commits

- After completing a requested change, commit the relevant changes to Git with a concise summary in the commit message unless the user explicitly asks not to commit.
- Do not include unrelated user changes in the commit, and do not rewrite or discard them.
- The final response must include the commit identifier, a one-sentence summary, and a short dot-point description of the changes and verification performed.
