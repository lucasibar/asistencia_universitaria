import { useEffect, useRef, type ReactNode } from 'react';
import { Check, LoaderCircle, X, AlertCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
export function Brand({ light = false }: { light?: boolean }) { return <Link to="/" className={`brand ${light ? 'light' : ''}`} aria-label="Presente, inicio"><span className="brand-icon"><Check size={22} strokeWidth={3} /></span>presente<span className="brand-dot">.</span></Link>; }
export function Loading({ text = 'Un momento…' }: { text?: string }) { return <div className="loading" role="status"><LoaderCircle className="spin" size={25} /><span>{text}</span></div>; }
export function ErrorNotice({ text, retry }: { text: string; retry?: () => void }) { return <div className="error-notice" role="alert"><AlertCircle size={19} /><span>{text}</span>{retry && <button className="text-button" onClick={retry}>Reintentar</button>}</div>; }
export function GoogleButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) { return <button className="google-button" onClick={onClick} disabled={disabled}><span className="google-letter" aria-hidden>G</span>Continuar con Google<ArrowRight size={18} /></button>; }
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current; dialog?.showModal();
    return () => { dialog?.close(); };
  }, []);
  return <dialog ref={ref} className="modal" onCancel={event => { event.preventDefault(); onClose(); }} aria-label={title}>
    <div className="modal-header"><h2>{title}</h2><button className="icon-button" aria-label="Cerrar ventana" onClick={onClose}><X size={20} /></button></div>{children}
  </dialog>;
}
