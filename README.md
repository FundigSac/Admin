# FUNDIGSAC · Gestor de usuarios

Panel de administración para ver y gestionar las cuentas que se registran en el sitio web de FUNDIGSAC.

> **Fase de diseño.** Todavía no hay base de datos ni backend conectado: el panel usa datos de demostración
> generados en el navegador y guarda los cambios en `localStorage`.

## Requisitos

- Node.js 24
- npm 11

## Cómo correrlo

```bash
npm install
npm run dev
```

Abre http://127.0.0.1:3100.

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en el puerto 3100 |
| `npm run build` | Compilación de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sin emitir |
| `npm run test:e2e` | Pruebas Playwright (flujo completo + accesibilidad con axe) |
