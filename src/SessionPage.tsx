import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Archive, ArrowLeft, Check, Clock3, Expand, Minimize, Plus, Search, ShieldCheck, Square, Users, X } from 'lucide-react';
import { allPages, api, ApiError, countdown, date, message, time } from './lib';
import { ArchiveModal } from './Admin';
import { ErrorNotice, Loading, Modal } from './ui';
import type { Attendance, AttendanceSession, Qr, Student } from './types';

export function SessionPage() {
  const { id } = useParams(); const [session, setSession] = useState<AttendanceSession | null>(null); const [rows, setRows] = useState<Attendance[]>([]);
  const [error, setError] = useState(''); const [qrError, setQrError] = useState(''); const [qr, setQr] = useState<Qr | null>(null);
  const [qrDeadline, setQrDeadline] = useState(0); const [sessionDeadline, setSessionDeadline] = useState(0); const [now, setNow] = useState(performance.now());
  const [refresh, setRefresh] = useState(0); const [project, setProject] = useState(false); const [manual, setManual] = useState(false); const [voidRow, setVoidRow] = useState<Attendance | null>(null);
  const [archive, setArchive] = useState(false); const [closing, setClosing] = useState(false); const [search, setSearch] = useState('');
  useEffect(() => { const timer = setInterval(() => setNow(performance.now()), 250); return () => clearInterval(timer); }, []);
  useEffect(() => {
    let alive = true; let timer: ReturnType<typeof setTimeout>; const controller = new AbortController();
    async function poll() {
      const start = performance.now();
      try {
        const [s, attendees] = await Promise.all([api<AttendanceSession>(`/attendance-sessions/${id}`, { signal: controller.signal }), allPages<Attendance>(`/attendance-sessions/${id}/attendance`, 100, controller.signal)]);
        if (alive) { setSession(s); setRows(attendees); setError(''); setSessionDeadline(start + new Date(s.expires_at).getTime() - new Date(s.server_time).getTime()); }
      } catch (e) { if (alive) setError(message(e)); }
      finally { if (alive) timer = setTimeout(poll, 4000); }
    }
    void poll(); return () => { alive = false; clearTimeout(timer); controller.abort(); };
  }, [id, refresh]);
  const open = session?.effective_status === 'OPEN';
  useEffect(() => {
    if (!open) { setQr(null); return; }
    let alive = true; let timer: ReturnType<typeof setTimeout>; const controller = new AbortController();
    async function rotate() {
      const start = performance.now(); let delay = 2000;
      try {
        const data = await api<Qr>(`/attendance-sessions/${id}/qr`, { signal: controller.signal });
        if (!alive) return;
        const deadline = start + new Date(data.expiresAt).getTime() - new Date(data.serverTime).getTime();
        setQr(data); setQrDeadline(deadline); setQrError('');
        delay = Math.max(150, deadline - performance.now() + 50);
      } catch (e) {
        if (!alive) return;
        setQr(null);
        if (e instanceof ApiError && e.code === 'SESSION_CLOSED') { setSession(s => s ? { ...s, effective_status: 'CLOSED' } : s); return; }
        setQrError(message(e));
      }
      if (alive) timer = setTimeout(rotate, delay);
    }
    void rotate(); return () => { alive = false; clearTimeout(timer); controller.abort(); };
  }, [id, open, refresh]);
  async function close() {
    if (closing) return; setClosing(true); setError('');
    try { await api(`/attendance-sessions/${id}/close`, { body: {} }); setSession(s => s ? { ...s, effective_status: 'CLOSED' } : s); setQr(null); setRefresh(n => n + 1); }
    catch (e) { setError(message(e)); } finally { setClosing(false); }
  }
  const activeRows = rows.filter(row => row.status === 'PRESENT');
  const filtered = rows.filter(row => `${row.name} ${row.email}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const archived = Boolean(session?.class_archived_at || session?.course_archived_at || session?.effective_status === 'CANCELLED');
  return <main className={`page session-page ${project ? 'projection' : ''}`}>
    {!session ? <>{error ? <ErrorNotice text={error} retry={() => setRefresh(n => n + 1)} /> : <Loading text="Abriendo la clase…" />}</> : <>
      <div className="session-navigation"><Link to={`/cursos/${session.course_id}`} className="back-link"><ArrowLeft size={16} />{session.course_name}</Link><button className="text-button" onClick={() => setProject(value => !value)}>{project ? <Minimize size={17} /> : <Expand size={17} />}{project ? 'Salir de proyección' : 'Modo proyección'}</button></div>
      <div className="page-heading"><div><span className="eyebrow">{session.course_name}</span><h1>{session.class_name}</h1><p>{date(session.started_at)} <span className="separator">/</span> {time(session.started_at)}</p></div><span className={`pill ${open ? 'green' : ''}`}>{open && <span className="status-dot" />}{open ? 'Asistencia abierta' : archived ? 'Clase archivada' : 'Asistencia finalizada'}</span></div>
      {error && <ErrorNotice text={error} retry={() => setRefresh(n => n + 1)} />}
      <div className="session-layout"><section className={`qr-panel ${!open ? 'closed-panel' : ''}`}>
        {open ? <><div className="qr-panel-heading"><span className="eyebrow">ESCANEÁ Y DECÍ PRESENTE</span><ShieldCheck size={18} /></div><div className="qr-frame">{qr && now < qrDeadline && now < sessionDeadline ? <QRCodeSVG value={qr.qrUrl} size={300} level="M" marginSize={2} title="Escaneá este QR para registrar tu asistencia" /> : <Loading text={qrError ? 'Reconectando…' : 'Actualizando código…'} />}</div>{qrError && <ErrorNotice text={qrError} />}<div className="qr-rotation"><span className="status-dot" />El código se renueva automáticamente</div><div className="session-timer"><Clock3 size={19} /><strong>{countdown(sessionDeadline - now)}</strong><span>restantes</span></div><button className="button close-button" onClick={close} disabled={closing}><Square size={14} />{closing ? 'Cerrando…' : 'Cerrar asistencia'}</button><p className="small muted qr-instruction">Abrí la cámara de tu celular y apuntá al código.</p></> : <><div className="result-icon success"><Check size={40} /></div><h2>{archived ? 'Clase archivada' : 'La clase quedó registrada.'}</h2><p>{archived ? 'El historial de asistencia se conserva.' : 'Los nuevos escaneos están cerrados.'}</p><div className="closed-count"><strong>{session.present_count}</strong><span>presentes</span></div>{!archived && <p className="small muted">Los alumnos que ya escanearon pueden terminar de ingresar.</p>}</>}
      </section><section className="live-panel"><div className="section-heading"><h2><Users size={20} />Presentes</h2><span className="count-pill">{session.present_count}</span></div><div className="live-subtitle"><span className="status-dot" />{open ? 'Se actualiza automáticamente' : 'Registro de la clase'}</div>{activeRows.length ? <div className="live-list">{activeRows.slice(-6).reverse().map((row, index) => <div className="live-person" key={row.id}><span className={`avatar pastel-${index % 3}`}>{row.name.slice(0, 1)}</span><div><strong>{row.name}</strong><span>{time(row.checked_in_at)}{row.source === 'MANUAL' ? ' · Manual' : ''}</span></div><span className="person-check"><Check size={16} /></span></div>)}</div> : <div className="waiting-students"><Users size={36} strokeWidth={1.25} /><h3>{open ? 'Esperando a tus alumnos' : 'Sin asistencias registradas'}</h3><p>{open ? 'Cuando escaneen el QR, los vas a ver acá.' : 'Podés agregar una asistencia manual si hace falta.'}</p></div>}<div className="live-note"><ShieldCheck size={17} /><p>Una asistencia por alumno.<br />Cada registro cuenta.</p></div></section></div>
      {!project && <section className="attendance-section"><div className="section-heading"><div><span className="eyebrow">EL DETALLE DE TU CLASE</span><h2>Registro de asistencia</h2></div>{!archived && <button className="button secondary" onClick={() => setManual(true)}><Plus size={17} />Agregar manualmente</button>}</div><label className="search-field table-search"><Search size={17} /><input aria-label="Buscar alumno en asistencia" placeholder="Buscar por nombre o correo…" value={search} onChange={e => setSearch(e.target.value)} /></label><div className="table-wrap"><table><thead><tr><th>ALUMNO</th><th>HORA</th><th>ORIGEN</th><th>ESTADO</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{filtered.map(row => <tr key={row.id} className={row.status === 'VOIDED' ? 'voided-row' : ''}><td><strong>{row.name}</strong><span>{row.email}</span>{row.reason && <small>Motivo: {row.reason}</small>}</td><td>{time(row.checked_in_at)}</td><td>{row.source === 'QR' ? 'QR' : 'Manual'}</td><td><span className={`pill ${row.status === 'PRESENT' ? 'green' : ''}`}>{row.status === 'PRESENT' ? 'Presente' : 'Anulada'}</span></td><td>{row.status === 'PRESENT' && <button className="text-button muted" onClick={() => setVoidRow(row)} aria-label={`Anular asistencia de ${row.name}`}>Anular</button>}</td></tr>)}</tbody></table>{filtered.length === 0 && <p className="table-empty">{search ? 'No encontramos alumnos con esa búsqueda.' : 'Todavía no hay asistencias para mostrar.'}</p>}</div>{!archived && <div className="archive-footer"><button className="text-button muted" onClick={() => setArchive(true)}><Archive size={15} />Archivar clase</button></div>}</section>}
      {manual && <ManualModal sessionId={session.id} onClose={() => setManual(false)} onDone={() => { setManual(false); setRefresh(n => n + 1); }} />}
      {voidRow && <VoidModal row={voidRow} onClose={() => setVoidRow(null)} onDone={() => { setVoidRow(null); setRefresh(n => n + 1); }} />}
      {archive && <ArchiveModal path={`/classes/${session.class_id}/archive`} noun="clase" onClose={() => setArchive(false)} onDone={() => { setArchive(false); setRefresh(n => n + 1); }} />}
    </>}
  </main>;
}
function ManualModal({ sessionId, onClose, onDone }: { sessionId: string; onClose: () => void; onDone: () => void }) {
  const [search, setSearch] = useState(''); const [students, setStudents] = useState<Student[]>([]); const [selected, setSelected] = useState<Student | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(false);
  useEffect(() => {
    setStudents([]); setSelected(null); setError(''); if (search.trim().length < 2) { setLoading(false); return; }
    let active = true; const controller = new AbortController(); setLoading(true);
    const timer = setTimeout(() => { api<Student[]>(`/students?q=${encodeURIComponent(search.trim())}`, { signal: controller.signal }).then(rows => { if (active) setStudents(rows); }).catch(e => { if (active) setError(message(e)); }).finally(() => { if (active) setLoading(false); }); }, 300);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [search]);
  async function submit(e: FormEvent) { e.preventDefault(); if (!selected || busy) return; setBusy(true); setError(''); try { await api(`/attendance-sessions/${sessionId}/attendance/manual`, { body: { userId: selected.id } }); onDone(); } catch (e) { setError(message(e)); setBusy(false); } }
  return <Modal title="Agregar asistencia manual" onClose={() => { if (!busy) onClose(); }}><form onSubmit={submit}><p className="form-intro">Buscá un alumno que ya haya ingresado con Google.</p><label>Nombre o correo<input autoFocus placeholder="Escribí al menos 2 caracteres" value={search} onChange={e => setSearch(e.target.value)} maxLength={100} /></label>{loading ? <Loading text="Buscando…" /> : <div className="student-options">{students.map(s => <button type="button" className={selected?.id === s.id ? 'student-option selected' : 'student-option'} key={s.id} onClick={() => setSelected(s)}><span><strong>{s.name}</strong><small>{s.email}</small></span>{selected?.id === s.id && <Check size={19} />}</button>)}{search.trim().length >= 2 && !students.length && <p className="small muted">No encontramos alumnos. Probá con otro nombre o correo.</p>}{students.length === 50 && <p className="small muted">Se muestran 50 resultados. Afiná la búsqueda para encontrar al alumno.</p>}</div>}{error && <ErrorNotice text={error} />}<button className="button primary full" disabled={!selected || busy}>{busy ? 'Registrando…' : 'Registrar presente'}</button></form></Modal>;
}
function VoidModal({ row, onClose, onDone }: { row: Attendance; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(e: FormEvent) { e.preventDefault(); if (busy) return; setBusy(true); try { await api(`/attendance/${row.id}/void`, { body: reason.trim() ? { reason: reason.trim() } : {} }); onDone(); } catch (e) { setError(message(e)); setBusy(false); } }
  return <Modal title="Anular asistencia" onClose={() => { if (!busy) onClose(); }}><form onSubmit={submit}><p className="form-intro">Vas a anular la asistencia de <strong>{row.name}</strong>. El registro se conserva en el historial.</p><label>Motivo <span className="muted">(opcional)</span><textarea rows={3} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder="¿Qué pasó?" /></label>{error && <ErrorNotice text={error} />}<div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancelar</button><button className="button danger" disabled={busy}>{busy ? 'Anulando…' : 'Anular asistencia'}</button></div></form></Modal>;
}
