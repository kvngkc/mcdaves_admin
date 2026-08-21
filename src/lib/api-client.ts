// src/lib/api-client.ts

export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)mcdaves_admin_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const isMutating = init?.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(init.method.toUpperCase());
  
  const modifiedInit = { ...init };

  if (isMutating) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      modifiedInit.headers = {
        ...modifiedInit.headers,
        'x-csrf-token': csrfToken,
      };
    }
  }

  return fetch(input, modifiedInit);
}
