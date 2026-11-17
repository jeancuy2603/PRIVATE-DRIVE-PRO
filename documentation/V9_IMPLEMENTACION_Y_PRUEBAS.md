# PRIVATE DRIVE PRO V9 — Implementación y validación

## Alcance añadido en V9

### Compartición de archivos
- `POST /api/files/:id/shares`: compartir un archivo con una cuenta activa por correo. Acepta `permission`: `VIEW`, `DOWNLOAD` o `EDIT`.
- `GET /api/files/:id/shares`: listar permisos de un archivo propio.
- `DELETE /api/files/:id/shares/:shareId`: revocar un permiso creado por el propietario.
- `GET /api/files/shared-with-me`: listar archivos recibidos, sin exponer nombres físicos de almacenamiento.
- La vista previa admite archivos propios y archivos compartidos con permisos vigentes.
- La descarga admite archivos propios y compartidos con permiso `DOWNLOAD` o `EDIT`. `VIEW` no habilita descarga.
- El frontend incluye la sección «Compartidos conmigo» y acciones de compartir para los archivos propios.

### Búsqueda y resumen
- `GET /api/files/search?q=texto`: busca nombres de archivos y carpetas del propietario autenticado. Requiere al menos dos caracteres y limita los resultados.
- `GET /api/files/dashboard`: devuelve conteos y uso de almacenamiento consultados desde MySQL; no utiliza datos simulados.

### Integridad
- `database/migrations/003_file_sharing_constraints.sql` limpia duplicados de pares archivo/usuario y agrega la clave única necesaria para actualizar permisos sin duplicarlos.
- El esquema de instalación nueva ya incluye la restricción e índice equivalentes.
- Se agregaron pruebas unitarias para identificadores, nombres, correos, permisos y escape de comodines SQL LIKE.

## Migración de una base existente

1. Haz un respaldo antes de modificar la base.
2. Ejecuta la migración una sola vez:

```powershell
mysql -u root -p private_drive_pro < database/migrations/003_file_sharing_constraints.sql
```

Si tu base tiene otro nombre, reemplaza `private_drive_pro` por el valor de `MYSQL_DATABASE` de tu archivo `backend/.env`.

## Pruebas disponibles

Desde `backend`:

```powershell
npm test
```

El paquete incluye pruebas unitarias de utilidades. La prueba de integración con MySQL requiere credenciales y una base de pruebas configurada por el operador; no se ejecuta automáticamente contra datos reales.

Comprobación sintáctica adicional de los archivos JavaScript del backend:

```powershell
Get-ChildItem .\src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

## Endpoints nuevos — ejemplos

Compartir:

```http
POST /api/files/42/shares
Content-Type: application/json
Authorization: Bearer <token>

{"email":"destinatario@example.com","permission":"DOWNLOAD"}
```

Buscar:

```http
GET /api/files/search?q=informe
Authorization: Bearer <token>
```

Resumen:

```http
GET /api/files/dashboard
Authorization: Bearer <token>
```

## Estado de validación de esta entrega

- ZIP: integridad comprobada después de generar el paquete.
- Backend JavaScript: comprobación sintáctica ejecutada.
- Pruebas unitarias: 5/5 superadas.
- Frontend React/Vite: no compilado en este entorno; no estaban disponibles las dependencias `node_modules`.
- Frontend Angular: no compilado en este entorno; no estaban disponibles las dependencias `node_modules`.
- MySQL: migración y consultas requieren validación en la instancia local del usuario.
- SMTP: requiere prueba real con la configuración SMTP del usuario.

No declarar el sistema al 100 % hasta completar las pruebas de aceptación descritas en `AUDITORIA_Y_ESTADO.md` con MySQL, correo y ambos frontends en el equipo de despliegue.
