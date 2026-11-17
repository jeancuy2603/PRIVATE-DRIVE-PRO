# PRIVATE DRIVE PRO — Paquete de actualización

Plataforma de almacenamiento privado con React/Vite (usuario), Angular (administración), Node.js/Express y MySQL.

## Antes de reemplazar
1. Detén los procesos.
2. Haz una copia completa del proyecto actual.
3. Haz un backup de MySQL.
4. Conserva tu `backend/.env` y `backend/storage` actuales.
5. Extrae este paquete sobre una copia del proyecto y sigue `documentation/MANUAL_TECNICO.md`.

## Aplicaciones
- Usuario: `frontend-user` — React + Vite.
- Administración: `frontend-admin` — Angular 18.
- API: `backend` — Express.
- Base de datos: `database`.

## Instalación rápida en Windows
Consulta `documentation/INSTALACION.md` y `documentation/MANUAL_TECNICO.md`.

## V9 — funcionalidades añadidas
- Compartición de archivos con permisos VIEW, DOWNLOAD y EDIT.
- Vista de archivos compartidos conmigo.
- Búsqueda de archivos y carpetas por API.
- Resumen de almacenamiento calculado desde MySQL.
- Migración `database/migrations/003_file_sharing_constraints.sql`.
- Pruebas unitarias del backend (`npm test`).

Consulta `documentation/V9_IMPLEMENTACION_Y_PRUEBAS.md` para instalar la migración y conocer los resultados de validación.

## Documentación
- `documentation/MANUAL_USUARIO.md`
- `documentation/MANUAL_ADMINISTRADOR.md`
- `documentation/MANUAL_TECNICO.md`
- `documentation/AUDITORIA_Y_ESTADO.md`
- `documentation/ARQUITECTURA.md`
- `documentation/SEGURIDAD.md`

## Seguridad del paquete
Este ZIP no contiene `.env`, `node_modules`, cachés ni archivos privados de `backend/storage`. Crea tu `.env` local desde `backend/.env.example`. Rota las claves y contraseñas que hayan estado presentes en el ZIP original.

## Estado de verificación
La V9 es una actualización funcional incremental, no una certificación de cierre. No declares el sistema 100 % terminado hasta superar pruebas de compilación, integración y aceptación con MySQL en tu entorno Windows. Consulta `documentation/AUDITORIA_Y_ESTADO.md`.

## V10 — refinamiento visual y accesibilidad

Esta actualización mejora la distribución del frontend de usuario y del panel administrativo sin reescribir la lógica de negocio. Incluye menú lateral con scroll independiente, mejor uso del ancho, tarjetas y controles refinados, estados de foco y adaptación responsive. Consulta `documentation/AUDITORIA_Y_ESTADO.md` para los resultados de validación y los pendientes. El proyecto aún no está certificado al 100 %.
