# Base de datos de la API (Supabase `fundigsac-admin`, esquema `app`)

Proyecto Supabase `ufutozmnnifimgfasmbe` (sa-east-1, plan gratuito). La API de `src/app/api/v1` usa el esquema `app`,
que la API REST pública de Supabase no expone, con el rol `fundigsac_api`.

## Migraciones aplicadas (10/11/2026)

El historial exacto con cada sentencia queda en `supabase_migrations.schema_migrations` del proyecto.

| Versión | Nombre | Contenido |
| --- | --- | --- |
| 20261110140248 | `app_platform_identity` | Backend V1 (folios, idempotencia), V2, V11, V12, V13, V14 y V15 (cuentas, roles, sesiones, tokens, códigos del personal, notas) |
| 20261110140308 | `app_inquiries_quotes` | Backend V4, V5 y V6 (consultas, cotizaciones, carrito) |
| 20261110140341 | `app_complaints_privacy_outbox_audit` | Backend V7 (Libro de Reclamaciones con trigger que impide reescribir la hoja), V8, V9 y V10 |
| 20261110140355 | `app_role_and_grants` | Rol `fundigsac_api`, permisos mínimos, RLS y `app.next_folio()` |
| 20261110140631 | `app_rate_limits` | Límites de frecuencia en ventana fija (`app.hit_rate_limit()`) |

Diferencias con las migraciones Flyway del Backend Java (`Backend/src/main/resources/db/migration`):

- Las restricciones con nombre de V11/V12 se crearon ya en su forma final (`user_accounts_active_credentials_ck`).
- No se creó V3 (catálogo): el catálogo vive en el sitio. Las líneas de cotización guardan el slug y el nombre que envía el sitio.
- No se creó `event_publication` (solo la usa Spring Modulith).
- En vez de `restrict_app_role()`, los permisos se dan y quitan explícitamente al rol `fundigsac_api`:
  - sin `DELETE` sobre cuentas, folios, consultas, cotizaciones, reclamaciones y solicitudes de derechos;
  - solo inserción en historiales, líneas de cotización, avisos legales, consentimientos y auditoría.

## Reglas

- Solo migraciones aditivas. Nunca `drop`, `truncate` ni borrado de hojas de reclamación.
- Nada de datos de prueba en producción: las pruebas de `tests/api` usan cuentas `@example.test` y se limpian antes de publicar.
