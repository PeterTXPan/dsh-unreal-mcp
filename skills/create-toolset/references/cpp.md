# C++ Toolsets

## Structure

- Derive from `UToolsetDefinition` in
  `ToolsetRegistry/ToolsetDefinition.h`.
- Keep one Toolset class per `.h`/`.cpp` pair.
- Mark exposed static methods with `UFUNCTION(meta = (AICallable))`.
- Keep private helpers static but omit `AICallable`.
- Follow the module export and `UCLASS` conventions used by a nearby Toolset.

```cpp
USTRUCT(BlueprintType)
struct FMyThingInfo
{
    GENERATED_BODY()

    /** Value in the inclusive range 0..1. */
    UPROPERTY(meta = (ClampMin = "0.0", ClampMax = "1.0"))
    float Thinginess = 0.0f;
};

/** Queries and updates MyThing objects in the current level. */
UCLASS(BlueprintType, MinimalAPI)
class UMyToolset : public UToolsetDefinition
{
    GENERATED_BODY()

public:
    /** Returns things whose names contain the pattern. */
    UFUNCTION(meta = (AICallable), Category = "MyToolset")
    static TArray<UMyThing*> FindThings(const FString& NamePattern);
};
```

## Registration

Register and unregister the Toolset with its owning module. Confirm the exact
pattern in nearby UE code before editing because plugin ownership and module
lifetime vary.

```cpp
void FMyToolsetModule::StartupModule()
{
    UToolsetRegistry::RegisterToolsetClass(UMyToolset::StaticClass());
}

void FMyToolsetModule::ShutdownModule()
{
    UToolsetRegistry::UnregisterToolsetClass(UMyToolset::StaticClass());
}
```

## Errors

For invalid input or failed preconditions, raise a script error and return a
null/default value immediately. Do not return the error as normal tool data.

```cpp
if (NamePattern.IsEmpty())
{
    UKismetSystemLibrary::RaiseScriptError(
        EScriptExceptionType::Error,
        TEXT("NamePattern must not be empty."));
    return {};
}
```

## Async tools

Use synchronous tools unless the operation must wait for Editor state, capture,
compilation, or another long-running result. Async methods return an existing
`UToolCallAsyncResult` subclass where possible and call `SetValue()` or
`SetError()` exactly once. Read nearby async Toolsets before defining a new
result class.

## Custom JSON converters

`ToolsetRegistry` already handles ordinary UE types. Add a
`FToolsetJsonConverter` only for a demonstrated schema problem, and first check
the existing color, UObject reference, and transform converters. Register a
custom converter with the same lifetime as its Toolset.
