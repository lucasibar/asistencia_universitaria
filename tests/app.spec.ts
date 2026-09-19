import { test, expect, type Page } from '@playwright/test';
const userId = '123e4567-e89b-42d3-a456-426614174001';
const courseId = '123e4567-e89b-42d3-a456-426614174002';
const sessionId = '123e4567-e89b-42d3-a456-426614174003';
const courses = [
  { id: courseId, name: 'Coaching N1', class_count: 14, archived_at: null },
  { id: 'course-2', name: 'Coaching N2', class_count: 8, archived_at: null },
  { id: 'course-3', name: 'Coaching Avanzado', class_count: 3, archived_at: null },
];
const attendance = { id: 'attendance-1', user_id: userId, name: 'Lucas Ibar', email: 'lucas@example.com', checked_in_at: new Date().toISOString(), status: 'PRESENT', source: 'QR' };
async function auth(page: Page) {
  await page.addInitScript(({ userId }) => {
    localStorage.setItem('sb-demo-auth-token', JSON.stringify({ access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600,
      user: { id: userId, aud: 'authenticated', email: 'lucas@example.com', app_metadata: { provider: 'google' }, user_metadata: { full_name: 'Lucas Ibar' }, created_at: new Date().toISOString() } }));
  }, { userId });
}
async function backend(page: Page, role = 'ADMIN') {
  let closed = false;
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://demo.supabase.co/**', route => route.fulfill({ json: { user: { id: userId } } }));
  await page.route('http://127.0.0.1:3000/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = {};
    if (path === '/me') data = { id: userId, name: 'Lucas Ibar', email: 'lucas@example.com', role, academic_first_name: 'Lucas', academic_last_name: 'Ibar' };
    else if (path === '/courses') data = courses;
    else if (path === `/courses/${courseId}/classes`) data = [{ id: 'class-1', name: 'Clase 14', class_date: new Date().toISOString(), session_id: sessionId, session_status: 'OPEN', present_count: 1, archived_at: null }];
    else if (path === `/attendance-sessions/${sessionId}`) data = { id: sessionId, course_id: courseId, class_id: 'class-1', class_name: 'Clase 14', course_name: 'Coaching N1', effective_status: closed ? 'CLOSED' : 'OPEN', started_at: new Date().toISOString(), expires_at: new Date(Date.now() + 300000).toISOString(), server_time: new Date().toISOString(), present_count: 1 };
    else if (path.endsWith('/close')) { closed = true; data = { status: 'CLOSED' }; }
    else if (path.endsWith('/qr')) data = { qrToken: 'qr-current', qrUrl: 'https://example.com/a/qr-current', serverTime: new Date().toISOString(), expiresAt: new Date(Date.now() + 10000).toISOString(), rotationSeconds: 10 };
    else if (path.endsWith('/attendance')) data = [attendance];
    else if (path === '/attendance-sessions') data = { id: sessionId };
    else if (path === '/attendance/check-in/start') data = { attemptId: 'attempt-1', attemptSecret: 'secret-1', expiresAt: new Date(Date.now() + 60000).toISOString() };
    else if (path === '/attendance/check-in/confirm') data = { status: 'PRESENT', attendance };
    else if (path === '/students') data = [{ id: userId, name: 'Lucas Ibar', email: 'lucas@example.com' }];
    await route.fulfill({ json: data });
  });
}
test('login explains student access and fits mobile', async ({ page }) => {
  await backend(page); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Tu clase empieza acá.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/login-mobile.png', fullPage: true });
});
test('teacher views courses, searches and creates a session once', async ({ page }) => {
  await auth(page); await backend(page); let count = 0;
  page.on('request', request => { if (request.url().endsWith('/attendance-sessions') && request.method() === 'POST') count++; });
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Mis cursos.' })).toBeVisible();
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  await page.getByRole('textbox', { name: 'Buscar curso' }).fill('Avanzado');
  await expect(page.getByRole('heading', { name: 'Coaching Avanzado' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Coaching N1', exact: true })).toHaveCount(0);
  await page.goto(`/cursos/${courseId}`);
  await page.getByRole('button', { name: 'Tomar asistencia' }).click();
  await page.getByRole('button', { name: 'Generar QR' }).click();
  await expect(page).toHaveURL(`/sesiones/${sessionId}`);
  await expect(page.getByText('El código se renueva automáticamente')).toBeVisible();
  await page.screenshot({ path: 'test-results/session-desktop.png', fullPage: true });
  expect(count).toBe(1);
});
test('student auto-confirms once under StrictMode, with no identity in body', async ({ page }) => {
  await auth(page); await backend(page); const starts: unknown[] = []; const confirms: any[] = [];
  page.on('request', request => { if (request.url().endsWith('/check-in/start')) starts.push(request.postDataJSON()); if (request.url().endsWith('/check-in/confirm')) confirms.push(request.postDataJSON()); });
  await page.goto('/a/valid-qr');
  await expect(page.getByRole('heading', { name: '¡Presente!' })).toBeVisible();
  expect(starts).toHaveLength(1); expect(confirms).toEqual([{ attemptId: 'attempt-1', attemptSecret: 'secret-1' }]);
  expect(await page.evaluate(() => sessionStorage.getItem('attendance-pending'))).toBeNull();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/student-mobile.png', fullPage: true });
});
test('student attempt starts before Google login and survives reload', async ({ page }) => {
  await backend(page); let count = 0; page.on('request', r => { if (r.url().endsWith('/check-in/start')) count++; });
  await page.goto('/a/valid-qr'); await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeVisible();
  expect(await page.evaluate(() => Boolean(sessionStorage.getItem('attendance-pending')))).toBe(true);
  await page.reload(); await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeVisible(); expect(count).toBe(1);
});
test('OAuth callback resumes saved attempt without restarting expired QR', async ({ page }) => {
  await auth(page); await backend(page); let starts = 0;
  await page.addInitScript(() => { sessionStorage.setItem('oauth-destination', 'attendance'); sessionStorage.setItem('attendance-pending', JSON.stringify({ token: 'expired-qr', attemptId: 'attempt-1', attemptSecret: 'secret-1', expiresAt: new Date(Date.now() + 30000).toISOString() })); });
  page.on('request', r => { if (r.url().endsWith('/check-in/start')) starts++; });
  await page.goto('/auth/callback'); await expect(page.getByRole('heading', { name: '¡Presente!' })).toBeVisible(); expect(starts).toBe(0);
});
test('expired QR is shown as an error and never confirmed', async ({ page }) => {
  await auth(page); await backend(page); let confirms = 0;
  await page.route('**/attendance/check-in/start', route => route.fulfill({ status: 410, json: { code: 'QR_EXPIRED' } }));
  page.on('request', r => { if (r.url().endsWith('/check-in/confirm')) confirms++; });
  await page.goto('/a/expired'); await expect(page.getByText('Este código expiró.', { exact: false })).toBeVisible(); expect(confirms).toBe(0);
});
test('confirmation retry reuses the same attempt after network failure', async ({ page }) => {
  await auth(page); await backend(page); const bodies: unknown[] = [];
  await page.route('**/attendance/check-in/confirm', async route => {
    bodies.push(route.request().postDataJSON());
    if (bodies.length === 1) await route.abort(); else await route.fulfill({ json: { status: 'ALREADY_PRESENT', attendance } });
  });
  await page.goto('/a/valid-qr'); await page.getByRole('button', { name: 'Intentar nuevamente' }).click();
  await expect(page.getByRole('heading', { name: 'Ya estás presente' })).toBeVisible();
  expect(bodies).toHaveLength(2); expect(bodies[0]).toEqual(bodies[1]);
});
test('QR rotates and closing removes the scannable code', async ({ page }) => {
  await auth(page); await backend(page); let requests = 0;
  await page.route('**/qr', async route => { requests++; await route.fulfill({ json: { qrUrl: `https://example.com/a/qr-${requests}`, serverTime: new Date().toISOString(), expiresAt: new Date(Date.now() + 600).toISOString(), rotationSeconds: 10 } }); });
  await page.goto(`/sesiones/${sessionId}`); await expect.poll(() => requests).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Cerrar asistencia', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'La clase quedó registrada.' })).toBeVisible();
  await expect(page.locator('.qr-frame svg')).toHaveCount(0);
});
test('manual attendance uses selected profile and void preserves a reason', async ({ page }) => {
  await auth(page); await backend(page); let manual: any; let voided: any;
  page.on('request', r => { if (r.url().endsWith('/attendance/manual')) manual = r.postDataJSON(); if (r.url().endsWith('/void')) voided = r.postDataJSON(); });
  await page.goto(`/sesiones/${sessionId}`); await page.getByRole('button', { name: 'Agregar manualmente' }).click();
  await page.getByRole('textbox', { name: 'Nombre o correo' }).fill('Lucas');
  await page.getByRole('button', { name: 'Lucas Ibar lucas@example.com' }).click();
  await page.getByRole('button', { name: 'Registrar presente' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); expect(manual).toEqual({ userId });
  await page.getByRole('button', { name: 'Anular asistencia de Lucas Ibar' }).click();
  await page.getByRole('textbox', { name: 'Motivo' }).fill('Corrección');
  await page.getByRole('button', { name: 'Anular asistencia', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); expect(voided).toEqual({ reason: 'Corrección' });
});
test('archiving history requires explicit second confirmation', async ({ page }) => {
  await auth(page); await backend(page); const requests: any[] = [];
  await page.route('**/courses/*/archive', async route => { const body = route.request().postDataJSON(); requests.push(body); await route.fulfill(body.confirmWithAttendance ? { json: { status: 'ARCHIVED' } } : { status: 409, json: { code: 'ARCHIVE_CONFIRMATION_REQUIRED' } }); });
  await page.goto(`/cursos/${courseId}`); await page.getByRole('button', { name: 'Archivar curso' }).click();
  await page.getByRole('button', { name: 'Archivar', exact: true }).click();
  await expect(page.getByText('Este curso tiene asistencias registradas.', { exact: false })).toBeVisible(); expect(requests).toEqual([{ confirmWithAttendance: false }]);
  await page.getByRole('button', { name: 'Sí, archivar con asistencias' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); expect(requests[1]).toEqual({ confirmWithAttendance: true });
});
test('student cannot see the teacher dashboard', async ({ page }) => {
  await auth(page); await backend(page, 'STUDENT'); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Creá tu cuenta de profesor.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tomar asistencia' })).toHaveCount(0);
});

test('new teacher explicitly registers and reaches own courses', async ({ page }) => {
  await auth(page); await backend(page, 'STUDENT');
  let registered = false;
  await page.route('**/me', route => route.fulfill({ json: { id: userId, name: 'Lucas Ibar', email: 'lucas@example.com', role: registered ? 'ADMIN' : 'STUDENT' } }));
  await page.route('**/me/teacher', route => { registered = true; return route.fulfill({ json: { id: userId, name: 'Lucas Ibar', email: 'lucas@example.com', role: 'ADMIN' } }); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Creá tu cuenta de profesor.' })).toBeVisible();
  await page.getByRole('button', { name: 'Registrarme como profesor' }).click();
  await expect(page.getByRole('heading', { name: 'Mis cursos.' })).toBeVisible();
});
test('teacher downloads attendance for Excel', async ({ page }) => {
  await auth(page); await backend(page); await page.goto('/sesiones/' + sessionId);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar para Excel (CSV)' }).click();
  expect((await download).suggestedFilename()).toBe('asistencias-' + sessionId + '.csv');
});

test('student supplies academic identity before attendance and reuses it next class', async ({ page }) => {
  await auth(page); await backend(page, 'STUDENT'); let saved = false; let confirmations = 0;
  const profile = () => ({ id: userId, email: 'lucas@example.com', role: 'STUDENT', name: saved ? 'Juan Pérez' : 'Google Alias', academic_first_name: saved ? 'Juan' : null, academic_last_name: saved ? 'Pérez' : null });
  await page.route('**/me', route => route.fulfill({ json: profile() }));
  await page.route('**/me/academic-profile', route => {
    expect(route.request().postDataJSON()).toEqual({ firstName: 'Juan', lastName: 'Pérez' });
    saved = true; return route.fulfill({ json: profile() });
  });
  page.on('request', r => { if (r.url().endsWith('/check-in/confirm')) confirmations++; });
  await page.goto('/a/first-academic-qr');
  await expect(page.getByRole('heading', { name: 'Tu nombre en la universidad.' })).toBeVisible();
  expect(confirmations).toBe(0);
  await page.getByLabel('Nombre', { exact: true }).fill('Juan'); await page.getByLabel('Apellido', { exact: true }).fill('Pérez');
  await page.getByRole('button', { name: 'Guardar y registrar presente' }).click();
  await expect(page.getByRole('heading', { name: '¡Presente!' })).toBeVisible();
  await expect(page.getByText('Juan Pérez', { exact: true })).toBeVisible(); expect(confirmations).toBe(1);
  await page.goto('/a/next-academic-qr'); await expect(page.getByRole('heading', { name: '¡Presente!' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tu nombre en la universidad.' })).toHaveCount(0);
});
