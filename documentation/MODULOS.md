# Estado de módulos — revisión de código

Este documento distingue entre código presente y funcionamiento verificado. La presencia de una pantalla o endpoint no demuestra por sí sola que el flujo completo haya superado pruebas.

| Área | Implementación identificada | Verificación pendiente |
|---|---|---|
| Autenticación | Registro, login, logout, verificación, recuperación y cambio de contraseña temporal en rutas/controlador | Flujos completos, expiración, revocación y correo real |
| Administración | Dashboard, usuarios, solicitudes, salas, archivos, auditoría, seguridad, notificaciones, respaldos y configuración | Permisos por rol, acciones y persistencia en MySQL |
| Archivos | Carga múltiple, listado, vista previa, descarga, renombrado, favoritos, papelera y restauración | Matriz de formatos, archivos maliciosos, cuotas y aislamiento |
| Carpetas | Listado, creación, renombrado y eliminación | Navegación profunda, movimiento, ciclos y restauración |
| Salas | Activación y código de sala para usuario; listado/creación administrativa | Membresías, invitaciones y permisos compartidos |
| Usuario | Dashboard/drive, navegación, carga, búsqueda, vista previa y papelera en la aplicación React | Accesibilidad, responsive real y flujos de extremo a extremo |
| Administración visual | Panel Angular con secciones de control | Compilación y pruebas de interacción en Windows |
| Base de datos | Esquema MySQL y migraciones versionadas | Instalación limpia, upgrade, backup y restauración |

## Regla de cierre
Solo marca un módulo como terminado cuando su prueba de aceptación se ejecute con datos reales de prueba y se registre el resultado. La lista de pruebas está en `AUDITORIA_Y_ESTADO.md`.
