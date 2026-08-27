# Python Toolsets

## API coverage

Search the generated stub at
`<project>/Intermediate/PythonStub/unreal.py` for the required classes and
methods. If it does not exist, Python Developer Mode must be enabled and the
Editor restarted before relying on stub-based design. This changes local project
settings and therefore requires user authorization.

## Structure

- Decorate the class with `@unreal.uclass()` and inherit from
  `unreal.ToolsetDefinition`.
- Keep one Toolset class per Python file.
- Put `@toolset_registry.tool_call` immediately above `@staticmethod` for each
  exposed method.
- Give every parameter and return a standard Python type annotation. Schema
  generation depends on these annotations.
- Keep private static helpers unregistered and prefix their names with `_`.

```python
@unreal.uclass()
class MyToolset(unreal.ToolsetDefinition):
    """Queries and updates MyThing objects in the current level."""

    @toolset_registry.tool_call
    @staticmethod
    def find_things(name_pattern: str) -> list[unreal.Object]:
        """Returns things whose names contain the pattern."""
        if not name_pattern:
            raise ValueError("name_pattern must not be empty.")
        ...
```

Use standard annotations such as `list[str]` and `dict[str, str]`, not
`unreal.Array[...]`. Raise a Python exception when a tool cannot complete; do
not return an error string as successful data.

## Registration

Python Toolsets do not register automatically. Add the class to the owning
plugin's existing registration path, typically through a package imported by
`init_unreal.py`:

```python
def register_toolsets():
    unreal.ToolsetRegistry.register_toolset_class(MyToolset)

def unregister_toolsets():
    unreal.ToolsetRegistry.unregister_toolset_class(MyToolset)
```

Follow the owning plugin's established registration and teardown pattern.

## Reload

The Editor does not automatically reload edited Python Toolsets. When the user
has authorized Python Remote Execution, reload the owning package with the
ToolsetRegistry test helper, then rediscover Automation tests with
`force_rediscover=true`. Do not enable Remote Execution silently; it changes the
Editor security surface.
