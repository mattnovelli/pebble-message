# OAuth 2.0 Setup Guide for Microsoft Graph (GitHub Pages Receiver)

This project uses a hosted OAuth receiver page (GitHub Pages) instead of Pebble's legacy hosted receiver.

The flow is Authorization Code + PKCE with a hosted callback page, but token exchange and refresh are now handled in PebbleKit JS (PKJS), not in the browser page.

The hosted page now:

1. Starts Microsoft sign-in.
2. Receives the `code` callback.
3. Returns callback payload data to Pebble via `pebblejs://close#...`.

PKJS then redeems the code, stores tokens locally, and performs silent refresh directly against the token endpoint.

## Why This Changed

Pebble no longer provides a hosted OAuth receiver endpoint. The app therefore mirrors the approach used by projects such as Playback:

- Host a dedicated config/receiver page on GitHub Pages.
- Use that page URL as the Azure redirect URI.
- Open that page from `Pebble.openURL(...)`.

## Prerequisites

- Azure Active Directory (Entra ID) tenant access.
- A Microsoft 365 account allowed to send with Microsoft Graph.
- A GitHub repository for the hosted config page.

## Deployment Plan

### 1. Host the Receiver Page

This repository now includes a publish-ready site folder:

- `docs/index.html`

Publish it with GitHub Pages:

1. Open repository **Settings** > **Pages**.
2. Set source to branch `main` and folder `/docs`.
3. Save and wait for deployment.

Expected URL for this repository:

- `https://mattnovelli.github.io/pebble-message/`

This URL becomes your OAuth redirect URI and Pebble config URL.

### 2. Create Azure App Registration

1. Go to [Azure Portal](https://portal.azure.com).
2. Open **Microsoft Entra ID** > **App registrations** > **New registration**.
3. Set **Redirect URI**:
   - Platform: **Web**
   - URI: your GitHub Pages URL from Step 1 (exact match)

Important:

- Use **Web**, not SPA, for this architecture.
- Redirect URI must match exactly (including trailing slash/path).

### 3. Configure Microsoft Graph Permissions

Add delegated permissions:

- `Mail.Send`
- `offline_access`
- `User.Read` (typically default, keep enabled)

Grant admin consent if your tenant policy requires it.

### 4. Enable Public Client Flows

In **Authentication** > **Advanced settings**:

- Set **Allow public client flows** to **Yes**.

## Code Configuration

Update `src/pkjs/index.js`:

```javascript
var OAUTH_CONFIG = {
  clientId: "b9260194-8028-48ae-8907-e30182eda409",
  tenantId: "common",
  redirectUri: "https://mattnovelli.github.io/pebble-message/",
  scope: "https://graph.microsoft.com/Mail.Send offline_access",
  responseType: "code",
  responseMode: "query",
};

var CONFIG_PAGE_URL = OAUTH_CONFIG.redirectUri;
```

Notes:

- `CONFIG_PAGE_URL` should point to the hosted GitHub Pages URL for `docs/index.html`.
- The same URL should be in Azure Redirect URI.
- The hosted page defaults to the shared client ID above.
- The hosted page includes an expandable **Bring your own Entra app** section with a self-host tutorial and custom Client ID input.

## Runtime Flow (Current Implementation)

1. Pebble app opens hosted config page.
2. Hosted page loads existing settings from query/session storage.
3. User signs in with Microsoft.
4. Microsoft redirects back to that same hosted page with `?code=...`.
5. Hosted page validates state/verifier context and stores callback payload in settings.
6. Hosted page returns settings payload to Pebble via:
   - `pebblejs://close#<encoded-json>`
7. PKJS redeems the authorization code at the token endpoint using PKCE.
8. PKJS saves tokens and handles all refresh-token renewal directly.

### Token Renewal Behavior (Updated)

- PKJS checks token freshness before send and refreshes directly when renewal is needed.
- Refresh token redemption happens in PKJS runtime, not browser page context.
- PKJS serializes concurrent refresh requests so one refresh satisfies multiple pending sends.
- If refresh fails with definitive auth errors (for example `invalid_grant` or `interaction_required`), the app reports that sign-in is required.

Important:

- Do not configure this app as SPA if you want long-lived silent refresh in PKJS.
- Keep redirect URI as Web and public client flows enabled for this client.

## Testing

1. Open Pebble app settings for Patch.
2. Verify config page opens from your GitHub Pages URL.
3. Sign in with Microsoft.
4. Save settings and verify contacts sync to watch.
5. Send a test message and confirm Graph `sendMail` succeeds.

## Troubleshooting

1. `Invalid redirect URI`
   - Ensure Azure Redirect URI exactly equals your hosted config page URL.
   - Check trailing slash and path.

2. `Public client flows disabled`
   - Enable public client flows in Azure Authentication settings.

3. `Token exchange failed`
   - Verify Client ID and tenant.
   - Confirm `Mail.Send` and `offline_access` are granted.
   - Check that the hosted page URL in Azure matches `receiverUri()` shown by the page.
   - Ensure redirect platform is **Web** (not SPA).

4. `AADSTS9002326` / cross-origin token redemption errors
   - This typically means the app was configured as SPA for this flow.
   - Move the redirect URI to **Web** platform and keep public client flows enabled.

5. OAuth returns but Pebble does not save settings
   - Ensure the hosted page returns with `pebblejs://close#...`.
   - Confirm `webviewclosed` logs show a JSON payload with `graphAuth` fields.

## Security Notes

- PKCE is used for authorization code exchange.
- State parameter validation is performed on the hosted page.
- No client secret is required.
- Token-bearing settings are not sent in config-page query params.
- Tokens are stored in Pebble settings and refreshed when needed.
