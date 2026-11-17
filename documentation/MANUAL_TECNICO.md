# Manual técnico — PRIVATE DRIVE PRO

## 1. Arquitectura observada
El repositorio contiene tres aplicaciones:
- `frontend-user`: React 18 + Vite.
- `frontend-admin`: Angular 18.
- `backend`: Node.js (ES modules) + Express.
- `database`: esquema y migraciones MySQL.

Los dos frontends consumen la API REST del backend. Los archivos se guardan en `backend/storage/private`, fuera de una carpeta pública. MySQL persiste usuarios, salas, archivos, sesiones y auditoría.

> Nota: el panel administrativo actual es Angular, no React. Se conserva la arquitectura existente para no sustituir una aplicación completa sin una migración aprobada.

## 2. Requisitos
- Windows 10/11.
- Node.js 20 LTS o superior y npm.
- MySQL 8.
- MySQL Workbench opcional.
- PowerShell.

No se requiere Docker.

## 3. Instalación limpia
1. Descomprime el proyecto en una ruta sin caracteres especiales, por ejemplo `C:\Proyectos\PRIVATE-DRIVE-PRO`.
2. Crea la base ejecutando `database/schema.sql` en MySQL.
3. Copia `backend/.env.example` a `backend/.env`.
4. Completa las credenciales locales y genera secretos JWT distintos, aleatorios y largos.
5. Instala dependencias y ejecuta cada servicio en una terminal separada:

```powershell
# Terminal 1 — API
Set-Location .\backend
npm install
npm run seed:admin
npm run dev

# Terminal 2 — Usuario
Set-Location .\frontend-user
npm install
npm run dev

# Terminal 3 — Administración
Set-Location .\frontend-admin
npm install
npm start
```

Direcciones locales:
- Usuario: `http://localhost:5173`
- Administración: `http://localhost:4200`
- Salud de API: `http://localhost:4000/api/health`

## 4. Variables de entorno
Usa `backend/.env.example` como plantilla. Configura al menos:
- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`.
- `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`, siempre diferentes.
- `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD`.
- `STORAGE_ROOT` y `MAX_FILE_MB`.
- SMTP si necesitas envío de correo.
- `CORS_ORIGINS` con los orígenes exactos que utilices.

No copies un `.env` compartido por otra persona. Nunca incluyas `.env` en ZIP, Git o tickets.

## 5. Migraciones
Para una base de datos existente, revisa las migraciones en `database/migrations` y ejecuta únicamente las que todavía no estén aplicadas. Haz backup antes de alterar el esquema. `schema.sql` es la referencia para una instalación nueva; no ejecutes el esquema completo sobre una base que ya contiene datos sin revisar el impacto.

## 6. Comandos de comprobación
```powershell
# Backend
Set-Location .\backend
npm test
npm start

# Frontend usuario
Set-Location ..\frontend-user
npm run build

# Frontend admin
Set-Location ..\frontend-admin
npm run build
```

Comprueba además `/api/health`, login de usuario y administrador, permisos, carga/descarga, carpetas, papelera y persistencia después de reiniciar los servicios.

## 7. Estructura de carpetas
- `backend/src/routes`: definición de endpoints.
- `backend/src/controllers`: lógica HTTP y operaciones de dominio.
- `backend/src/middleware`: autenticación, autorización y errores.
- `backend/src/services`: correo y auditoría.
- `backend/src/config`: conexión MySQL.
- `backend/storage/private`: documentos privados.
- `database/schema.sql`: esquema inicial.
- `database/migrations`: cambios incrementales.
- `frontend-user/src`: interfaz React.
- `frontend-admin/src`: interfaz Angular.

## 8. Seguridad y operación
- Mantén `backend/storage` fuera del servidor estático.
- Usa HTTPS en producción y restringe CORS.
- Usa contraseñas robustas, secretos aleatorios y credenciales de base de datos con privilegios mínimos.
- Activa antivirus/escaneo de archivos y validación por firma binaria antes de producción.
- Configura backups cifrados fuera del servidor y prueba la restauración.
- Monitorea logs sin registrar contraseñas, tokens ni códigos.
- Define retención y borrado conforme a la normativa aplicable.

## 9. Actualización mediante ZIP
1. Detén los tres procesos.
2. Realiza una copia completa del proyecto y un backup MySQL.
3. Extrae el ZIP de actualización sobre una copia de trabajo, conservando rutas.
4. No sobrescribas tu `.env` ni tu carpeta `backend/storage`.
5. Compara y aplica migraciones pendientes.
6. Ejecuta `npm install` si cambió algún `package.json` y `npm run build` en ambos frontends.
7. Ejecuta pruebas funcionales y solo después sustituye la versión activa.

## 10. Diagnóstico
- `ECONNREFUSED`: verifica que MySQL/API esté iniciado y el puerto correcto.
- Error de credenciales: revisa variables `MYSQL_*`.
- CORS: revisa `CORS_ORIGINS` y el origen real del navegador.
- Error de carga: revisa `MAX_FILE_MB`, permisos de escritura y espacio en disco.
- Error de compilación: elimina `node_modules` y reinstala dependencias en Windows con `npm install`; no reutilices dependencias de otro sistema operativo.


## Actualización V9
Revisa `V9_IMPLEMENTACION_Y_PRUEBAS.md` antes de desplegar. La actualización añade endpoints de compartición, búsqueda y resumen. En bases existentes ejecuta la migración 003 una sola vez después de respaldar MySQL. La tabla `file_shares` requiere la clave única `(file_id, shared_with)` para que la operación de compartir actualice permisos previos.

Los permisos efectivos se verifican en el backend al consultar la vista previa y la descarga; no se confía en ocultar botones del frontend como mecanismo de seguridad. `VIEW` no habilita descarga. `DOWNLOAD` y `EDIT` permiten descarga; `EDIT` no representa edición colaborativa del contenido.
