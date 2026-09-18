import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key && !url.includes('YOUR_PROJECT'));
export const supabase = configured ? createClient(url, key, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
}) : null;
export class ApiError extends Error {
  constructor(public code: string, public status = 0) { super(code); }
}
const messages: Record<string, string> = {
  QR_EXPIRED: 'Este código expiró. Escaneá el QR que está en pantalla.',
  INVALID_QR: 'Este código no es válido. Escaneá el QR de la clase.',
  SESSION_CLOSED: 'La asistencia está cerrada.', SESSION_CANCELLED: 'Esta clase ya no está disponible.',
  ATTEMPT_EXPIRED: 'Se agotó el tiempo. Escaneá nuevamente el QR de la clase.',
  INVALID_ATTEMPT: 'No encontramos tu intento. Volvé a escanear el QR.',
  ATTEMPT_USED: 'Este intento ya fue utilizado con otra cuenta. Escaneá nuevamente.',
  ATTENDANCE_VOIDED: 'Tu asistencia fue anulada. Consultá con el profesor.',
  UNAUTHENTICATED: 'Tu sesión terminó. Volvé a ingresar con Google.',
  GOOGLE_IDENTITY_REQUIRED: 'Necesitás una cuenta de Google verificada.',
  FORBIDDEN: 'Esta cuenta no tiene acceso de profesor.',
  RATE_LIMITED: 'Recibimos muchos intentos. Esperá unos segundos y volvé a intentar.',
  NETWORK: 'No pudimos conectar. Revisá tu conexión y volvé a intentar.',
  INTERNAL_ERROR: 'No pudimos completar la operación. Intentá nuevamente.',
  REQUEST_REJECTED: 'Revisá los datos e intentá nuevamente.',
  COURSE_ARCHIVED: 'Este curso está archivado.',
  SESSION_NOT_FOUND: 'No encontramos esta clase o no tenés permiso para verla.',
  COURSE_NOT_FOUND: 'No encontramos este curso o no tenés permiso para verlo.',
  STORAGE: 'Habilitá el almacenamiento del navegador para continuar con Google.',
  OAUTH: 'No pudimos verificar tu cuenta de Google. Intentá nuevamente.',
};
export const message = (error: unknown) => error instanceof ApiError ? (messages[error.code] ?? messages.INTERNAL_ERROR) : messages.INTERNAL_ERROR;
export const retriable = (error: unknown) => error instanceof ApiError && (error.status === 0 || error.status >= 500 || error.status === 429);

export async function api<T>(path: string, options: { body?: unknown; public?: boolean; signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (!options.public) {
    const session = await supabase?.auth.getSession();
    if (!session?.data.session) throw new ApiError('UNAUTHENTICATED', 401);
    headers.Authorization = `Bearer ${session.data.session.access_token}`;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  const abort = () => controller.abort(); options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  try {
    const response = await fetch(`${(import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')}${path}`, {
      method: options.body === undefined ? 'GET' : 'POST', headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(data.code ?? 'INTERNAL_ERROR', response.status);
    return data as T;
  } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError('NETWORK'); }
  finally { clearTimeout(timeout); options.signal?.removeEventListener('abort', abort); }
}
export async function allPages<T>(path: string, size = 100, signal?: AbortSignal): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += size) {
    const rows = await api<T[]>(`${path}${path.includes('?') ? '&' : '?'}offset=${offset}`, { signal });
    result.push(...rows); if (rows.length < size) return result;
  }
}
export async function google(destination: 'admin' | 'attendance') {
  if (!supabase) throw new ApiError('OAUTH');
  try { sessionStorage.setItem('oauth-destination', destination); } catch { throw new ApiError('STORAGE'); }
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/auth/callback` } });
  if (error) throw new ApiError('OAUTH');
}
export const date = (value: string) => new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
export const time = (value: string) => new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
export function countdown(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000)); return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
