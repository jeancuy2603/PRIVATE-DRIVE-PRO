import dotenv from 'dotenv'; dotenv.config();
import argon2 from 'argon2';
import { pool } from '../config/db.js';
const email=process.env.BOOTSTRAP_ADMIN_EMAIL, password=process.env.BOOTSTRAP_ADMIN_PASSWORD;
if(!email || !password || password.length<16) throw new Error('Configura BOOTSTRAP_ADMIN_EMAIL y una BOOTSTRAP_ADMIN_PASSWORD de al menos 16 caracteres.');
const [roles]=await pool.execute("SELECT id FROM roles WHERE name='SUPERADMIN'");
const hash=await argon2.hash(password,{type:argon2.argon2id});
await pool.execute(`INSERT INTO users(first_name,last_name,username,email,password_hash,role_id,status,email_verified_at)
VALUES('Administrador','Principal','superadmin',?,?,?,'ACTIVA',NOW())
ON DUPLICATE KEY UPDATE email=email`,[email,hash,roles[0].id]);
console.log('Proceso de bootstrap completado. Verifica la cuenta configurada.');
await pool.end();
