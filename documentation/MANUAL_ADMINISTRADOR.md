# Manual de administración — PRIVATE DRIVE PRO

## 1. Acceso al panel
Abre `http://localhost:4200`, inicia sesión con la cuenta administrativa creada mediante `npm run seed:admin` y no compartas esa cuenta. Cambia la contraseña inicial si el procedimiento de tu organización así lo exige.

## 2. Dashboard
El dashboard presenta los indicadores que devuelve la API, como usuarios, cuentas activas, solicitudes, archivos y actividad. Los valores dependen de los datos reales de MySQL; un valor cero no debe sustituirse por datos manuales.

El indicador de conectividad muestra el resultado de la comprobación de `/api/health`.

## 3. Usuarios y solicitudes
1. Abre **Usuarios** para buscar cuentas y filtrar por estado.
2. Abre **Solicitudes** para revisar registros pendientes.
3. Revisa identidad y correo según el procedimiento interno.
4. Aprueba, suspende, reactiva o elimina únicamente cuando corresponda.
5. Comprueba el resultado y la auditoría después de cada operación.

Las acciones disponibles dependen del estado de cuenta y de los endpoints habilitados en el backend.

## 4. Salas privadas
El módulo permite consultar salas y crear una sala indicando nombre, propietario y cuota. Confirma que el propietario esté activo y que la cuota corresponda a la política de almacenamiento. La administración de membresías y permisos avanzados debe considerarse pendiente hasta completar las pruebas de autorización.

## 5. Archivos y almacenamiento
El panel permite consultar los archivos registrados según el endpoint administrativo. El acceso de supervisión no debe utilizarse para abrir contenido privado fuera de una autorización legítima.

## 6. Seguridad y auditoría
- Revisa periódicamente eventos de seguridad y registros de auditoría.
- Investiga acciones inesperadas.
- Suspende cuentas comprometidas y revoca sesiones desde los procedimientos soportados.
- No compartas exportaciones que contengan datos personales.

## 7. Notificaciones, respaldos y configuración
Estas secciones muestran la información que el backend tenga implementada. No interpretes la presencia de una sección como evidencia de que exista un proceso automático de backup o configuración editable: confirma su operación con el responsable técnico y una prueba de restauración.

## 8. Cierre de sesión
Pulsa **Cerrar sesión** al finalizar. Evita dejar sesiones administrativas abiertas en estaciones compartidas.

## 9. Lista de control operativa
- [ ] Verificar conectividad de API y MySQL.
- [ ] Revisar solicitudes pendientes.
- [ ] Revisar eventos de seguridad.
- [ ] Confirmar espacio y cuotas.
- [ ] Verificar respaldos y restauración.
- [ ] Revisar actividad anómala.
- [ ] Confirmar que el personal autorizado conserva acceso.
