import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, ScanLine, ShieldCheck, CircleX } from 'lucide-react';
import { useAuth } from './auth';
import { api, ApiError, google, message, retriable, time } from './lib';
import { Brand, ErrorNotice, GoogleButton, Loading } from './ui';
import type { Attempt, Result } from './types';

const storageKey = 'attendance-pending';
interface Pending extends Attempt { token: string }
const starts = new Map<string, Promise<Pending>>();
const confirmations = new Map<string, Promise<Result>>();
function readPending(): Pending | null {
  try { const data = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); return data?.attemptId && data?.attemptSecret && data?.token ? data : null; }
  catch { return null; }
}
function startOnce(token?: string): Promise<Pending> {
  const saved = readPending();
  if (saved && (!token || saved.token === token)) return Promise.resolve(saved);
  if (!token) return Promise.reject(new ApiError('INVALID_ATTEMPT', 404));
  const existing = starts.get(token); if (existing) return existing;
  const pending = api<Attempt>('/attendance/check-in/start', { body: { qrToken: token }, public: true }).then(attempt => {
    const result = { ...attempt, token };
    try { sessionStorage.setItem(storageKey, JSON.stringify(result)); } catch { throw new ApiError('STORAGE'); }
    return result;
  });
  starts.set(token, pending);
  pending.catch(() => starts.delete(token));
  return pending;
}
function confirmOnce(pending: Pending, userId: string): Promise<Result> {
  const key = `${pending.attemptId}:${userId}`;
  const existing = confirmations.get(key); if (existing) return existing;
  const request = api<Result>('/attendance/check-in/confirm', { body: { attemptId: pending.attemptId, attemptSecret: pending.attemptSecret } });
  confirmations.set(key, request);
  request.catch(() => confirmations.delete(key));
  return request;
}
export function StudentPage() {
  const { token } = useParams();
  const { ready, session } = useAuth();
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [retry, setRetry] = useState(0);
  const [oauthBusy, setOauthBusy] = useState(false);
  useEffect(() => {
    let active = true; setError(null); setPending(null); setResult(null);
    // Begin before waiting for Auth initialization: QR validity is only ten seconds.
    startOnce(token).then(value => { if (active) setPending(value); }).catch(e => { if (active) setError(e); });
    return () => { active = false; };
  }, [token, retry]);
  useEffect(() => {
    if (!pending || !ready || !session) return;
    let active = true;
    confirmOnce(pending, session.user.id).then(value => {
      if (!active) return;
      setResult(value);
      try { sessionStorage.removeItem(storageKey); sessionStorage.removeItem('oauth-destination'); } catch { /* Confirmation already succeeded. */ }
    }).catch(e => { if (active) setError(e); });
    return () => { active = false; };
  }, [pending, ready, session?.user.id, retry]);
  async function login() {
    setOauthBusy(true); setError(null);
    try { await google('attendance'); } catch (e) { setError(e); setOauthBusy(false); }
  }
  const name = session?.user.user_metadata?.full_name || session?.user.user_metadata?.name || session?.user.email;
  const terminal = error instanceof ApiError && !retriable(error) && !['OAUTH', 'UNAUTHENTICATED'].includes(error.code);
  return <main className="student-page"><Brand /><section className="student-card" aria-live="polite">
    {result ? <><div className="result-icon success"><Check size={48} strokeWidth={2.5} /></div><span className="eyebrow">TODO LISTO</span><h1>{result.status === 'PRESENT' ? '¡Presente!' : 'Ya estás presente'}</h1><p>{result.status === 'PRESENT' ? 'Tu asistencia quedó registrada.' : 'Ya habías registrado tu asistencia.'}</p><div className="receipt"><strong>{name}</strong><span>{time(result.attendance.checked_in_at)} · Asistencia confirmada</span></div><p className="small muted">Podés cerrar esta ventana. Buena clase.</p></>
    : error ? <><div className="result-icon failure"><CircleX size={44} /></div><h1>{terminal ? 'No pudimos registrar tu asistencia' : 'Intentemos de nuevo'}</h1><p>{message(error)}</p>{!terminal && (error instanceof ApiError && ['OAUTH', 'UNAUTHENTICATED'].includes(error.code) ? <GoogleButton onClick={login} disabled={oauthBusy} /> : <button className="button primary" onClick={() => { setError(null); setRetry(value => value + 1); }}>Intentar nuevamente</button>)}</>
    : !pending || !ready || session ? <><div className="result-icon waiting"><ScanLine size={42} /></div><h1>Un momento…</h1><Loading text={pending ? 'Registrando asistencia…' : 'Verificando el código…'} /><p className="small muted">Esto puede tardar unos segundos.</p></>
    : <><div className="result-icon waiting"><ScanLine size={42} /></div><span className="eyebrow">ESTÁS A UN PASO</span><h1>Decí presente.</h1><p>Ingresá con tu cuenta de Google<br />y registramos tu asistencia.</p><GoogleButton onClick={login} disabled={oauthBusy} /><div className="privacy-note"><ShieldCheck size={16} />Solo usamos tu nombre y correo.</div></>}
  </section><footer className="student-footer">Menos trámites. Más clase.</footer></main>;
}
