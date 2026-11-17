# Instalación local Windows

1. Instala Node.js 20 LTS y MySQL 8.
2. Abre MySQL Workbench, conecta a tu instancia y ejecuta `database/schema.sql`.
3. Copia `backend/.env.example` como `backend/.env`. Genera secretos distintos y aleatorios para JWT; cambia la clave bootstrap.
4. Backend:
   ```powershell
   cd backend
   npm install
   npm run seed:admin
   npm run dev
   ```
5. Frontend React:
   ```powershell
   cd frontend-user
   npm install
   npm run dev
   ```
6. Frontend Angular:
   ```powershell
   cd frontend-admin
   npm install
   npm start
   ```

## Notas
- El administrador inicial se crea con el correo y contraseña configurados en `.env`.
- El registro público solo genera una solicitud pendiente; el usuario no puede iniciar sesión hasta que el administrador la apruebe.
- El panel Angular y React consumen el mismo backend.
