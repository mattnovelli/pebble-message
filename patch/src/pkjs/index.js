/* global localStorage, Pebble */

console.log('=== JAVASCRIPT FILE STARTING ===');
console.log('Pebble object available: ' + (typeof Pebble !== 'undefined'));

// AppKeys
var KEY_CONTACT_INDEX = 0;
var KEY_VOICE_TEXT = 1;
var KEY_ERROR = 2;
var KEY_STATUS = 3;
var KEY_CONTACT_NAMES = 4;
var KEY_QUIT_AFTER_SEND = 5;
var TOKEN_REFRESH_BUFFER_MS = 10 * 60 * 1000;
var TOKEN_REFRESH_TIMEOUT_MS = 15 * 1000;
var TOKEN_REFRESH_MAX_ATTEMPTS = 3;
var TOKEN_REFRESH_BASE_RETRY_MS = 1200;

var s_refreshInFlight = false;
var s_refreshWaiters = [];

// Register appmessage handler IMMEDIATELY
console.log('=== REGISTERING APPMESSAGE HANDLER ===');
Pebble.addEventListener('appmessage', function(e) {
  console.log('=== APPMESSAGE HANDLER TRIGGERED ===');
  console.log('Raw event: ' + JSON.stringify(e));
  console.log('Event payload: ' + JSON.stringify(e.payload));
  
  handleAppMessage(e);
});

// Function to handle app messages
function handleAppMessage(e) {
  console.log('=== MESSAGE HANDLER TRIGGERED ===');
  
  var dict = e.payload || {};
  var index = dict[KEY_CONTACT_INDEX];
  var text = dict[KEY_VOICE_TEXT];
  var s = getSettings();
  
  console.log('=== Message received from watch ===');
  console.log('Parsed contact index: ' + index);
  console.log('Parsed voice text: ' + text);
  
  console.log('Contact index: ' + index);
  console.log('Voice text: ' + text);
  console.log('Current settings: ' + JSON.stringify(s));

  // Validation
  if (typeof index !== 'number' || !s.contacts[index]) {
    console.log('ERROR: Invalid contact index');
    var msg = {};
    msg[KEY_ERROR] = 'Invalid contact selected';
    Pebble.sendAppMessage(msg);
    return;
  }
  
  if (!text || !text.length) {
    console.log('ERROR: Empty voice message');
    var msg = {};
    msg[KEY_ERROR] = 'No voice message recorded';
    Pebble.sendAppMessage(msg);
    return;
  }
  
  if (!s.graph || !s.graph.accessToken) {
    console.log('ERROR: Missing access token');
    var msg = {};
    msg[KEY_ERROR] = 'Missing access token - please sign in';
    Pebble.sendAppMessage(msg);
    return;
  }
  
  if (!s.targetEmail) {
    console.log('ERROR: Missing target email');
    var msg = {};
    msg[KEY_ERROR] = 'Missing target email - check settings';
    Pebble.sendAppMessage(msg);
    return;
  }

  var contact = s.contacts[index];
  console.log('Sending message for contact: ' + contact.name + ' (' + contact.phone + ')');

  // Send status update to watch
  var statusMsg = {};
  statusMsg[KEY_STATUS] = 'Authenticating...';
  Pebble.sendAppMessage(statusMsg);

  // Ensure we have a valid token before sending
  ensureValidToken(function(error, accessToken) {
    if (error) {
      console.log('ERROR: Token validation failed: ' + JSON.stringify(error));
      var msg = {};
      msg[KEY_ERROR] = getTokenErrorMessage(error);
      Pebble.sendAppMessage(msg);
      return;
    }

    console.log('Token validated successfully, proceeding with email send');
    sendEmailWithToken(accessToken, contact, text, s.targetEmail);
  });
}

// Separate function to handle the actual email sending
function sendEmailWithToken(accessToken, contact, messageText, targetEmail) {
  console.log('Sending email with validated token...');
  
  // Create the JSON object for SMS processing
  var messageData = {
    recipient: contact.name,
    message: messageText
  };

  var emailBody = JSON.stringify(messageData);
  console.log('JSON payload: ' + emailBody);

  // Construct Graph sendMail payload
  var body = {
    message: {
      subject: 'NEW TEXT MESSAGE',
      body: { contentType: 'Text', content: emailBody },
      toRecipients: [ { emailAddress: { address: targetEmail } } ]
    },
    saveToSentItems: true
  };

  // Update status
  var statusMsg = {};
  statusMsg[KEY_STATUS] = 'Sending email...';
  Pebble.sendAppMessage(statusMsg);

  console.log('Sending email via Microsoft Graph...');
  console.log('Request URL: https://graph.microsoft.com/v1.0/me/sendMail');
  console.log('Request body: ' + JSON.stringify(body, null, 2));
  
  // Try modern fetch first, fallback to XMLHttpRequest
  if (typeof fetch === 'function') {
    sendEmailWithFetch(accessToken, body, contact);
  } else {
    sendEmailWithXHR(accessToken, body, contact);
  }
}

