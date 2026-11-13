"""Public deployment checks. Credentials/tokens are never printed.

WHAT THIS SCRIPT DOES
    Called by .github/workflows/deploy.yml after a deployment:
        python3 deploy/smoke_test.py SERVICE_URL
    It checks the live service and exits non-zero (failing the workflow) if any
    check fails. Each public check is retried up to 5 times, 3 seconds apart, to
    tolerate Cloud Run cold starts.

    Checks (in order)
      1. GET /api/health      -> {"status": "ok"}
      2. GET /api/ready       -> {"db": "connected"}   (proves the DB works)
      3. GET /                -> HTML page (the built React app is served)
      4. OPTIONAL login test  -> login (/api/auth/login), /api/auth/me, logout.
         Runs only if BOTH env vars SMOKE_EMAIL and SMOKE_PASSWORD are set
         (set both or neither; SMOKE_EMAIL holds the dedicated test username).
         The session is always logged out, even if a check fails.

IMPORTANT
    Uses only the Python standard library (no pip install needed).
    Offline unit tests: deploy/tests/test_smoke.py

REFERENCES
    - urllib.request : https://docs.python.org/3/library/urllib.request.html
    - unittest.mock  : https://docs.python.org/3/library/unittest.mock.html
"""
import http.cookiejar
import json
import os
import sys
import time
import urllib.error
import urllib.request

_COOKIE_JAR = http.cookiejar.CookieJar()
_OPENER = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_COOKIE_JAR))


# --- HTTP helper --------------------------------------------------------------
# Returns the response body (bytes). Raises on HTTP errors / timeouts.
def request(base, path, data=None):
    headers = {}
    if data is not None:
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(
        base + path,
        headers=headers,
        data=json.dumps(data).encode() if data is not None else None,
    )
    with _OPENER.open(req, timeout=30) as response:
        return response.read()


def check(base):
    # --- Public checks --------------------------------------------------------
    for path, predicate in (
        ('/api/health', lambda b: json.loads(b).get('status') == 'ok'),
        ('/api/ready', lambda b: json.loads(b).get('db') == 'connected'),
        ('/', lambda b: b'<html' in b.lower()),
    ):
        # Retry: a cold Cloud Run instance may need a few seconds to start.
        for attempt in range(5):
            try:
                if not predicate(request(base, path)):
                    raise ValueError('Unexpected response')
                break
            except (urllib.error.URLError, TimeoutError, ValueError):
                if attempt == 4:
                    raise RuntimeError('Smoke check failed: ' + path) from None
                time.sleep(3)
        print('PASS ' + path)

    # --- Optional login check (only when both credentials are provided) -------
    username, password = os.getenv('SMOKE_EMAIL'), os.getenv('SMOKE_PASSWORD')
    if bool(username) != bool(password):
        raise RuntimeError('Set both SMOKE_EMAIL and SMOKE_PASSWORD, or neither.')
    if not username:
        print('SKIP login: optional smoke credentials not configured')
        return
    logged_in = False
    try:
        login = json.loads(request(base, '/api/auth/login', {'username': username, 'password': password}))
        if not isinstance(login, dict) or 'id' not in login:
            raise KeyError('Missing login identity')
        logged_in = True
        request(base, '/api/auth/me')
        print('PASS login and authenticated /api/auth/me')
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError):
        raise RuntimeError('Login smoke check failed') from None
    finally:
        # Always end the session, even when a check above failed.
        if logged_in:
            request(base, '/api/auth/logout', data={})
            print('PASS logout')


# --- Entry point ----------------------------------------------------------------
if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('Usage: python3 deploy/smoke_test.py SERVICE_URL')
    check(sys.argv[1].rstrip('/'))
