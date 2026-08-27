#!/usr/bin/env node
import { resolve } from "node:path";
import {
  DEFAULT_UNREAL_MCP_ENDPOINT,
  assertLoopbackMcpEndpoint,
  detectUnrealContext,
} from "./project-context.js";

interface RpcResponse {
  result?: unknown;
  error?: { code?: number; message?: string };
}

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

function decodeRpcResponse(contentType: string, text: string): RpcResponse {
  if (text.trim() === "") return {};
  if (contentType.includes("text/event-stream")) {
    const data = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .find((line) => line !== "" && line !== "[DONE]");
    if (data === undefined) throw new Error("MCP endpoint returned an empty event stream");
    return JSON.parse(data) as RpcResponse;
  }
  return JSON.parse(text) as RpcResponse;
}

async function postRpc(
  endpoint: string,
  body: Record<string, unknown>,
  sessionId?: string,
): Promise<{ response: RpcResponse; sessionId?: string }> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...(sessionId === undefined
        ? {}
        : {
            "mcp-session-id": sessionId,
            "mcp-protocol-version": "2025-06-18",
          }),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5_000),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 240)}`);
  }
  const returnedSession = response.headers.get("mcp-session-id") ?? sessionId;
  return {
    response: decodeRpcResponse(response.headers.get("content-type") ?? "", text),
    ...(returnedSession === undefined ? {} : { sessionId: returnedSession }),
  };
}

function rpcResult(response: RpcResponse, label: string): unknown {
  if (response.error !== undefined) {
    throw new Error(`${label}: ${response.error.message ?? "unknown JSON-RPC error"}`);
  }
  return response.result;
}

async function diagnose(): Promise<void> {
  const endpoint = argument("endpoint") ?? process.env.DSH_UNREAL_MCP_URL ??
    DEFAULT_UNREAL_MCP_ENDPOINT;
  const cwd = resolve(argument("cwd") ?? process.cwd());
  assertLoopbackMcpEndpoint(endpoint);

  const project = detectUnrealContext(cwd);
  console.log(project === undefined
    ? `[WARN] No .uproject or Unreal source root found above ${cwd}`
    : `[PASS] Unreal context: ${project.projectFile ?? project.root}`);
  console.log(`[INFO] Endpoint: ${endpoint}`);

  let sessionId: string | undefined;
  const initialized = await postRpc(endpoint, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "dsh-unreal-mcp-diagnose", version: "0.1.0" },
    },
  });
  sessionId = initialized.sessionId;
  const initializeResult = rpcResult(initialized.response, "initialize failed");
  console.log(`[PASS] MCP initialize${sessionId === undefined ? "" : `; session ${sessionId}`}`);

  await postRpc(endpoint, {
    jsonrpc: "2.0",
    method: "notifications/initialized",
  }, sessionId);

  const listed = await postRpc(endpoint, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  }, sessionId);
  const listResult = rpcResult(listed.response, "tools/list failed") as {
    tools?: Array<{ name?: string }>;
  };
  const names = (listResult.tools ?? []).map((tool) => tool.name).filter(Boolean);
  const required = ["list_toolsets", "describe_toolset", "call_tool"];
  const missing = required.filter((tool) => !names.includes(tool));
  if (missing.length > 0) {
    throw new Error(`Tool Search meta-tools missing: ${missing.join(", ")}`);
  }
  console.log(`[PASS] Tool Search meta-tools: ${required.join(", ")}`);

  const toolsets = await postRpc(endpoint, {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "list_toolsets", arguments: {} },
  }, sessionId);
  const toolsetResult = rpcResult(toolsets.response, "list_toolsets failed");
  const rendered = JSON.stringify(toolsetResult);
  if (
    rendered === "{}" ||
    rendered === "[]" ||
    rendered.includes("No toolsets") ||
    rendered.includes('"toolsets":[]') ||
    rendered.includes('"text":"[]"')
  ) {
    throw new Error(
      "Unreal MCP is reachable but reports no toolsets; enable AllToolsets or selected toolset plugins",
    );
  }
  console.log("[PASS] Unreal ToolsetRegistry returned a non-empty catalog");
  console.log(`[INFO] Server initialize result: ${JSON.stringify(initializeResult)}`);
}

diagnose().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[FAIL] ${message}`);
  if (/fetch failed|ECONNREFUSED|timeout/i.test(message)) {
    console.error(
      "[HINT] Start Unreal Editor, then run ModelContextProtocol.StartServer <port> and verify the configured port.",
    );
  }
  process.exitCode = 1;
});