function sendEmailWithFetch(accessToken, body, contact) {
  console.log('Using fetch API for email sending...');
  
  var timeoutPromise = new Promise(function(resolve, reject) {
    setTimeout(function() {
      console.log('TIMEOUT: Email request timed out after 30 seconds');
      reject(new Error('Request timeout after 30 seconds'));
    }, 30000);
  });

  var fetchPromise = fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  .then(function(response) {
    console.log('Email API response status: ' + response.status);
    console.log('Email API response headers: ' + JSON.stringify(Array.from(response.headers.entries())));
    
    if (response.status === 202 || response.status === 200) {
      console.log('SUCCESS: Email sent successfully via fetch');
      return { success: true, status: response.status };
    } else {
      return response.text().then(function(errorText) {
        console.log('Email API error body: ' + errorText);
        throw new Error('HTTP ' + response.status + ': ' + errorText);
      });
    }
  });

  Promise.race([fetchPromise, timeoutPromise])
    .then(function(result) {
      console.log('Email sending completed successfully!');
      var msg = {};
      msg[KEY_STATUS] = 'Email sent to ' + contact.name + '!';
      Pebble.sendAppMessage(msg);
    })
    .catch(function(err) {
      handleEmailError(err, contact);
    });
}

function sendEmailWithXHR(accessToken, body, contact) {
  console.log('Using XMLHttpRequest for email sending...');
  
  var xhr = new XMLHttpRequest();
  xhr.timeout = 30000; // 30 second timeout
  
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      console.log('Email XHR response - status: ' + xhr.status);
      
      if (xhr.status === 202 || xhr.status === 200) {
        console.log('SUCCESS: Email sent successfully via XHR');
        var msg = {};
        msg[KEY_STATUS] = 'Email sent to ' + contact.name + '!';
        Pebble.sendAppMessage(msg);
      } else {
        console.log('Email XHR error: ' + xhr.responseText);
        var error = new Error('HTTP ' + xhr.status + ': ' + xhr.responseText);
        handleEmailError(error, contact);
      }
    }
  };
  
  xhr.ontimeout = function() {
    console.log('Email XHR timed out');
    var error = new Error('Request timeout after 30 seconds');
    handleEmailError(error, contact);
  };
  
  xhr.onerror = function() {
    console.log('Email XHR network error');
    var error = new Error('Network error during email send');
    handleEmailError(error, contact);
  };
  
  xhr.open('POST', 'https://graph.microsoft.com/v1.0/me/sendMail');
  xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(JSON.stringify(body));
}

function handleEmailError(err, contact) {
  console.log('ERROR: Email sending failed');
  console.log('Error details: ' + err);
  
  var errorMsg = String(err && err.message || err);
  if (errorMsg.includes('401') || errorMsg.includes('unauthorized')) {
    errorMsg = 'Access token expired - please sign in again';
  } else if (errorMsg.includes('403') || errorMsg.includes('forbidden')) {
    errorMsg = 'Permission denied - check token permissions';
  } else if (errorMsg.includes('400')) {
    errorMsg = 'Invalid email format';
  } else if (errorMsg.includes('timeout')) {
    errorMsg = 'Request timed out - check connection';
  } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
    errorMsg = 'Network error - check connection';
  } else {
    errorMsg = 'Email sending failed: ' + errorMsg;
  }
  
  var msg = {};
  msg[KEY_ERROR] = errorMsg;
  Pebble.sendAppMessage(msg);
}

// Remove Clay completely - use traditional Pebble configuration


// Settings functions
function getSettings() {
  try {
    var parsed = JSON.parse(localStorage.getItem('settings')) || { 
      contacts: [], 
      graph: { accessToken: '' }, 
      targetEmail: '',
      quitAfterSend: false
    };
    parsed.quitAfterSend = !!parsed.quitAfterSend;
    return parsed;
  } catch (e) {
    return { 
      contacts: [], 
      graph: { accessToken: '' }, 
      targetEmail: '',
      quitAfterSend: false
    };
  }
}


function setSettings(s) {
  localStorage.setItem('settings', JSON.stringify(s));
}


