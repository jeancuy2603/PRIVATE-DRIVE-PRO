# Arquitectura

```text
React (usuarios) ─┐
                  ├── HTTPS / REST API ── Express ── MySQL
Angular (admin) ──┘                         │
                                            └── storage/private (fuera del directorio público)
```

## Límites de confianza
- Los dos frontends son clientes no confiables: toda autorización se repite en el backend.
- Los archivos se guardan con UUID, no con el nombre enviado por el navegador.
- Los identificadores de archivo se consultan junto con el propietario autenticado.
- El token de acceso es breve; el refresh token se almacena como hash en MySQL y se transporta en cookie HttpOnly.
- No se debe publicar `backend/storage` como carpeta estática.
