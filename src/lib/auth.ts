const STORAGE_KEY = 'org_auth_user';
const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
].join(' ');

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
}

let cachedAccessToken: string | null = null;
let cachedUser: AuthUser | null = null;
let gisLoaded = false;

function getClientId(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('Google SSO is not configured. Set VITE_GOOGLE_CLIENT_ID in .env.local');
  }
  return clientId;
}

function getAllowedDomain(): string | undefined {
  return import.meta.env.VITE_GOOGLE_ALLOWED_DOMAIN?.toLowerCase();
}

function loadGoogleIdentityScript(): Promise<void> {
  if (gisLoaded && window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      const waitForGis = () => {
        if (window.google?.accounts?.oauth2) {
          gisLoaded = true;
          resolve();
        } else {
          setTimeout(waitForGis, 50);
        }
      };
      waitForGis();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gisLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

async function fetchUserInfo(accessToken: string): Promise<AuthUser> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user profile from Google');
  }

  const data = await response.json();
  return {
    uid: data.sub,
    email: data.email ?? null,
    displayName: data.name ?? null,
    photoURL: data.picture ?? null,
  };
}

function validateDomain(email: string | null): void {
  const allowedDomain = getAllowedDomain();
  if (!allowedDomain || !email) return;

  const emailDomain = email.split('@')[1]?.toLowerCase();
  if (emailDomain !== allowedDomain) {
    throw new Error(`Only @${allowedDomain} email addresses are allowed`);
  }
}

function persistSession(user: AuthUser): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

function clearSession(): void {
  sessionStorage.removeItem(STORAGE_KEY);
  cachedAccessToken = null;
  cachedUser = null;
}

async function requestAccessToken(prompt: '' | 'consent' | 'select_account' = 'consent'): Promise<string> {
  await loadGoogleIdentityScript();
  const clientId = getClientId();

  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        resolve(response.access_token);
      },
      error_callback: (err) => {
        reject(new Error(err.message || 'Google sign-in was cancelled'));
      },
    });
    client.requestAccessToken({ prompt });
  });
}

export const initAuth = (
  onAuthSuccess?: (user: AuthUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (!stored) {
    onAuthFailure?.();
    return () => {};
  }

  let cancelled = false;

  (async () => {
    try {
      const token = await requestAccessToken('');
      if (cancelled) return;

      const user = await fetchUserInfo(token);
      validateDomain(user.email);

      cachedUser = user;
      cachedAccessToken = token;
      persistSession(user);
      onAuthSuccess?.(user, token);
    } catch {
      if (cancelled) return;
      clearSession();
      onAuthFailure?.();
    }
  })();

  return () => {
    cancelled = true;
  };
};

export const googleSignIn = async (): Promise<{ user: AuthUser; accessToken: string }> => {
  // Request consent so newly added API scopes (e.g. Drive) are granted.
  const token = await requestAccessToken('consent');
  const user = await fetchUserInfo(token);
  validateDomain(user.email);

  cachedAccessToken = token;
  cachedUser = user;
  persistSession(user);
  return { user, accessToken: token };
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setAccessToken = (token: string) => {
  cachedAccessToken = token;
};

export const logout = async () => {
  const token = cachedAccessToken;
  clearSession();

  if (token) {
    try {
      await loadGoogleIdentityScript();
      window.google.accounts.oauth2.revoke(token, () => {});
    } catch {
      // Ignore revoke errors during sign-out.
    }
  }
};