function sendContactsToWatch() {
  var s = getSettings();
  console.log('Current settings: ' + JSON.stringify(s));
  console.log('Contacts array: ' + JSON.stringify(s.contacts));
  console.log('Contacts length: ' + s.contacts.length);
  
  if (s.contacts.length === 0) {
    console.log('No contacts found, sending empty string');
  }
  
  var names = s.contacts.map(function(c) { return c.name; }).join('\n');
  console.log('Sending contacts to watch: "' + names + '"');
  var msg = {};
  msg[KEY_CONTACT_NAMES] = names;
  msg[KEY_QUIT_AFTER_SEND] = s.quitAfterSend ? 1 : 0;
  Pebble.sendAppMessage(msg, 
    function() {
      console.log('Contacts sent successfully');
    }, 
    function(e) {
      console.log('Failed to send contacts: ' + JSON.stringify(e));
    }
  );
}


Pebble.addEventListener('ready', function() {
  console.log('=== PKJS READY EVENT ===');
  console.log('Pebble object available: ' + (typeof Pebble !== 'undefined'));
  console.log('sendAppMessage available: ' + (typeof Pebble.sendAppMessage === 'function'));
  
  // Test message sending to watch immediately
  console.log('Testing message sending to watch...');
  var testMsg = {};
  testMsg[KEY_STATUS] = 'JS Ready!';
  Pebble.sendAppMessage(testMsg, 
    function() { console.log('Test message sent OK'); },
    function(e) { console.log('Test message failed: ' + JSON.stringify(e)); }
  );
  
  sendContactsToWatch();
  
  // Test heartbeat to ensure JS is running
  setInterval(function() {
    console.log('=== JS HEARTBEAT === ' + new Date().toISOString());
  }, 10000);
});

// OAuth 2.0 Configuration for Public Client (PKCE Flow)
var OAUTH_CONFIG = {
  clientId: 'b9260194-8028-48ae-8907-e30182eda409', // Shared default client ID (BYO override available in config page)
  tenantId: 'common', // Use 'common' for multi-tenant, or your specific tenant ID
  redirectUri: 'https://mattnovelli.github.io/pebble-message/', // Hosted OAuth receiver page (GitHub Pages /docs)
  scope: 'https://graph.microsoft.com/Mail.Send offline_access',
  responseType: 'code', // Using authorization code with PKCE
  responseMode: 'query' // Authorization code callback in query params
};

// Hosted configuration page URL (typically a GitHub Pages URL).
// This page should handle OAuth and return settings via pebblejs://close#<json>
var CONFIG_PAGE_URL = OAUTH_CONFIG.redirectUri;

function normalizeClientId(clientId) {
  var v = String(clientId || '').trim();
  if (!v || v === OAUTH_CONFIG.clientId || /^YOUR_/i.test(v)) {
    return OAUTH_CONFIG.clientId;
  }

  var guidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  return guidPattern.test(v) ? v : OAUTH_CONFIG.clientId;
}

function normalizeTenantId(tenantId) {
  var v = String(tenantId || '').trim();
  if (!v || /^YOUR_/i.test(v)) {
    return OAUTH_CONFIG.tenantId;
  }

  return v;
}

function createTokenError(code, message, details) {
  var err = details || {};
  err.code = code;
  err.message = message;
  err.retryable = !!err.retryable;
  err.requiresReauth = !!err.requiresReauth;
  return err;
}

function getTokenErrorMessage(error) {
  if (!error) {
    return 'Authentication failed - please sign in again';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error.requiresReauth) {
    return error.message || 'Session expired - open settings and sign in again';
  }

  if (error.retryable) {
    return error.message || 'Temporary authentication issue. Please try again.';
  }

  return error.message || 'Authentication failed - please sign in again';
}

function getAuthConfig(settings) {
  var graph = (settings && settings.graph) || {};
  var rawClientId = String(graph.clientId || '').trim();
  var normalizedClientId = normalizeClientId(rawClientId);
  var customClientProvided = !!rawClientId && rawClientId !== OAUTH_CONFIG.clientId;
  var invalidStoredCustomClient = customClientProvided && rawClientId.toLowerCase() !== normalizedClientId.toLowerCase();

  return {
    clientId: normalizedClientId,
    tenantId: normalizeTenantId(graph.tenantId),
    scope: (graph.scope || OAUTH_CONFIG.scope),
    hasInvalidClientId: invalidStoredCustomClient
  };
}

function queueRefreshWaiter(callback) {
  s_refreshWaiters.push(callback);
}

function flushRefreshWaiters(error, accessToken) {
  var waiters = s_refreshWaiters.slice();
  s_refreshWaiters = [];
  s_refreshInFlight = false;

  for (var i = 0; i < waiters.length; i++) {
    try {
      waiters[i](error, accessToken);
    } catch (e) {
      console.log('Refresh waiter callback failed: ' + e);
    }
  }
}

