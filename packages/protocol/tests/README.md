# Cross-Language Test Fixtures

This directory contains test fixtures for verifying game logic implementations across different programming languages.

## Purpose

When implementing the Siege MOBA game server in any language (TypeScript, Rust, Go, etc.), all implementations **must** produce identical results for the same inputs. These fixtures define the expected behavior and serve as a verification suite.

## Directory Structure

```
tests/
├── fixtures/           # JSON fixture files (language-agnostic)
│   ├── damage_calculations.json
│   ├── stat_scaling.json
│   ├── experience_levels.json
│   ├── respawn_times.json
│   ├── cooldown_reduction.json
│   ├── gold_calculations.json
│   ├── crowd_control.json
│   ├── movement.json
│   ├── ability_scaling.json
│   ├── vision.json
│   └── index.json      # Fixture manifest
├── typescript/         # TypeScript verification tests
│   └── verify.test.ts
├── rust/               # Rust verification tests (to be added)
│   └── verify_test.rs
└── go/                 # Go verification tests (to be added)
    └── verify_test.go
```

## Fixture Format

Each fixture file follows this structure:

```json
{
  "$schema": "./fixture.schema.json",
  "name": "Fixture Name",
  "description": "What this fixture tests",
  "tolerance": 0.01,

  "test_category": {
    "description": "Formula or logic being tested",
    "cases": [
      { "input1": 100, "input2": 50, "expected": 150 }
    ]
  }
}
```

### Tolerance

- `tolerance: 0.01` - Default for most floating-point calculations
- `tolerance: 0` - For integer results (levels, XP thresholds)
- `tolerance: 0.001` - For percentage calculations

## Running Tests

### TypeScript (Bun)

```bash
cd packages/protocol
bun test
```

### Rust (to be implemented)

```bash
cd packages/protocol/tests/rust
cargo test
```

### Go (to be implemented)

```bash
cd packages/protocol/tests/go
go test
```

## Adding New Implementations

1. Create a test file in the appropriate language directory
2. Load the JSON fixtures
3. Implement each formula/calculation
4. Assert results match within tolerance

Example verification structure:

```typescript
// TypeScript
for (const testCase of fixtures.cases) {
  const result = calculateDamage(testCase.input);
  expect(Math.abs(result - testCase.expected)).toBeLessThanOrEqual(tolerance);
}
```

```rust
// Rust
for test_case in fixtures.cases {
    let result = calculate_damage(test_case.input);
    assert!((result - test_case.expected).abs() <= tolerance);
}
```

```go
// Go
for _, tc := range fixtures.Cases {
    result := calculateDamage(tc.Input)
    assert.InDelta(t, tc.Expected, result, tolerance)
}
```

## Formula Reference

See [/packages/protocol/docs/formulas.md](../docs/formulas.md) for detailed documentation of all formulas that must be implemented identically.

## Coverage

The fixtures cover:

| Area | Fixture File | Formulas |
|------|--------------|----------|
| Damage | damage_calculations.json | Resist reduction, armor pen, magic pen |
| Stats | stat_scaling.json | Base stats, attack speed, final stats |
| XP/Levels | experience_levels.json | Level thresholds, XP sharing |
| Respawn | respawn_times.json | Death timer calculation |
| Cooldowns | cooldown_reduction.json | Ability haste conversion |
| Gold | gold_calculations.json | Kill gold, bounties, assists |
| CC | crowd_control.json | Tenacity, CC status flags |
| Movement | movement.json | Slows, position updates |
| Abilities | ability_scaling.json | Stat ratios, scaling |
| Vision | vision.json | Fog of war, sight ranges |

## Verification Requirements

All implementations must:

1. Pass 100% of fixture test cases
2. Match expected values within specified tolerance
3. Handle edge cases (negative values, zero, maximum values)
4. Produce deterministic results (no randomness in calculations)

A passing verification suite is **required** before any server implementation can be deployed to production.
