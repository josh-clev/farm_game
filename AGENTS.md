# Efficient Codex Workflow

* Cybersecurity: Ensure no sensitive or personal information is contained within any files in this project. It will be publicly hosted on GitHub.
* The project you are working in is a game running from an HTML index file, with supporting assets and JavaScript files. Use a folder and file structure that is neat and tidy, as well as effective.
* Make the minimum targeted edits needed to satisfy the task. Do not refactor, reformat, rename, or alter unrelated code unless the task requires it.
* Inspect the relevant files before editing and preserve existing project conventions.
* Prefer existing project utilities, patterns, and dependencies over adding new ones.
* Run only the tests, linters, builds, or checks that cover code changed by the task or behavior that could reasonably have been affected. Avoid broad test suites when a focused check is sufficient.
* Do not rerun checks that have already passed unless later changes could affect their result.
* Keep tool output and investigation focused: search targeted paths first and avoid reading large unrelated files.
* Summarize changed files and the verification performed; call out any validation not run and why.

## Runtime Performance

* Keep game performance and perceived responsiveness in mind for every gameplay or rendering change, especially on lower-powered devices.
* Avoid work in per-frame or per-entity loops when it can be cached, batched, precomputed, or updated only when state changes.
* Avoid unnecessary canvas redraws, DOM updates, allocations, image decoding, and repeated layout/style recalculation during active play.
* Preserve or add asset caching, sprite reuse, and bounded collections; check for memory growth when adding effects, timers, listeners, or generated assets.
* For performance-sensitive changes, run a focused validation that covers frame/render behavior and report any profiling or device testing that was not possible.

## Completion And Commits

* After completing a requested change, commit the relevant changes to Git with a concise summary in the commit message unless the user explicitly asks not to commit.
* Do not include unrelated user changes in the commit, and do not rewrite or discard them.
* The final response must include the commit identifier, a one-sentence summary, and a short dot-point description of the changes and verification performed.
* 
## iPhone & iPad App Compatibility

This game is intended to become a full-screen, installable iOS/iPadOS app, not a browser-based website. Develop the UI with this final environment in mind, even while testing in a desktop browser.

- Design responsive layouts for iPhones and iPads using Flexbox, Grid, relative sizing, and `clamp()`.
- Adapt UI arrangements to different aspect ratios rather than scaling everything proportionally.
- Preserve sprite/image proportions; never stretch assets.
- Prevent overlapping, clipping, off-screen elements, and unintended scrolling.
- Design for full-screen, edge-to-edge display without browser navigation bars.
- Respect iOS safe areas (notches, Dynamic Island, home indicator). Backgrounds may extend edge-to-edge, but important controls must remain in safe areas.
- Keep text readable and touch controls appropriately sized.
- Support intended screen orientations and adjust layouts accordingly.
- Avoid browser-dependent functionality that would break inside a packaged iOS app.
- Maintain compatibility with eventual native packaging (e.g. Capacitor) without unnecessarily introducing native dependencies.

**Testing:**
- For UI changes, test 390×844 (iPhone) and 820×1180 (iPad).
- For major UI changes, additionally test 375×667, 430×932, 744×1133, and 1024×1366.
- Use Playwright screenshots where available, preferably using WebKit.
- Test using full-screen viewport dimensions without desktop browser chrome.
- Inspect affected screenshots and fix layout problems.
- Avoid excessive testing for changes unrelated to UI.
- Browser emulation does not replace eventual testing inside the actual iOS app.
- Never claim unperformed tests were completed.

### Responsive Playwright checks
- Install development dependencies with `npm install`, then install the WebKit browser once with `npx playwright install webkit`.
- Run the focused responsive suite with `npm test`.
- The suite uses full-screen Playwright viewports for iPhone 390×844 and iPad 820×1180, the additional listed portrait sizes, and iPhone/iPad landscape sizes. It checks page overflow and key menu/game element visibility, then writes reusable screenshots to `test-results/responsive/`.
- The current baseline flags the Orders panel as outside the viewport in portrait viewports; keep this check visible so a later layout change can confirm it is fixed.
- Screenshots emulate viewport dimensions without desktop browser chrome. They are a development approximation; verify the packaged app on real iOS/iPadOS devices later.
- The test server serves the existing static game files only. Keep the Playwright setup browser based and compatible with a future Capacitor wrapper; do not add native packaging dependencies here.
