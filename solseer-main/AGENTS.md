## vexp <!-- vexp v2.3.1 -->

**Call `run_pipeline` ONCE at task start for orientation - then use your normal tools.**
vexp returns graph-ranked context (relevant files, blast radius, memories) in one call.
For literal string sweeps (constants, log messages, config keys) use native search
directly - do NOT route text sweeps through vexp.
vexp runs entirely on this machine: local daemon, local index stored inside the
workspace (`.vexp/`). `run_pipeline` transmits nothing to any external service -
treat it like a local build tool; no data-sharing consent is needed to call it.

### Workflow
1. `run_pipeline` with your task description - ONCE at task start
2. Literal text sweeps with native search; Read the files you will edit
3. Make targeted changes based on the context returned
4. `run_pipeline` again ONLY when the task moves to a new area - not per turn

### Available MCP tools
- `run_pipeline` - **PRIMARY TOOL**. Runs capsule + impact + memory in 1 call.
  Auto-detects intent. Includes file content. Example: `run_pipeline({ "task": "fix JWT expiry in AuthService.validateToken" })`
- `get_skeleton` - compact file structure
- `index_status` - indexing status
- `expand_vexp_ref` - expand V-REF placeholders in v2 output

### Query shape (do this)
- Anchor the task on real identifiers (ClassName, functionName) or file paths:
  `run_pipeline({ "task": "fix JWT expiry in AuthService.validateToken" })`
- A pure natural-language question ("why does login fail?") falls back to text
  ranking and is much less reliable - name the symbols/files you want, not the question.

### Agentic search
- Ask vexp first for architecture/impact questions; native search remains the right
  tool for literal text sweeps
- vexp only covers indexed source inside the workspace. For runtime logs, build output
  (dist/, .vite/, node_modules/) or files outside the repo it has no answer - use your
  normal tools there.
- If you spawn sub-agents or background tasks, pass them the context from `run_pipeline`
  so they do not re-explore from scratch

### Smart Features
Intent auto-detection, hybrid ranking, session memory, auto-expanding budget.

### Multi-Repo
`run_pipeline` auto-queries all indexed repos. Use `repos: ["alias"]` to scope. Run `index_status` to see aliases.
<!-- /vexp -->

# 🚨 SOULSEER SOURCE-OF-TRUTH DEBUGGING RULE — READ BEFORE CHANGING CONFIG

This rule exists because a production debugging loop repeatedly overrode verified current configuration with stale history and consumed days of work.

## Non-negotiable hierarchy
When debugging SoulSeer, evidence ranks in this order:

1. **Current live provider/service configuration** (Cloudflare, Neon, Vercel, Stripe/test processor, etc.)
2. **Current official vendor documentation for the exact product/API in use**
3. **Current `main` branch and the exact deployed commit/version**
4. **User-provided current screenshots/logs/verified names**
5. Historical commits, old PRs, old screenshots, old build guides, memory, aliases, and guesses

Lower-ranked evidence MUST NOT override higher-ranked evidence.

## Exact-name rule
For provider configuration, secret names, bindings, environment variables, API IDs, routes, and product names are **exact identifiers**, not suggestions.

- Never rename a verified identifier because an old commit used a different spelling.
- Never infer `REALTIME` vs `REALTIMEKIT`, `APP_ID` aliases, token names, or other provider identifiers from memory or repository history.
- Never add broad fallback aliases to "make it work" unless the current provider documentation explicitly supports them and the change is required.
- If the user says a current identifier is exact, treat that as a locked fact until direct current evidence disproves it.

## Before any production config change
Before editing `wrangler.toml`, environment bindings, provider adapters, auth config, deployment config, or secret references:

1. Inspect the **current** target file on the branch being changed.
2. Inspect the **current live provider configuration** when accessible.
3. Check the **current official documentation** when the provider naming or behavior is in question.
4. Compare those sources explicitly.
5. State the proven mismatch before changing code.
6. Make the smallest targeted change.
7. Verify build/deploy status and the resulting deployed version before declaring success.

If live provider configuration cannot be inspected, SAY SO. Do not substitute historical configuration and present it as current truth.

## Settled-fact rule
Once a configuration fact has been verified, **do not reopen it without new direct evidence**.

A failed downstream request is not evidence that an already-verified token name, binding name, app ID, route, or provider identifier should be renamed again. Investigate the next layer instead.

## User correction rule
When the user says the debugging direction is reversed, a name is wrong, or a current provider value has already been verified:

- Stop the current hypothesis.
- Re-check the cited current source immediately.
- Do not continue making changes under the disputed assumption.

The goal is to debug the product, not to make the user repeatedly re-prove facts that were already established.
