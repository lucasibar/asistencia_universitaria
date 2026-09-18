# Presente · Frontend

Proyecto React + TypeScript + Vite + React Router, separado del backend NestJS que está en `../asistencia_universitaria.v1`.

## Iniciar

```powershell
npm ci
Copy-Item .env.example .env
# Completar las tres variables públicas.
npm run dev
```

Abrir `http://localhost:5173`. El backend debe estar en ejecución, con migraciones aplicadas y un profesor habilitado como ADMIN. Ver `../asistencia_universitaria.v1/README.md` para preparar Supabase.

Variables:

| Variable | Valor |
|---|---|
| `VITE_API_URL` | URL de NestJS, sin `/api`, por ejemplo `http://localhost:3000` |
| `VITE_SUPABASE_URL` | URL pública del mismo proyecto Supabase que usa Nest |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key o clave anon del proyecto |

No poner `DATABASE_URL`, claves service role, secreto de Google ni secreto QR en este proyecto. Vite expone las variables `VITE_*` en el navegador. [Documentación de variables de Vite](https://vite.dev/guide/env-and-mode).

## Google OAuth

En Supabase habilitar Google y autorizar estas URLs de retorno:

- Desarrollo: `http://localhost:5173/auth/callback`.
- Producción: `https://TU-FRONTEND.vercel.app/auth/callback` (o dominio propio).

Configurar en el backend `FRONTEND_URL` con ese mismo origen y agregarlo a `CORS_ORIGINS`. Usar el mismo hostname en el navegador y en OAuth: `localhost` y `127.0.0.1` tienen almacenamiento separado.

El frontend usa OAuth PKCE. Supabase procesa el código al volver a `/auth/callback`. El intento y su secreto se guardan en `sessionStorage` antes de salir a Google, y se recuperan en la misma pestaña. No se vuelve a validar un QR vencido después de OAuth: se confirma el intento ya creado. [OAuth con Supabase](https://supabase.com/docs/reference/javascript/auth-signinwithoauth).

## Rutas y funciones

- `/login`: acceso de profesores.
- `/`: cursos activos; crear curso y tomar asistencia.
- `/historial`: cursos activos y archivados.
- `/cursos/:id`: historial de clases y archivado del curso.
- `/sesiones/:id`: QR rotativo, modo proyección, contador, lista completa, búsqueda, alta manual, anulación y archivado de clase.
- `/a/:token`: inicio de intento inmediatamente al cargar, login si hace falta y confirmación automática.
- `/check-in`: reanudar el intento guardado después de OAuth.

Las vistas se adaptan a celular y escritorio. No hay dashboard de alumnos. La app utiliza el contrato de `../asistencia_universitaria.v1/API.md`, sin acceso directo a las tablas de Supabase.

El QR se solicita según su vencimiento. Los tiempos de presentación se calculan desde `serverTime` y un reloj monotónico, descontando conservadoramente la duración de la petición. Un código que ya venció se oculta mientras se obtiene el siguiente. La validación final siempre corresponde al backend.

Resumen y presentes se actualizan cada cuatro segundos, sin solicitudes de polling superpuestas. Las listas del backend se paginan; la búsqueda manual muestra hasta 50 perfiles y permite afinar la consulta. Un registro anulado permanece visible en el historial.

La creación de clases/cursos no se reintenta automáticamente ante timeout; se indica revisar el historial antes de volver a crear. La confirmación de un alumno sí se reintenta con el mismo intento y secreto. React StrictMode no duplica el inicio ni la confirmación. Las acciones de archivado con asistencias requieren confirmación explícita adicional.

## Verificar

```powershell
npm run build
npm test
```

Las pruebas Playwright usan Chrome instalado y una API/Supabase simulados: no registran asistencia real ni acceden a cuentas externas. Incluyen OAuth retomado, expiración, errores de red, deduplicación, permisos visuales, creación, QR, alta manual, anulación y archivado. En otro equipo, instalar Chrome con `npx playwright install chrome` o configurar `PLAYWRIGHT_CHANNEL=msedge` si Edge está instalado.

Capturas locales en `test-results/`: escritorio, proyección de clase y alumno móvil. Los artefactos de pruebas y credenciales están excluidos de Git.

Estas pruebas no reemplazan la prueba final con Google y el backend real. Para esa prueba hace falta completar las variables, migrar la base y habilitar al profesor.

## Vercel

Importar el repositorio y seleccionar **Root Directory: `asistencia_universitaria`**. Framework Vite, build `npm run build`, output `dist`. Cargar las tres variables públicas y volver a construir cuando cambien. `vercel.json` incluye las rutas SPA para QR y OAuth y headers básicos. Registrar el dominio final en Supabase y en el CORS del backend.

El proyecto queda preparado para desplegar; este trabajo no crea un despliegue ni configura credenciales reales. Sin variables configuradas se muestra el acceso deshabilitado, sin datos de demostración ni simulaciones de asistencia.
