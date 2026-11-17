# Pruebas de PRIVATE DRIVE PRO V9

## Pruebas automatizadas disponibles

| Prueba | Resultado en el entorno de empaquetado |
|---|---|
| Identificadores positivos | Superada |
| Nombres visibles y caracteres de control | Superada |
| Normalización de correo | Superada |
| Lista permitida de permisos compartidos | Superada |
| Escape de comodines LIKE | Superada |
| Sintaxis de backend JavaScript | Superada |
| Sintaxis JSX de frontend de usuario | Superada con parser TypeScript |
| Sintaxis TypeScript de frontend administrativo | Superada con parser TypeScript |
| Build Vite | Pendiente: dependencias no instaladas |
| Build Angular | Pendiente: dependencias no instaladas |
| Pruebas MySQL end-to-end | Pendiente: requiere instancia local |
| Prueba SMTP real | Pendiente: requiere credenciales locales |

## Ejecutar en Windows

```powershell
cd backend
npm install
npm test
```

Para compilar los frontends:

```powershell
cd ..\frontend-user
npm install
npm run build

cd ..\frontend-admin
npm install
npm run build
```

## Pruebas manuales de compartición

1. Crear dos usuarios activos con sala propia habilitada.
2. Iniciar sesión como propietario y subir un PDF de prueba.
3. Compartirlo con el correo del segundo usuario usando `VIEW`.
4. Iniciar sesión como destinatario y abrir «Compartidos conmigo».
5. Confirmar que la vista previa funciona y que no aparece la acción de descarga.
6. Repetir con `DOWNLOAD` y confirmar que vista previa y descarga funcionan.
7. Como propietario, consultar `GET /api/files/:id/shares` y revocar el permiso.
8. Confirmar que el destinatario deja de obtener el archivo.
9. Probar un correo inexistente, permiso inválido y usuario igual al propietario; deben rechazarse.

Realiza estas pruebas con archivos de prueba y cuentas no productivas. No utilices información privada real durante la validación.