function parseRefreshFailure(status, responseText) {
  var parsed = null;
  var errorCode = '';
  var errorDescription = '';

  if (responseText) {
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      parsed = null;
    }
  }

  if (parsed) {
    errorCode = String(parsed.error || '').toLowerCase();
    errorDescription = String(parsed.error_description || '');
  }

  var normalizedDescription = errorDescription.toLowerCase();
  var retryable = status === 0 || status === 408 || status === 429 || status >= 500 ||
    errorCode === 'temporarily_unavailable' || errorCode === 'server_error' || errorCode === 'timeout';
  var requiresReauth = status === 401 || status === 403 ||
    errorCode === 'invalid_grant' || errorCode === 'interaction_required' ||
    errorCode === 'invalid_client' || errorCode === 'unauthorized_client' ||
    errorCode === 'consent_required' ||
    (status === 400 && normalizedDescription.indexOf('invalid_grant') !== -1);

  if (requiresReauth) {
    return createTokenError('reauth_required', 'Session expired - open settings and sign in again', {
      status: status,
      errorCode: errorCode,
      errorDescription: errorDescription,
      responseText: responseText || '',
      requiresReauth: true
    });
  }

  if (retryable) {
    return createTokenError('refresh_retryable', 'Temporary network/auth service issue while refreshing sign-in', {
      status: status,
      errorCode: errorCode,
      errorDescription: errorDescription,
      responseText: responseText || '',
      retryable: true
    });
  }

  return createTokenError('refresh_failed', 'Token refresh failed (HTTP ' + status + ')', {
    status: status,
    errorCode: errorCode,
    errorDescription: errorDescription,
    responseText: responseText || ''
  });
}

function getRefreshRetryDelayMs(attemptNumber) {
  return TOKEN_REFRESH_BASE_RETRY_MS * Math.pow(2, attemptNumber - 1);
}

// Refresh access token using refresh token
function refreshAccessToken(authConfig, refreshToken, callback) {
  console.log('Refreshing access token...');
  console.log('Refresh context: client=' + authConfig.clientId + ', tenant=' + authConfig.tenantId);
  
  var tokenUrl = 'https://login.microsoftonline.com/' + authConfig.tenantId + '/oauth2/v2.0/token';
  var body = [
    'client_id=' + encodeURIComponent(authConfig.clientId),
    'scope=' + encodeURIComponent(authConfig.scope),
    'refresh_token=' + encodeURIComponent(refreshToken),
    'grant_type=refresh_token'
  ].join('&');
  
  var xhr = new XMLHttpRequest();
  var completed = false;

  function finish(error, tokenData) {
    if (completed) {
      return;
    }

    completed = true;
    callback(error, tokenData);
  }

  xhr.open('POST', tokenUrl);
  xhr.timeout = TOKEN_REFRESH_TIMEOUT_MS;
  xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4) {
      return;
    }

    console.log('Token refresh response status: ' + xhr.status);
      
    if (xhr.status === 200) {
      try {
        var response = JSON.parse(xhr.responseText);

        if (!response.access_token) {
          finish(createTokenError('refresh_parse', 'Failed to parse refresh response', {
            responseText: xhr.responseText
          }));
          return;
        }

        console.log('Token refresh successful');
        finish(null, {
          accessToken: response.access_token,
          refreshToken: response.refresh_token || refreshToken,
          expiresIn: response.expires_in || 3600,
          tokenType: response.token_type,
          scope: response.scope || authConfig.scope,
          clientId: authConfig.clientId,
          tenantId: authConfig.tenantId,
          expiresAt: Date.now() + ((response.expires_in || 3600) * 1000)
        });
      } catch (e) {
        console.log('Error parsing refresh response: ' + e);
        finish(createTokenError('refresh_parse', 'Failed to parse refresh response', {
          responseText: xhr.responseText
        }));
      }
    } else {
      console.log('Token refresh failed body: ' + xhr.responseText);
      finish(parseRefreshFailure(xhr.status, xhr.responseText));
    }
  };

  xhr.onerror = function() {
    console.log('Token refresh network error');
    finish(createTokenError('refresh_network', 'Temporary network/auth service issue while refreshing sign-in', {
      retryable: true,
      status: 0
    }));
  };

  xhr.ontimeout = function() {
    console.log('Token refresh request timed out');
    finish(createTokenError('refresh_timeout', 'Temporary network/auth service issue while refreshing sign-in', {
      retryable: true,
      status: 0
    }));
  };
  
  xhr.send(body);
}

