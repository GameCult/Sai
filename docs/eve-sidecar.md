# Sai Eve Sidecar

Sai owns retained Ink playback sessions behind the Eve plugin ABI. The sidecar
loads compiled Ink with `inkjs`, applies story commands, and projects the live
session through Sai's `gamecult.eve.surface.v1` module.

The sidecar does not render a runtime, accept provider commands on a provider's
behalf, or execute Norn or TeX semantics. It advertises `norn.graph` and
`tex.math` only as independent optional nested plugins.

## Transport

`src/eve-cultnet-sidecar.cjs` is the runtime-independent service entry point.
It advertises a CultNet RUDP endpoint and accepts `cultnet.operation_request.v0`
envelopes whose MessagePack payload is a `gamecult.eve.plugin_abi.request.v1`.
Responses preserve both the CultNet message correlation and Eve ABI request ID.

`src/eve-sidecar.cjs` exposes the same handler through newline-delimited JSON
for local debugging. It is not the deployment transport.

The retained operations are:

- `open`: create or replace a named Ink session and advance it to its first line.
- `apply`: apply `story.continue`, `story.choose`, or `story.jump` to that session.
- `jump`: exercise a second retained transition without duplicating the ABI's
  single `apply` conformance contract.
- `project`: derive a Sai Eve surface from current session state.
- `validate`: identify Sai-owned and foreign component kinds.
- `describe`: report the sidecar's owned and optional capabilities.

Run the owner-side conformance witness with:

```sh
npm run check:eve-plugin
```

The witness starts the real CultNet service, invokes every fixture operation
through RUDP, and writes `artifacts/eve-plugin/runtime-witness.json`.
