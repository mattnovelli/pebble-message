# RePebble Documentation Reference

## Primary Source

All Pebble SDK documentation is indexed at:
**https://developer.repebble.com/llms.txt**

This is a machine-readable index of every documentation page. Fetch it to discover the correct URL for any API, guide, or tutorial, then fetch that specific page for full details.

## Common Lookup Patterns

| Task                                         | Search llms.txt for                              | Then fetch                                                                                |
| -------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| AppMessage / watch-phone communication       | "Sending and Receiving Data", "AppMessage"       | guides/communication/sending-and-receiving-data.md, docs/c/Foundation/AppMessage/index.md |
| PebbleKit JS companion logic                 | "PebbleKit JS"                                   | guides/communication/using-pebblekit-js.md, docs/pebblekit-js/Pebble.md                   |
| UI layers and menus                          | "Layers", "MenuLayer"                            | guides/user-interfaces/layers.md, docs/c/User_Interface/Layers/MenuLayer/index.md         |
| App configuration pages                      | "App Configuration"                              | guides/user-interfaces/app-configuration.md                                               |
| Images, fonts, resources                     | "App Resources", "Images", "Fonts"               | guides/app-resources.md, guides/app-resources/images.md                                   |
| Platform-specific builds                     | "Building for Every Pebble", "Platform-specific" | guides/best-practices/building-for-every-pebble.md                                        |
| Animations and graphics                      | "Animations", "Drawing Primitives"               | guides/graphics-and-animations.md                                                         |
| Events (buttons, dictation, health, sensors) | "Events and Services", "Dictation", "Buttons"    | guides/events-and-services.md                                                             |
| Debugging compile/runtime issues             | "Debugging", "Common Runtime Errors"             | guides/debugging.md                                                                       |
| Hardware capabilities and screen sizes       | "Hardware Information"                           | guides/tools-and-resources/hardware-information.md                                        |
| Alloy (JS-first apps)                        | "Alloy", "Getting Started with Alloy"            | guides/alloy.md, guides/alloy/getting-started.md                                          |
| Timeline pins and subscriptions              | "Pebble Timeline", "Creating Pins"               | guides/pebble-timeline.md                                                                 |

## Workflow

1. Identify what you need (API name, feature domain, or error message).
2. Fetch `https://developer.repebble.com/llms.txt` — scan for matching entries.
3. Fetch the specific `.md` URL to get implementation details and code samples.
4. Apply patterns from SKILL.md (project conventions) on top of official docs.
