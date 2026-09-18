import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Check, ScanLine } from 'lucide-react';
import { useAuth } from './auth';
import { configured, google, message } from './lib';
import { Brand, ErrorNotice, GoogleButton, Loading } from './ui';
export function Login() {
  const { ready, session } = useAuth();
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  if (!ready) return <Loading />;
  if (session) return <Navigate to="/" replace />;
  async function login() { setBusy(true); setError(''); try { await google('admin'); } catch (e) { setError(message(e)); setBusy(false); } }
  return <main className="login-page"><section className="login-story"><Brand light /><div className="story-copy"><span className="eyebrow">ASISTENCIA, SIN VUELTAS</span><h1>Más tiempo<br />para lo que<br /><em>pasa en clase.</em></h1><p>Abrí una clase, mostrá el QR<br />y dejá que la asistencia se resuelva sola.</p><div className="story-steps"><span>01 · Abrí</span><span>02 · Compartí</span><span>03 · Listo <Check size={14} /></span></div></div><div className="story-bottom"><span>Una forma simple de estar presente.</span><ArrowUpRight size={23} /></div><div className="story-ring" aria-hidden /></section><section className="login-panel"><span className="mobile-brand"><Brand /></span><div className="login-content"><span className="tag"><ScanLine size={16} /> PARA PROFESORES</span><h2>Tu clase empieza acá.</h2><p>Ingresá para tomar asistencia<br />y consultar tus clases.</p>{error && <ErrorNotice text={error} />}<GoogleButton onClick={login} disabled={busy || !configured} />{!configured && <p className="setup-note" role="status">El acceso estará disponible cuando se complete la configuración del servicio.</p>}<div className="login-divider" /><p className="student-hint"><strong>¿Sos alumno?</strong><br />Escaneá el QR que muestra tu profesor.<br />No necesitás entrar desde acá.</p></div><footer>Simple para vos. Simple para tus alumnos.</footer></section></main>;
}
export function Callback() {
  const { ready, session } = useAuth(); const navigate = useNavigate();
  useEffect(() => {
    if (!ready) return;
    let destination = 'admin'; try { destination = sessionStorage.getItem('oauth-destination') || 'admin'; } catch { /* Fall back to login. */ }
    if (destination === 'attendance') navigate('/check-in', { replace: true });
    else navigate(session ? '/' : '/login', { replace: true });
  }, [ready, session, navigate]);
  return <main className="center-page"><Brand /><Loading text="Verificando tu cuenta…" /></main>;
}
