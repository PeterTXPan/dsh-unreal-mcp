# DSH and Unreal MCP setup

Use this guide only when the project is not already connected.

## 1. Enable Unreal plugins

Enable **Unreal MCP** (`ModelContextProtocol`) and **All Toolsets**
(`AllToolsets`) in the disposable test project, then restart the Editor when
prompted. `ToolsetRegistry` is enabled as a dependency.

The equivalent `.uproject` entries are:

```json
{
  "Name": "ModelContextProtocol",
  "Enabled": true
},
{
  "Name": "AllToolsets",
  "Enabled": true
}
```

`ModelContextProtocol` provides the HTTP MCP server. `AllToolsets` is the
editor-only aggregator that provides the default toolsets. A reviewed project
can enable selected toolset plugins instead.

Do not silently edit `.uproject`. Confirm the exact descriptor and obtain
authorization because changing plugin entries persists project state.

## 2. Configure Tool Search and server startup

Tool Search should remain enabled. Its default setting makes `tools/list`
return `list_toolsets`, `describe_toolset`, and `call_tool` instead of hundreds
of schemas.

Start on demand from the Unreal Editor console:

```text
ModelContextProtocol.StartServer
ModelContextProtocol.StartServer 8000
```

The Output Log must contain `Created new HttpListener on 127.0.0.1:<port>`.
`All listeners started` alone is not proof when an earlier line reports a bind
failure.

For persistent per-user startup, use **Editor Preferences → General → Model
Context Protocol → Auto Start Server**, or add this local Editor setting:

```text
<Project>/Saved/Config/<Platform>Editor/EditorPerProjectUserSettings.ini
```

```ini
[/Script/ModelContextProtocolEngine.ModelContextProtocolSettings]
bAutoStartServer=True
ServerPortNumber=8000
ServerUrlPath=/mcp
bEnableToolSearch=True
```

The Saved setting is per-user and normally should not be committed. A
command-line launch can instead use `-ModelContextProtocolStartServer` and
`-ModelContextProtocolPort=N`.

## 3. Point the DSH Bundle at the same endpoint

The Bundle and DSH's in-box MCP Client row use
`http://127.0.0.1:8000/mcp` by default:

```bash
dsh --profile web
```

If UE is intentionally configured with a different loopback port, override
both values with `DSH_UNREAL_MCP_URL`.

The Bundle accepts plain HTTP only on loopback. It does not require or consume
Claude Code's `.mcp.json`; its Cordis patch owns the DSH client configuration.
If UE uses a custom URL path, include that exact path in
`DSH_UNREAL_MCP_URL`.

## 4. Verify

From an installed package or the Bundle checkout, run:

```bash
dsh-unreal-mcp-diagnose \
  --endpoint=http://127.0.0.1:8000/mcp \
  --cwd="/absolute/path/to/MyProject/Content"
```

Success requires:

- the intended `.uproject` or Engine source root is detected;
- MCP initialization succeeds;
- all three Tool Search meta-tools are present;
- Unreal returns a non-empty ToolsetRegistry catalog.

Run DSH from the intended project/workspace root so the session receives the
correct UE context.
