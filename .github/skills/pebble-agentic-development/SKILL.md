---
name: pebble-agentic-development
description: "Workflow skill for agentic Pebble smartwatch app development. Use when creating, modifying, or debugging Pebble C watch apps, PebbleKit JS companion logic, app resources, AppMessage contracts, configuration pages, or platform-specific behavior across basalt/chalk/emery/aplite/diorite. Uses RePebble llms.txt for live documentation lookup and proven patterns from pebble-message."
---

# Pebble Agentic Development

## Use This Skill When

- Building a new Pebble app or watchface.
- Adding features that touch `patch/src/c` and/or `patch/src/pkjs`.
- Changing AppMessage keys or payload schemas.
- Working on assets/resources, animations, or platform-specific UI behavior.
- Adding network-backed functionality in PKJS.
- Debugging cross-layer issues between watch app and phone companion.

## Core Rules

1. Treat `patch/build/**` as generated output. Never hand-edit generated files.
2. Edit source-of-truth files:
   - Watch app C: `patch/src/c/**`
   - Phone companion JS: `patch/src/pkjs/**`
   - Build config/resources: `patch/package.json`, `patch/wscript`, `patch/resources/**`
   - Hosted config/OAuth UI (if used): `docs/**`
3. Keep watch/phone message keys synchronized in source.
4. Prefer compact AppMessage payloads and explicit validation for inbound data.
5. Never log tokens, secrets, or raw user message content.

## Documentation Lookup via llms.txt

**Primary source of truth for Pebble SDK documentation:**
`https://developer.repebble.com/llms.txt`

### How to Use

1. **Fetch the index** — When you need SDK documentation for a feature, fetch `https://developer.repebble.com/llms.txt` and search its contents for relevant page URLs and descriptions.
2. **Fetch the specific page** — Once you identify the right `.md` URL from the index, fetch that page directly (e.g., `https://developer.repebble.com/guides/communication/sending-and-receiving-data.md`) to get full API details and examples.
3. **Prefer deep links** — The llms.txt organizes pages by section (Tutorials, Guides, Documentation/C SDK, Documentation/Rocky.js, etc.). Jump straight to the relevant section.

### Section Quick Reference

Use these sections of llms.txt to find what you need:

| Need                                                   | llms.txt Section                                | Example URLs                                                                |
| ------------------------------------------------------ | ----------------------------------------------- | --------------------------------------------------------------------------- |
| How-to walkthroughs                                    | `## Tutorials`                                  | watchface-tutorial, alloy-watchface-tutorial                                |
| Feature guides (communication, UI, sensors, resources) | `## Guides`                                     | guides/communication/, guides/user-interfaces/, guides/events-and-services/ |
| C API reference                                        | `## Documentation > ### C SDK`                  | docs/c/Foundation/AppMessage/, docs/c/User_Interface/Layers/                |
| PebbleKit JS API                                       | `## Documentation > ### PebbleKit JavaScript`   | docs/pebblekit-js/Pebble.md                                                 |
| Rocky.js API                                           | `## Documentation > ### Rocky.js API`           | docs/rockyjs/                                                               |
| SDK setup and changelogs                               | `## Get the SDK`                                | sdk.md, sdk/changelogs/                                                     |
| Build tools and platform info                          | `## Guides > ### Build, refine, and debug apps` | guides/tools-and-resources/, guides/debugging/                              |

### When to Fetch Documentation

- **Before implementing a new feature** — fetch the relevant guide page to confirm API signatures, patterns, and platform constraints.
- **When debugging** — fetch the debugging guide or relevant API page to check correct usage.
- **When unsure about platform differences** — fetch hardware-information or building-for-every-pebble guides.
- **Do NOT fetch** for routine edits where you already have confirmed patterns from this project's source code.

## Standard Agentic Workflow

1. Identify app type and constraints.
   - App vs watchface
   - Native C SDK vs Alloy JS app
   - Online/offline requirements
2. **Look up relevant documentation** via llms.txt for unfamiliar APIs.
3. Confirm architecture split.
   - Watch responsibilities (`src/c`) vs phone responsibilities (`src/pkjs`)
   - AppMessage schema, status, and error behavior
4. Design data contract first.
   - Define keys, payload types, and validation rules
   - Include retry and auth-state semantics for network features
5. Implement by layer.
   - C UI/events/services first
   - PKJS handlers/network/storage second
   - Resources/config pages third
6. Validate on target platforms.
   - Successful path
   - At least one failure path
   - Cleanup paths (timers/sessions/memory)
7. Document outcomes.
   - Changed files
   - Manual test steps
   - Known limitations

## Proven Patterns From pebble-message

- C/PKJS dual-layer architecture with explicit AppMessage constants and handlers.
- Auth/network state mirrored to watch UI with a small state machine.
- User-facing status and error feedback with short actionable messages.
- Metadata-only logging in PKJS for security.
- Retry wrappers for transient network failures with bounded backoff.
- Single in-flight lock for token refresh to avoid race conditions.
- Platform-specific behavior guarded by compile-time macros such as `#ifdef PBL_COLOR`.
- Resource pipeline managed by `package.json`, not build artifact edits.
- Optional PKJS demo mode for screenshots/emulator workflows.

## Feature Checklists

### Communication and PKJS

- Define or extend message keys in both C and PKJS source.
- Validate inbound payload shape before use.
- Send explicit status and error events to watch.
- Handle no-network and auth-expired states deterministically.

### UI and Interaction

- Start with simple menu/layer patterns.
- Support round/color/legacy variants where relevant.
- Keep text short and readable for small displays.

### Resources and Animation

- Add resources through `package.json` media entries.
- Use platform-specific assets only when needed.
- Add fallback behavior if an animation/resource is unavailable.

### Events and Services

- Subscribe and unsubscribe correctly for event services.
- Free/destroy sessions, timers, and allocated memory in deinit paths.
- Keep sensor/background work battery-aware.

## Build and Debug Expectations

- Confirm working directory before running commands (workspace may switch between repo root and `patch/`).
- Build from `patch/` with Pebble SDK tooling.
- Verify both watch logs (C) and PKJS logs during debugging.

## Definition Of Done

- Source files are updated (not generated artifacts).
- App builds for required platforms.
- AppMessage contract is synchronized and tested.
- Failure modes (network/auth/invalid input) show user-visible feedback.
- Setup docs/config are updated when behavior changes.
