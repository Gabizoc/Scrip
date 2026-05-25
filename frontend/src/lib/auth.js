// frontend/src/lib/auth.js

async function authRequest(method, path, body) {
  const opts = {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body:    body ? JSON.stringify(body) : undefined,
  };
  const res = await fetch(`/api/auth${path}`, opts);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data;
}

export const authApi = {
  /** { loggedIn: bool, needsSetup: bool } */
  status:         ()                       => authRequest('GET',  '/status'),
  login:          (email, password)        => authRequest('POST', '/login',          { email, password }),
  logout:         ()                       => authRequest('POST', '/logout'),
  magic:          ()                       => authRequest('POST', '/magic'),
  forgot:         ()                       => authRequest('POST', '/forgot'),
  reset:          (token, password)        => authRequest('POST', '/reset',          { token, password }),
  setupRequest:    ()                              => authRequest('POST', '/setup-request'),
  setupComplete:   (token, password)               => authRequest('POST', '/setup-complete',    { token, password }),
  changePassword:  (currentPassword, newPassword)  => authRequest('POST', '/change-password',   { currentPassword, newPassword }),
};
