# Toolset testing

Every exposed tool needs at least one success-path test and a separate test for
each explicit error condition. Tests must verify the resulting UE state or
returned data, not only that a call completed.

## C++

Use the Automation Spec conventions established by nearby Toolsets. Compile
with the discovered Live Coding Toolset before running tests, read the completed
diagnostics, and fix compile errors before proceeding.

```cpp
BEGIN_DEFINE_SPEC(
    FMyToolsetSpec,
    "AI.MyToolset",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::ProductFilter)
END_DEFINE_SPEC(FMyToolsetSpec)
```

Use `AddExpectedError` for each raised script error and assert both matching and
empty-result behavior where those are distinct contracts.

## Python

Extend the existing `ToolCallTestCase` used by nearby Python Toolsets. Use its
runtime-error assertion helper for expected failures. Reload the owning Python
package before rediscovering tests.

## Live Editor

When the Editor is available, follow Tool Search rather than assuming fixed
schemas:

1. Discover the Automation Test Toolset and inspect its current tools.
2. Run test discovery before listing or executing tests.
3. Confirm the intended test paths are present.
4. Run only the authorized test filter.
5. Poll until a terminal state, then retrieve detailed results.
6. Rediscover with the appropriate refresh option after Python reloads.

Issue these UE calls sequentially. If a compile or test call times out, inspect
its state before retrying.

## Command line

When no Editor session is available, use the platform's `UnrealEditor-Cmd`
binary with the target `.uproject`, an exact test filter, `-Unattended`, and
`-NullRHI`. Confirm the command with the user before launching a headless Editor
because it can be expensive and may write project state.

## Final review

Before completion, check for duplicated tools, inconsistent parameter types,
missing CRUD counterparts, incomplete error tests, registration or teardown
gaps, and documentation that merely restates signatures. Verify that the live
Toolset catalog exposes the expected methods when an Editor is available.
