# Unreal MCP operations and troubleshooting

## Editor console commands

| Command | Purpose |
| --- | --- |
| `ModelContextProtocol.StartServer [port]` | Start the MCP server, optionally overriding the port. |
| `ModelContextProtocol.StopServer` | Stop the server and close its sessions. |
| `ModelContextProtocol.RefreshTools` | Re-poll ToolsetRegistry after plugins or toolsets change. |
| `ModelContextProtocol.GenerateClientConfig <Client\|All>` | Generate configs for supported clients; DSH uses this Bundle instead. |
| `Log LogModelContextProtocol Verbose` | Increase Unreal MCP Output Log detail for diagnosis. |

Relevant launch flags are `-ModelContextProtocolStartServer` and
`-ModelContextProtocolPort=N`.

## State gate before a UE operation

Record only what the current task needs:

```text
Current Level and PIE state:
Exact object or asset paths:
Expected starting state:
Allowed operation and frozen values:
Expected final state:
Dirty/save/compile/test expectation:
Recovery point:
```

Labels, display names, and Content Browser selection are not stable identities.
Resolve a unique object or asset path before mutation. If multiple candidates
match, stop and ask rather than picking one.

## UE risk mapping

| UE action | Required handling |
| --- | --- |
| Tool Search and read-only inspection | Stay within the requested project and report actual tool evidence. |
| Create or edit a frozen Actor/asset/property | A clear user request can authorize the exact change; verify starting and final state. |
| Save, compile, PIE transition | Confirm it is part of the requested workflow, wait for completion, and inspect the resulting state. |
| Move, rename, delete, bulk/cross-asset change | Confirm exact targets and recovery point; explain impact if the request did not already make it explicit. |
| Arbitrary Python, project/plugin settings, or source changes | Treat as high impact; show scope and obtain explicit authorization before execution. |

DSH's outer approval mechanism may still prompt for `call_tool`. This table does
not replace or modify that mechanism, and a dispatcher approval does not expand
the user's requested UE scope.

## Non-idempotent result recovery

When a response is lost, times out, or is ambiguous, query before retrying:

| Operation | Query before any retry |
| --- | --- |
| Spawn, duplicate, or add component | Search by stable path/class and frozen values; prove whether zero, one, or multiple results exist. |
| Create, move, or rename asset | Query both old and intended paths plus package dirty state. |
| Change property or transform | Read the exact target property/transform and compare with the frozen value. |
| Blueprint/material/graph edit | Inspect graph or structure, compile/validation status, and relevant errors. |
| Save | Check whether the intended package is still dirty and, when needed, reopen/requery it. |
| Compile or Live Coding | Read the completed status and diagnostics; do not start a second compile while one may be active. |
| Delete | Prove the exact target is absent and nearby frozen objects are unchanged; never blindly repeat. |
| PIE start/stop | Query actual PIE state before issuing another transition. |

Retry only when the query proves the first operation did not take effect and
the original authorization still covers the retry. If the state is mixed,
stop and report it; cleanup is a separate mutation.

## Failure matrix

| Symptom | Diagnosis and recovery |
| --- | --- |
| `unable to bind to 127.0.0.1:<port>` | Another process owns the port. Stop the old listener or choose a free port, then use the same endpoint in `DSH_UNREAL_MCP_URL`. |
| DSH reports connection refused or timeout | Confirm the Editor is running and the Output Log contains `Created new HttpListener` for the configured port/path. |
| Meta-tools are missing | Confirm Tool Search is enabled and DSH is connected to the intended endpoint; reconnect after configuration changes. |
| Tool Search exists but catalog is empty | Enable `AllToolsets` or selected toolset plugins, run `ModelContextProtocol.RefreshTools`, and reconnect. |
| Unknown tool or parameter | Re-run `describe_toolset`; pass the raw schema `tool_name` and exact current arguments. |
| Calls hang or fail intermittently | Inspect shader/C++/Blueprint compilation, asset loading, and PIE; wait for a settled state before another call. |
| Calls collide | Serialize every Unreal MCP call, including independent discovery and reads. This is a client/DSH behavior observation, not a Bundle scheduler. |
| New tool schema is stale after reload | Run `ModelContextProtocol.RefreshTools` and reconnect. New reflected `UFUNCTION` declarations require an Editor restart rather than Live Coding alone. |
| Correct-looking final text lacks Editor evidence | Treat the task as unverified; query the intended final UE state. |

Unreal MCP supports HTTP/SSE rather than stdio or WebSocket and is loopback-only
by default with no authentication layer. Do not expose it to a remote network.

## Responsibility boundary

If the endpoint, Skill, context, schema, or UE workflow rule is wrong, fix this
Bundle. If the same failure reproduces with a non-Unreal MCP server, record a
minimal reproduction for DSH or its MCP Client instead of adding a generic
context manager, scheduler, approval engine, retry layer, or proxy here.
