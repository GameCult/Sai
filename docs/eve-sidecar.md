# Sai Eve Sidecar

Sai owns retained Ink playback sessions behind the Eve plugin ABI. The sidecar
loads compiled Ink with `inkjs`, applies story commands, and projects the live
session through Sai's `gamecult.eve.surface.v1` module.

The sidecar does not render a runtime, accept provider commands on a provider's
behalf, or execute Norn or TeX semantics. It advertises `norn.graph` and
`tex.math` only as independent optional nested plugins.

## Transport

`src/eve-sidecar.cjs` is a long-running NDJSON process. Each input line is a
`gamecult.eve.plugin_abi.request.v1`; each output line is the correlated
`gamecult.eve.plugin_abi.response.v1`.

The retained operations are:

- `open`: create or replace a named Ink session and advance it to its first line.
- `apply`: apply `story.continue`, `story.choose`, or `story.jump` to that session.
- `jump`: exercise a second retained transition without duplicating the ABI's
  single `apply` conformance contract.
- `project`: derive a Sai Eve surface from current session state.
- `validate`: identify Sai-owned and foreign component kinds.
- `describe`: report the sidecar's owned and optional capabilities.

Run the owner-side conformance witness with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run-eve-plugin-witness.ps1
```
