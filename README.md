# FUNDIGSAC · Gestor de usuarios

Panel de administración del sitio web de FUNDIGSAC. Muestra quién se registra en **fundigsac.com** y reúne en un
solo lugar todo lo que llega desde los formularios del sitio: cotizaciones, consultas de contacto, el Libro de
Reclamaciones y las solicitudes de eliminación de datos.

- **Producción:** https://fundigsac-admin.vercel.app
- **Repositorio:** https://github.com/FundigSac/Admin

> **Fase de diseño.** Todavía no hay base de datos conectada. El panel funciona completo con datos de
> demostración que se generan y guardan en el navegador (`localStorage`). La capa de datos ya sigue el contrato del
> Backend Java de FUNDIGSAC, así que conectarlo cambia un solo archivo (ver [Conectar el Backend](#conectar-el-backend)).

---

## Contenido

1. [Qué hace](#qué-hace)
2. [Acceso sin contraseña](#acceso-sin-contraseña)
3. [Elección del framework (investigación)](#elección-del-framework-investigación)
4. [Stack final](#stack-final)
5. [Arquitectura](#arquitectura)
6. [Diseño](#diseño)
7. [Cómo correrlo](#cómo-correrlo)
8. [Verificación y pruebas](#verificación-y-pruebas)
9. [Despliegue](#despliegue)
10. [Seguridad](#seguridad)
11. [Conectar el Backend](#conectar-el-backend)
12. [Fuentes](#fuentes)

---

## Qué hace

| Sección | Para qué sirve |
| --- | --- |
| **Resumen** | Lo importante del día: franja *Para hoy* con lo pendiente, plazos legales que vencen pronto, registros por día, el embudo *registro → correo verificado → cotización*, cómo llegan las cuentas y las últimas cuentas creadas. |
| **Usuarios** | Todas las cuentas (clientes del sitio y personal). Búsqueda, filtros por estado, método, tipo y fecha; orden por columnas; selección múltiple; suspender, reactivar, eliminar (con confirmación escrita); reenviar verificación; exportar a CSV; alta e invitación de personal. |
| **Ficha de usuario** | Contacto, datos de registro (método, página de origen, aviso de privacidad aceptado), uso del sitio, sus cotizaciones, su historial, roles con permisos efectivos y notas internas. |
| **Actividad** | Auditoría agrupada por día: registros, ingresos, verificaciones, cotizaciones y cada cambio del personal con su responsable. |
| **Cotizaciones** | Pedidos de precio desde `/cotizar`, las fichas de producto y el carrito: partidas con DN y cantidades, proyecto, destino y flujo *nueva → en revisión → cotizada → ganada/perdida*. |
| **Consultas** | Mensajes de `/contacto` (documentación o reunión) con respuesta por correo desde la misma ficha. |
| **Reclamaciones** | Libro de Reclamaciones con la hoja completa (estructura del Anexo I del D.S. 101-2022-PCM), plazo de **15 días hábiles** contado sin fines de semana ni feriados, y respuesta por el medio que eligió el consumidor. |
| **Privacidad** | Solicitudes de eliminación de cuenta y datos (`/eliminar-cuenta`) con los cuatro pasos que publica el sitio y el plazo de **10 días hábiles** (art. 69.3 del D.S. 016-2024-JUS). |
| **Roles y permisos** | Los 7 roles y 15 permisos del Backend (`com.fundigsac.identity.domain.Role`) en una matriz, con los miembros de cada rol. |
| **Configuración** | Perfil, tema claro/oscuro/sistema, idioma ES/EN, densidad de tablas, avisos por correo con vista previa del mensaje, seguridad y datos de demostración. |

Todo se entiende sin conocimientos técnicos: cada cifra y gráfico tiene una ayuda **(i)** en lenguaje simple, los
gráficos se resumen en una frase ("De cada 10 personas que se registran, 3 piden una cotización"), los estados
filtrados explican qué significan y la **Guía rápida** (botón `?` de la barra superior) explica secciones y colores.

## Acceso sin contraseña

El personal **no usa contraseña**. El ingreso es en dos pasos:

1. Escribe su correo corporativo y pide un código.
2. Recibe un **código de 6 dígitos** por correo y lo escribe (o lo pega) en el panel.

Reglas (las aplica el Backend en `POST /api/v1/auth/staff/code` y `/code/verify`; la demostración las simula en
`src/lib/session.ts`):

- El código es aleatorio, **vence a los 10 minutos** y **sirve una sola vez**.
- **5 intentos** por código; al agotarlos hay que pedir otro.
- Reenviar exige esperar **60 segundos**.
- La respuesta a "enviar código" es **la misma exista o no la cuenta**, para no revelar quién es del personal.
- `?next=` solo acepta rutas internas (sin redirecciones abiertas).

Con Backend, el código llega de verdad al correo (en local, a Mailpit: http://localhost:8025) y la sesión queda en
cookies `HttpOnly` firmadas. En la demostración, una **bandeja de demostración** en la pantalla de acceso muestra el
código que llegaría. Cuenta: `admin@fundigsac.local` (la misma que siembra el Backend en local).

## Elección del framework (investigación)

Se compararon las opciones vigentes en octubre de 2026 para un panel interno detrás de un inicio de sesión.

### 1. Framework de aplicación

| Opción | A favor | En contra | Veredicto |
| --- | --- | --- | --- |
| **Next.js 16 (App Router)** | Mismo stack que el sitio (`Frontend/`), el equipo ya lo conoce; despliegue nativo en Vercel; `proxy.ts` protege rutas en el servidor sin parpadeo; puede actuar de BFF para guardar el token del Backend en una cookie HttpOnly; división de código por ruta. En la medición de FocusReactive pinta el dashboard antes que Vite (568 ms frente a 1 312 ms en Slow 4G). | Más pesado para un panel que no necesita SEO; build y arranque en desarrollo algo más lentos. | **Elegido** |
| Vite + React + TanStack Router | La recomendación más repetida para paneles detrás de login: SPA ligera, HMR más rápido, tipado de rutas excelente. | Habría que montar aparte la protección de rutas en servidor, las cabeceras de seguridad y el BFF; segundo stack distinto al del sitio. | Buena alternativa |
| React Router 7 (modo framework) | SSR y camino de migración desde Remix. | Sin ventajas claras sobre Next para este equipo y este hosting. | Descartado |
| TanStack Start | Full-stack sobre Vite, muy prometedor. | Aún en Release Candidate según su documentación (agosto 2026). | Descartado por madurez |
| Refine / React-admin | Aceleran CRUD con muchos recursos. | Imponen su estructura y estética; más difícil lograr un diseño propio de FUNDIGSAC. | Descartado |

**Por qué Next.js aunque las guías prefieran Vite para paneles:** la razón técnica de Vite (no hace falta SEO) es
cierta, pero aquí pesan más tres cosas: un solo stack para todo el proyecto, el hosting ya en Vercel y que el
Backend Java emite JWT que conviene guardar en una cookie HttpOnly detrás de un BFF, algo que Next resuelve sin
infraestructura extra. El panel no pierde la ventaja de SEO de Next: está marcado `noindex` a propósito.

### 2. Datos, tablas, formularios y gráficos

| Necesidad | Opciones evaluadas | Elegida | Motivo |
| --- | --- | --- | --- |
| Datos del servidor | Server Components solos, SWR, **TanStack Query** | TanStack Query 5 | Caché, reintentos, invalidación tras cada cambio y paginación con `keepPreviousData`; la guía oficial lo recomienda para datos interactivos que se refrescan. |
| Tablas | **TanStack Table**, AG Grid, MUI DataGrid | TanStack Table 9 | Headless y la más liviana (~15 KB); AG Grid ronda 150–200 KB. Orden, selección y paginación en modo *manual*, listos para paginar en el Backend. |
| Formularios | **React Hook Form + Zod**, Formik | RHF + Zod | Los mismos que usa el sitio; validación tipada (RUC con dígito verificador SUNAT, celular peruano). |
| Gráficos | Recharts, Nivo, visx, Chart.js, **SVG propio** | SVG propio | Recharts y Nivo pesan 140–170 KB gzip; un gráfico de línea y listas de barras propios pesan casi nada y siguen las reglas de diseño (línea recta de 2 px, escala redonda, sin leyenda para una serie). |
| Componentes de UI | shadcn/ui, MUI, Ant Design, Mantine, **CSS propio con tokens** | CSS propio | Sin dependencias de estilos en tiempo de ejecución, identidad visual propia y elementos nativos accesibles (`<dialog>` con foco atrapado y Esc). |
| Íconos | Lucide, **Phosphor** | Phosphor (dúotono) | El estilo dúotono toma el azul de la marca en el ítem activo y se aleja del aspecto genérico. |

## Stack final

| Pieza | Versión |
| --- | --- |
| Next.js (App Router, Turbopack) | 16.4.2 |
| React | 19.3.1 |
| TypeScript | 5.9.3 |
| TanStack Query | 5.104.1 |
| TanStack Table | 9.2.6 |
| React Hook Form · Zod · @hookform/resolvers | 7.89.0 · 4.6.5 · 5.9.1 |
| Phosphor Icons | 2.1.10 |
| Tipografía | IBM Plex Sans (3 pesos) + IBM Plex Mono (solo para códigos, documentos y horas), alojadas por `next/font` |
| Pruebas | Playwright 1.64 + axe-core |

Las versiones están fijadas (`--save-exact`) y se eligieron con al menos dos semanas de publicadas.

## Arquitectura

```
src/
├─ app/
│  ├─ (auth)/login/          Acceso sin contraseña (correo → código)
│  ├─ (panel)/               Pantallas protegidas por src/proxy.ts
│  │  ├─ panel/              Resumen
│  │  ├─ usuarios/ [id]/     Lista y ficha de usuario
│  │  ├─ cotizaciones/ consultas/ reclamaciones/ privacidad/   Colas de atención (lista + ficha)
│  │  ├─ actividad/ roles/ configuracion/
│  │  └─ layout.tsx          Marco del panel (barra lateral, búsqueda Ctrl K, guía rápida)
│  └─ layout.tsx             Fuente, tema sin parpadeo, proveedores
├─ components/
│  ├─ shell/                 Marco, búsqueda rápida, guía, selectores de tema e idioma
│  ├─ cases/                 Piezas comunes de las colas (lista, plazos, historial, responsable)
│  ├─ users/                 Tabla TanStack, formulario y confirmaciones
│  ├─ charts/                Gráfico de línea en SVG
│  └─ ui/                    Íconos, diálogo, menú, avisos, ayuda (i), cifras animadas
├─ data/                     Tipos, permisos del Backend y datos de demostración
├─ lib/
│  ├─ api/                   Contrato + adaptador local + hooks de TanStack Query
│  ├─ i18n/                  Textos ES/EN (también las colas)
│  ├─ business-days.ts       Días hábiles con feriados nacionales del Perú 2026–2027
│  ├─ session.ts             Código de un solo uso y sesión de demostración
│  └─ prefs.tsx              Tema, idioma, densidad y tamaño de página
├─ proxy.ts                  Protección de rutas (Next 16)
└─ styles/                   Tokens, base, componentes, pantallas y movimiento
```

Decisiones clave:

- **Un contrato, dos adaptadores.** `src/lib/api/contract.ts` define listas paginadas con la forma de
  `PageResult` del Backend. Hoy lo cumple `mock-adapter.ts`; mañana un `http-adapter.ts`.
- **Una sola fuente de verdad.** Los conteos (cotizaciones de una cuenta, colas pendientes, plazos) se calculan a
  partir de los registros, nunca se escriben a mano; la ficha, la lista y la auditoría siempre coinciden.
- **Plazos legales en días hábiles** con los feriados nacionales; el Resumen pone primero el plazo más urgente.

## Diseño

- Dirección **registro industrial** (2026-10-20, elegida por el usuario para quitar el aire de plantilla): se lee como
  un libro de control de ingeniería. Marco gris neutro y hoja blanca; las secciones no son tarjetas sino bloques
  abiertos bajo una regla de tinta (como el cajetín de un plano); cifras grandes con etiquetas en versalitas; estados
  como marca cuadrada + texto (sin pastillas de color); avatares neutros; menú con regla azul a la izquierda; conteos
  diarios en columnas con la media marcada. El azul FUNDIGSAC (`#0972a1`) solo marca datos y lo activo.
- Tipografía **IBM Plex Sans** para leer y **Plex Mono** solo para lo que se copia carácter a carácter: códigos de caso
  (`COT-2026-0521`), RUC/DNI, claves de permisos (`catalog:read`), IDs y horas del registro de actividad.
- Skills instaladas a nivel de proyecto (`Diego Software/.agents/skills`): `frontend-design`,
  `web-design-guidelines`, `design-taste-frontend` e `impeccable`.
- **Modo oscuro** neutro (sin azul marino) y **modo claro**; ES/EN en todo el panel.
- **Animaciones breves** (120–520 ms, solo transform y opacidad): llegada escalonada de cada pantalla y de la lista
  *Para hoy*, cifras que cuentan, columnas del gráfico que crecen en cascada (≤ 360 ms en total), barras que crecen,
  subrayado de la pestaña que se abre desde el centro, regla del menú que crece al navegar y fundido al cambiar de
  tema. Con "reducir movimiento" todo aparece directo.
- **Sin saltos de diseño:** *Para hoy* muestra siempre sus cinco colas (las que están en 0, atenuadas) y los textos bajo
  las cifras y la frase del gráfico reservan su alto, así nada se mueve cuando llegan los datos.
- **Responsive** de 320 px a 1920 px: el menú se pliega en hoja lateral, las tablas pasan a listas de dos líneas en
  teléfono y las columnas secundarias se ocultan según el ancho real de la tabla (container queries).
- **Accesibilidad:** Lighthouse 100, foco visible, estados con marca + texto (nunca solo color), contraste AA en
  ambos temas, áreas táctiles de 36 px o más en teléfono.

## Cómo correrlo

Requisitos: Node.js 24 y npm 11.

```bash
npm install
npm run dev
```

Abre http://127.0.0.1:3100 y pulsa **Entrar a la demo** (entra directo como administrador). Para probar el flujo
completo pulsa **Probar con código**, luego **Enviar código** y **Completar el código** (el código aparece en la
bandeja de demostración).

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en el puerto 3100 |
| `npm run build` / `npm start` | Compilación y servidor de producción |
| `npm run lint` | ESLint (reglas de Next y del compilador de React) |
| `npm run typecheck` | TypeScript estricto |
| `npm run test:e2e` | Pruebas Playwright: flujo completo y accesibilidad con axe |
| `node scripts/responsive-audit.mjs [url] [--shots]` | Recorre 19 pantallas en 11 anchos (320–1920 px) y reporta desbordes, textos cortados y botones pequeños |

Solo en desarrollo, `?__demo` en cualquier URL abre una sesión de demostración (para capturas automáticas). En
producción esa ruta no existe.

## Verificación y pruebas

- `npm run typecheck`, `npm run lint` y `npm run build` sin errores ni avisos.
- Inspector de la skill de diseño (`inspect.mjs --app`) en 1440, 768 y 390 px: 0 fallos en todas las pantallas.
- Auditoría responsive propia en 11 anchos.
- Lighthouse (escritorio): Accesibilidad 100 · Buenas prácticas 100 (SEO bajo a propósito: `noindex`).
- Pruebas e2e en `tests/`.

## Despliegue

Proyecto de Vercel **`fundigsac-admin`** (región `gru1`, São Paulo), framework declarado en `vercel.json`.

```bash
npx --yes vercel@64 deploy --prod --yes
```

Se despliega desde una copia limpia del repositorio (`git archive HEAD`) para no subir archivos locales.

## Seguridad

- Cabeceras en `next.config.ts`: CSP sin terceros, `frame-ancestors 'none'`, `X-Robots-Tag: noindex`, HSTS,
  `Referrer-Policy`, `Permissions-Policy`, `nosniff`; además `robots.txt` bloquea todo.
- Acceso sin contraseña con las reglas de la sección anterior; cookie `SameSite=Strict` y `Secure` en HTTPS.
- Exportación CSV protegida contra inyección de fórmulas en Excel.
- Nunca se ofrece suspender o eliminar la propia cuenta; eliminar exige escribir `ELIMINAR`.

## Conectar el Backend

Ya está conectado. Con `NEXT_PUBLIC_DATA_SOURCE=backend`, `BACKEND_URL` y `ADMIN_AUTH_SECRET` (ver `.env.example`):

- `src/app/api/session/[action]` pide y verifica el código y abre la sesión: el perfil va en `fa-session` (ruta /,
  firmada, la revisan el proxy y el layout) y los tokens de la API en `fa-api` (solo ruta /api), ambas `HttpOnly`.
- `src/app/api/backend/[...path]` reenvía `/api/backend/staff/**` a `/api/v1/staff/**` con el token (renovado solo) y
  el `If-Match` de cada cambio.
- `src/lib/api/http-adapter.ts` cumple `UsersApi` contra esas rutas; `src/lib/api/index.ts` elige el adaptador según
  la variable. `capabilities` dice qué permite cada origen (por ejemplo, con Backend solo se invita personal y las
  notas internas existen solo en las reclamaciones) y las pantallas se adaptan solas.

Sin esas variables (como en el despliegue de Vercel, que aún no tiene una API pública) el panel sigue siendo la
demostración con datos del navegador.

## Fuentes

Investigación de octubre de 2026 usada para la elección del stack:

- FocusReactive — *Vite vs Next.js in 2026: Benchmarked, Not Guessed*: https://focusreactive.com/blog/vite-vs-nextjs-when-to-use-which-an-honest-comparison/
- The New Stack — *Next.js, React Router, TanStack: When To Use Each*: https://thenewstack.io/next-js-react-router-tanstack-when-to-use-each/
- Kanopy Labs — *React Router v7 vs TanStack Start vs Next.js*: https://kanopylabs.com/blog/react-router-v7-vs-tanstack-start-vs-nextjs
- DevToolbox — *TanStack Router vs React Router v7 (2026)*: https://devtoolbox.blog/tanstack-router-vs-react-router-v7-2026/
- Refine — *refine vs react-admin*: https://refine.dev/blog/refine-vs-react-admin/
- PkgPulse — *TanStack Table vs AG Grid vs React Data Grid 2026*: https://www.pkgpulse.com/guides/tanstack-table-vs-ag-grid-vs-react-data-grid-2026
- TanStack — comparación de librerías de gráficos: https://tanstack.com/charts/latest/docs/comparison
- TanStack Query — *Advanced Server Rendering*: https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
- AdminLTE — *shadcn/ui vs MUI vs Ant Design*: https://adminlte.io/blog/shadcn-ui-vs-mui-vs-ant-design/

Base legal mostrada en el panel:

- Libro de Reclamaciones: art. 24.1 del Código de Protección y Defensa del Consumidor (Ley 29571, mod. Ley 31435) y
  D.S. 101-2022-PCM (respuesta en 15 días hábiles improrrogables).
- Eliminación de datos: Ley 29733, art. 20, y D.S. 016-2024-JUS (art. 69.3: 10 días hábiles; art. 71: ampliación
  única).
