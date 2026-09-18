import { StrictMode, Component, Suspense, lazy, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth';
import { StudentPage } from './StudentPage';
import { Brand, Loading } from './ui';
import './styles.css';
const AdminLayout = lazy(() => import('./Admin').then(m => ({ default: m.AdminLayout })));
const CoursePage = lazy(() => import('./Admin').then(m => ({ default: m.CoursePage })));
const Dashboard = lazy(() => import('./Admin').then(m => ({ default: m.Dashboard })));
const Login = lazy(() => import('./Login').then(m => ({ default: m.Login })));
const Callback = lazy(() => import('./Login').then(m => ({ default: m.Callback })));
const SessionPage = lazy(() => import('./SessionPage').then(m => ({ default: m.SessionPage })));
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <main className="center-page"><h1>Algo no salió bien.</h1><p>Recargá la página para volver a intentar.</p><button className="button primary" onClick={() => location.reload()}>Recargar</button></main> : this.props.children; }
}
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><BrowserRouter><AuthProvider><Suspense fallback={<Loading text="Cargando…" />}><Routes>
  <Route path="/login" element={<Login />} /><Route path="/auth/callback" element={<Callback />} />
  <Route path="/a/:token" element={<StudentPage />} /><Route path="/check-in" element={<StudentPage />} />
  <Route element={<AdminLayout />}><Route path="/" element={<Dashboard />} /><Route path="/historial" element={<Dashboard history />} /><Route path="/cursos/:id" element={<CoursePage />} /><Route path="/sesiones/:id" element={<SessionPage />} /></Route>
  <Route path="*" element={<main className="center-page"><Brand /><h1>Esta página no está disponible.</h1><Link className="button primary" to="/">Ir al inicio</Link></main>} />
</Routes></Suspense></AuthProvider></BrowserRouter></ErrorBoundary></StrictMode>);
