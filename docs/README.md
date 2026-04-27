# Pebble Message OAuth Site

This folder contains the hosted OAuth receiver/config website for the Pebble app.

## Publish This Folder!

1. In GitHub repository settings, open Pages.
2. Set source to branch `main` and folder `/docs`.
3. Save and wait for deploy.

Expected URL for this repository:

- https://mattnovelli.github.io/pebble-message/

## App Wiring

Set the same URL in these places:

- Azure Entra app Redirect URI (SPA)
- `myfirstproject/src/pkjs/index.js` as `redirectUri` (and `CONFIG_PAGE_URL`)

The hosted page receives OAuth callbacks, exchanges auth code for tokens, and returns settings to Pebble via `pebblejs://close#...`.
