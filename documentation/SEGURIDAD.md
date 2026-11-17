# Seguridad y límites de esta versión

Controles incluidos: Argon2id, JWT de corta duración, cookie HttpOnly para refresh token, rate limiting general, Helmet, CORS restringido, consultas parametrizadas, límites de subida, UUID para nombres físicos, autorización por propietario y registro de actividad.

Pendiente antes de producción:
- Implementar rotación del refresh token y endpoint de renovación.
- MFA TOTP/WebAuthn para administradores.
- Verificación de correo con códigos de un solo uso y recuperación de contraseña.
- Detección real de MIME por firma binaria (magic bytes) y antivirus en cuarentena. La validación MIME de Multer por sí sola no es suficiente.
- CSRF según el flujo definitivo de cookies.
- Autorización completa de membresía de salas y permisos compartidos.
- Cuotas transaccionales, limpieza de huérfanos y borrado físico programado.
- Backups externos cifrados y restauración probada.
- Retención, exportación y borrado de datos conforme a normativa aplicable.
- Pruebas automatizadas de integración, IDOR, carga y penetración autorizada.