function refreshAccessTokenWithRetry(authConfig, refreshToken, callback) {
  function runAttempt(attemptNumber) {
    console.log('Token refresh attempt ' + attemptNumber + ' of ' + TOKEN_REFRESH_MAX_ATTEMPTS);

    refreshAccessToken(authConfig, refreshToken, function(error, tokens) {
      if (!error) {
        callback(null, tokens);
        return;
      }

      var shouldRetry = error.retryable && attemptNumber < TOKEN_REFRESH_MAX_ATTEMPTS;
      if (!shouldRetry) {
        callback(error);
        return;
      }

      var delayMs = getRefreshRetryDelayMs(attemptNumber);
      console.log('Retryable refresh failure (' + error.code + '), retrying in ' + delayMs + 'ms');
      setTimeout(function() {
        runAttempt(attemptNumber + 1);
      }, delayMs);
    });
  }

  runAttempt(1);
}

// Check if token needs refresh and refresh if necessary
function ensureValidToken(callback) {
  var settings = getSettings();
  var authConfig = getAuthConfig(settings);
  var graph = settings.graph || {};
  
  if (!graph.accessToken) {
    callback(createTokenError('missing_access_token', 'Not signed in - open settings and sign in again', {
      requiresReauth: true
    }));
    return;
  }

  if (authConfig.hasInvalidClientId) {
    callback(createTokenError('invalid_client_config', 'Saved custom Client ID is invalid - open settings and sign in again', {
      requiresReauth: true
    }));
    return;
  }
  
  // Check if token is expired or will expire soon.
  var now = Date.now();
  var expiresAt = graph.expiresAt || 0;
  var shouldRefresh = !expiresAt || (now + TOKEN_REFRESH_BUFFER_MS >= expiresAt);
  
  if (!shouldRefresh) {
    console.log('Token is still valid. Expires in ' + Math.round((expiresAt - now) / 1000) + 's');
    callback(null, graph.accessToken);
    return;
  }

  console.log('Token refresh needed. now=' + now + ', expiresAt=' + expiresAt + ', bufferMs=' + TOKEN_REFRESH_BUFFER_MS);

  if (!graph.refreshToken) {
    callback(createTokenError('missing_refresh_token', 'Session expired - open settings and sign in again', {
      requiresReauth: true
    }));
    return;
  }

  if (s_refreshInFlight) {
    console.log('A token refresh is already in progress; joining existing refresh');
    queueRefreshWaiter(callback);
    return;
  }

  s_refreshInFlight = true;
  queueRefreshWaiter(callback);

  refreshAccessTokenWithRetry(authConfig, graph.refreshToken, function(error, tokens) {
    if (error) {
      console.log('Token refresh failed after retries: ' + JSON.stringify(error));
      flushRefreshWaiters(error, null);
      return;
    }

    var latestSettings = getSettings();
    latestSettings.graph = tokens;
    setSettings(latestSettings);

    console.log('Token refresh complete. New expiry: ' + tokens.expiresAt);
    flushRefreshWaiters(null, tokens.accessToken);
  });
}

// Hosted configuration page approach (GitHub Pages, custom domain, etc.)
Pebble.addEventListener('showConfiguration', function() {
  console.log('showConfiguration fired - opening hosted config page');
  var settings = getSettings();
  var authConfig = getAuthConfig(settings);

  var sep = CONFIG_PAGE_URL.indexOf('?') === -1 ? '?' : '&';
  var configURL = CONFIG_PAGE_URL + sep + [
    't=' + Date.now(),
    'settings=' + encodeURIComponent(JSON.stringify(settings)),
    'client_id=' + encodeURIComponent(authConfig.clientId),
    'tenant=' + encodeURIComponent(authConfig.tenantId),
    'scope=' + encodeURIComponent(authConfig.scope)
  ].join('&');

  console.log('Opening config URL: ' + configURL);
  Pebble.openURL(configURL);
});


// Handle configuration results
Pebble.addEventListener('webviewclosed', function(e) {
  console.log('=== Configuration closed ===');
  console.log('Response: ' + (e.response || 'No response'));
  
  if (e.response) {
    try {
      var newSettings = JSON.parse(decodeURIComponent(e.response));
      newSettings.quitAfterSend = !!newSettings.quitAfterSend;
      console.log('New settings: ' + JSON.stringify(newSettings));
      setSettings(newSettings);
      sendContactsToWatch();
    } catch (error) {
      console.log('Error parsing config response: ' + error);
    }
  }
});

console.log('=== JAVASCRIPT FILE FULLY LOADED ===');