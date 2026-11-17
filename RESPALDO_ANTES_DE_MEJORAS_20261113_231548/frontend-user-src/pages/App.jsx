import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useNavigate
} from 'react-router-dom';

import {
  Cloud,
  ShieldCheck,
  Folder,
  FolderPlus,
  Trash2,
  Upload,
  Search,
  LogOut,
  HardDrive,
  FileText,
  Star,
  Clock,
  Download,
  Eye,
  Plus,
  ChevronRight,
  ChevronLeft,
  Home,
  RefreshCw,
  X,
  Menu,
  MoreVertical,
  Pencil,
  RotateCcw,
  Trash,
  Lock,
  Mail,
  User,
  KeyRound,
  AlertCircle,
  CheckCircle,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  Video,
  Music,
  Settings,
  Filter,
  ArrowUpDown,
  Shield,
  Copy,
  ExternalLink
} from 'lucide-react';

import * as XLSX from 'xlsx';

import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

import '../styles.css';

/* =========================================================
   CONFIGURACIÓN Y UTILIDADES
========================================================= */

const MAX_UPLOAD_SIZE = 1024 * 1024 * 1024;

const formatBytes = (bytes = 0) => {
  const value = Number(bytes);

  if (!Number.isFinite(value) || value <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1
  );

  return `${(value / Math.pow(1024, index)).toFixed(
    index === 0 ? 0 : 2
  )} ${units[index]}`;
};

const formatDate = (date) => {
  if (!date) return 'Fecha no disponible';

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return 'Fecha no disponible';
  }

  return parsed.toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};

function getFileName(file) {
  return (
    file?.display_name ||
    file?.original_name ||
    file?.originalName ||
    file?.original_filename ||
    file?.file_name ||
    file?.filename ||
    file?.stored_name ||
    file?.name ||
    'Archivo'
  );
}

function getMimeType(file) {
  return String(
    file?.mime_type ||
    file?.mimeType ||
    file?.mimetype ||
    file?.content_type ||
    file?.contentType ||
    ''
  )
    .toLowerCase()
    .split(';')[0]
    .trim();
}

function getExtension(file) {
  const candidates = [
    file?.original_name,
    file?.originalName,
    file?.original_filename,
    file?.file_name,
    file?.filename,
    file?.display_name,
    file?.stored_name,
    file?.storage_name,
    file?.path,
    file?.name
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;

    const cleanName = candidate.split(/[\\/]/).pop().trim();
    const match = cleanName.match(/\.([a-z0-9]+)$/i);

    if (match) {
      return match[1].toLowerCase();
    }
  }

  return String(file?.extension || '')
    .replace(/^\./, '')
    .toLowerCase();
}

function isExcel(file) {
  const extension = getExtension(file);
  const mime = getMimeType(file);

  return [
    'xlsx',
    'xls',
    'xlsm',
    'xlsb',
    'ods'
  ].includes(extension) || [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.ms-excel.sheet.macroenabled.12',
    'application/vnd.ms-excel.sheet.binary.macroenabled.12',
    'application/vnd.oasis.opendocument.spreadsheet'
  ].includes(mime);
}

function isCsv(file) {
  const extension = getExtension(file);
  const mime = getMimeType(file);

  return (
    extension === 'csv' ||
    mime === 'text/csv' ||
    mime === 'application/csv'
  );
}

function isImage(file) {
  const mime = getMimeType(file);

  return (
    mime.startsWith('image/') ||
    [
      'png',
      'jpg',
      'jpeg',
      'gif',
      'webp',
      'bmp',
      'svg',
      'avif'
    ].includes(getExtension(file))
  );
}

function isPdf(file) {
  return (
    getMimeType(file) === 'application/pdf' ||
    getExtension(file) === 'pdf'
  );
}

function isVideo(file) {
  return (
    getMimeType(file).startsWith('video/') ||
    [
      'mp4',
      'webm',
      'mov',
      'ogg',
      'avi',
      'mkv'
    ].includes(getExtension(file))
  );
}

function isAudio(file) {
  return (
    getMimeType(file).startsWith('audio/') ||
    [
      'mp3',
      'wav',
      'ogg',
      'm4a',
      'aac',
      'flac'
    ].includes(getExtension(file))
  );
}

function isText(file) {
  return (
    getMimeType(file).startsWith('text/') ||
    [
      'txt',
      'json',
      'xml',
      'log',
      'md',
      'html',
      'css',
      'js',
      'jsx',
      'ts',
      'tsx',
      'sql'
    ].includes(getExtension(file))
  );
}

function getFileIcon(file) {
  if (isExcel(file) || isCsv(file)) return FileSpreadsheet;
  if (isImage(file)) return ImageIcon;
  if (isVideo(file)) return Video;
  if (isAudio(file)) return Music;
  if (isPdf(file)) return FileText;

  return File;
}

function getErrorMessage(error, fallback = 'Ocurrió un error.') {
  const data = error?.response?.data;

  if (typeof data === 'string' && data.trim()) {
    return data;
  }

  if (data && typeof data === 'object' && data.message) {
    return data.message;
  }

  return error?.message || fallback;
}

async function getBlobErrorMessage(error, fallback) {
  const data = error?.response?.data;

  if (data instanceof Blob) {
    try {
      const content = await data.text();

      try {
        const parsed = JSON.parse(content);
        return parsed.message || parsed.error || fallback;
      } catch {
        return content || fallback;
      }
    } catch {
      return fallback;
    }
  }

  return getErrorMessage(error, fallback);
}

function normalizeArray(response) {
  if (Array.isArray(response)) return response;

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.data?.data)) {
    return response.data.data;
  }

  if (Array.isArray(response?.files)) {
    return response.files;
  }

  if (Array.isArray(response?.folders)) {
    return response.folders;
  }

  return [];
}

function getFolderName(folder) {
  return (
    folder?.name ||
    folder?.folder_name ||
    folder?.title ||
    'Carpeta sin nombre'
  );
}

/* =========================================================
   COMPONENTES DE INTERFAZ COMPARTIDOS
========================================================= */

function Notice({ notice, onClose }) {
  if (!notice?.message) return null;

  const Icon =
    notice.type === 'success'
      ? CheckCircle
      : AlertCircle;

  return (
    <div className={`app-notice ${notice.type || 'info'}`}>
      <Icon size={18} />

      <span>{notice.message}</span>

      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar notificación"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function LoadingScreen({ message = 'Cargando...' }) {
  return (
    <div className="app-loading-screen">
      <div className="app-spinner" />
      <p>{message}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon = Folder,
  title = 'No hay elementos',
  description = 'Todavía no tienes elementos para mostrar.'
}) {
  return (
    <div className="app-empty-state">
      <div className="app-empty-icon">
        <Icon size={34} />
      </div>

      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
/* =========================================================
   AUTENTICACIÓN
========================================================= */

function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="auth-page">
      <div className="auth-background" />

      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <Cloud size={30} />
          </div>

          <h1>PRIVATE DRIVE <span>PRO</span></h1>
          <p>Almacenamiento privado y seguro</p>
        </div>

        <div className="auth-heading">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>

        {children}
      </div>
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Ingresa tu correo y contraseña.');
      return;
    }

    try {
      setLoading(true);
      await login(email.trim(), password);
      navigate('/drive');
    } catch (err) {
      setError(getErrorMessage(err, 'No fue posible iniciar sesión.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Bienvenido"
      subtitle="Inicia sesión para acceder a tu almacenamiento."
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <div className="auth-error">{error}</div>}

        <label>Correo electrónico</label>

        <div className="auth-input">
          <Mail size={18} />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="correo@ejemplo.com"
            autoComplete="email"
            required
          />
        </div>

        <label>Contraseña</label>

        <div className="auth-input">
          <KeyRound size={18} />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Tu contraseña"
            autoComplete="current-password"
            required
          />
        </div>

        <button
          className="auth-submit"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Ingresando...' : 'Iniciar sesión'}
        </button>

        <button
          type="button"
          className="auth-link"
          onClick={() => navigate('/auth/forgot-password')}
        >
          ¿Olvidaste tu contraseña?
        </button>

        <button
          type="button"
          className="auth-link"
          onClick={() => navigate('/auth/resend-verification')}
        >
          Reenviar verificación de correo
        </button>
      </form>
    </AuthLayout>
  );
}

function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await api.post('/auth/forgot-password', {
        email: email.trim()
      });

      setMessage(
        'Si el correo está registrado, recibirás instrucciones para recuperar tu contraseña.'
      );
    } catch (err) {
      setError(getErrorMessage(err, 'No fue posible procesar la solicitud.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Recuperar contraseña"
      subtitle="Te ayudaremos a recuperar el acceso a tu cuenta."
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <div className="auth-error">{error}</div>}
        {message && <div className="auth-success">{message}</div>}

        <label>Correo electrónico</label>

        <div className="auth-input">
          <Mail size={18} />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="correo@ejemplo.com"
            required
          />
        </div>

        <button
          type="submit"
          className="auth-submit"
          disabled={loading}
        >
          {loading ? 'Enviando...' : 'Enviar instrucciones'}
        </button>

        <button
          type="button"
          className="auth-link"
          onClick={() => navigate('/login')}
        >
          Volver al inicio de sesión
        </button>
      </form>
    </AuthLayout>
  );
}

function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function updateField(event) {
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    try {
      setLoading(true);

      await api.post('/auth/register', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password
      });

      setMessage(
        'Tu cuenta fue registrada. Revisa tu correo para verificarla.'
      );
    } catch (err) {
      setError(getErrorMessage(err, 'No fue posible crear la cuenta.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle="Regístrate para utilizar PRIVATE DRIVE PRO."
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <div className="auth-error">{error}</div>}
        {message && <div className="auth-success">{message}</div>}

        <label>Nombre completo</label>

        <div className="auth-input">
          <User size={18} />
          <input
            name="name"
            value={form.name}
            onChange={updateField}
            placeholder="Tu nombre"
            required
          />
        </div>

        <label>Correo electrónico</label>

        <div className="auth-input">
          <Mail size={18} />
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={updateField}
            placeholder="correo@ejemplo.com"
            required
          />
        </div>

        <label>Contraseña</label>

        <div className="auth-input">
          <KeyRound size={18} />
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={updateField}
            placeholder="Mínimo 8 caracteres"
            required
          />
        </div>

        <label>Confirmar contraseña</label>

        <div className="auth-input">
          <KeyRound size={18} />
          <input
            type="password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={updateField}
            placeholder="Repite tu contraseña"
            required
          />
        </div>

        <button
          type="submit"
          className="auth-submit"
          disabled={loading}
        >
          {loading ? 'Creando cuenta...' : 'Registrarme'}
        </button>

        <button
          type="button"
          className="auth-link"
          onClick={() => navigate('/login')}
        >
          Ya tengo una cuenta
        </button>
      </form>
    </AuthLayout>
  );
}

function VerifyEmailPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Verificando correo...');
  const [error, setError] = useState('');

  const { verifyEmail } = useAuth();

  useEffect(() => {
    let active = true;

    async function verify() {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');

      if (!token) {
        setError('No se encontró el código de verificación.');
        return;
      }

      try {
        await verifyEmail(token);

        if (active) {
          setStatus('Tu correo fue verificado correctamente.');
        }
      } catch (err) {
        if (active) {
          setError(getErrorMessage(err, 'No fue posible verificar el correo.'));
        }
      }
    }

    verify();

    return () => {
      active = false;
    };
  }, [verifyEmail]);

  return (
    <AuthLayout
      title="Verificación de correo"
      subtitle="Confirma tu dirección de correo electrónico."
    >
      {error ? (
        <div className="auth-error">{error}</div>
      ) : (
        <div className="auth-success">{status}</div>
      )}

      <button
        type="button"
        className="auth-submit"
        onClick={() => navigate('/login')}
      >
        Ir al inicio de sesión
      </button>
    </AuthLayout>
  );
}

function ChangeTemporaryPasswordPage() {
  const navigate = useNavigate();
  const { changeTemporaryPassword } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }

    try {
      setLoading(true);

      await changeTemporaryPassword(
        currentPassword,
        newPassword
      );

      setSuccess('Contraseña actualizada correctamente.');
      navigate('/drive');
    } catch (err) {
      setError(getErrorMessage(err, 'No fue posible cambiar la contraseña.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Cambiar contraseña"
      subtitle="Debes establecer una nueva contraseña para continuar."
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        <label>Contraseña actual o temporal</label>
        <div className="auth-input">
          <KeyRound size={18} />
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </div>

        <label>Nueva contraseña</label>
        <div className="auth-input">
          <Lock size={18} />
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
        </div>

        <label>Confirmar nueva contraseña</label>
        <div className="auth-input">
          <Lock size={18} />
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          className="auth-submit"
          disabled={loading}
        >
          {loading ? 'Actualizando...' : 'Cambiar contraseña'}
        </button>
      </form>
    </AuthLayout>
  );
}

function ResendVerificationPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await api.post('/auth/resend-verification', {
        email: email.trim()
      });

      setMessage('Si la cuenta existe, recibirás un nuevo correo de verificación.');
    } catch (err) {
      setError(getErrorMessage(err, 'No fue posible reenviar el correo.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Verificar correo"
      subtitle="Solicita un nuevo correo de verificación."
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <div className="auth-error">{error}</div>}
        {message && <div className="auth-success">{message}</div>}

        <label>Correo electrónico</label>

        <div className="auth-input">
          <Mail size={18} />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          className="auth-submit"
          disabled={loading}
        >
          {loading ? 'Enviando...' : 'Reenviar correo'}
        </button>
      </form>
    </AuthLayout>
  );
}

/* =========================================================
   VISUALIZADOR DE EXCEL Y CSV
========================================================= */

function ExcelPreview({ sheets = [], fileName = 'Archivo' }) {
  const [activeSheet, setActiveSheet] = useState(0);
  const [filter, setFilter] = useState('');
  const [showAllRows, setShowAllRows] = useState(false);

  const currentSheet = sheets[activeSheet] || {
    name: 'Hoja 1',
    rows: []
  };

  const rows = Array.isArray(currentSheet.rows)
    ? currentSheet.rows
    : [];

  const filteredRows = useMemo(() => {
    const search = filter.trim().toLowerCase();

    return rows
      .map((row, originalIndex) => ({
        row,
        originalIndex
      }))
      .filter(({ row }) => {
        if (!search) return true;

        return row.some((cell) =>
          String(cell ?? '')
            .toLowerCase()
            .includes(search)
        );
      });
  }, [rows, filter]);

  const visibleRows = showAllRows
    ? filteredRows
    : filteredRows.slice(0, 200);

  const columnCount = Math.max(
    1,
    ...rows.map((row) => row.length)
  );

  return (
    <div className="excel-preview">
      <div className="excel-toolbar">
        <div className="excel-file-title">
          <FileSpreadsheet size={22} />
          <div>
            <strong>{fileName}</strong>
            <small>
              {rows.length.toLocaleString('es-CO')} filas
            </small>
          </div>
        </div>

        <div className="excel-search">
          <Search size={16} />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Buscar dentro de la hoja..."
          />

          {filter && (
            <button
              type="button"
              onClick={() => setFilter('')}
              aria-label="Limpiar búsqueda"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {sheets.length > 1 && (
        <div className="excel-sheet-tabs">
          {sheets.map((sheet, index) => (
            <button
              type="button"
              key={`${sheet.name}-${index}`}
              className={activeSheet === index ? 'active' : ''}
              onClick={() => {
                setActiveSheet(index);
                setFilter('');
                setShowAllRows(false);
              }}
            >
              {sheet.name || `Hoja ${index + 1}`}
            </button>
          ))}
        </div>
      )}

      <div className="excel-table-container">
        {rows.length === 0 ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="Hoja vacía"
            description="Esta hoja no contiene datos para mostrar."
          />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Sin resultados"
            description="No se encontraron coincidencias con tu búsqueda."
          />
        ) : (
          <table className="excel-table">
            <thead>
              <tr>
                <th className="excel-row-number">#</th>

                {Array.from(
                  { length: columnCount },
                  (_, index) => (
                    <th key={index}>
                      {XLSX.utils.encode_col(index)}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {visibleRows.map(({ row, originalIndex }) => (
                <tr key={originalIndex}>
                  <td className="excel-row-number">
                    {originalIndex + 1}
                  </td>

                  {Array.from(
                    { length: columnCount },
                    (_, columnIndex) => (
                      <td key={columnIndex}>
                        {String(row[columnIndex] ?? '')}
                      </td>
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="excel-footer">
        <span>
          Mostrando {visibleRows.length.toLocaleString('es-CO')} de{' '}
          {filteredRows.length.toLocaleString('es-CO')} filas
        </span>

        {!showAllRows && filteredRows.length > 200 && (
          <button
            type="button"
            onClick={() => setShowAllRows(true)}
          >
            Mostrar todas las filas
          </button>
        )}

        {showAllRows && filteredRows.length > 200 && (
          <button
            type="button"
            onClick={() => setShowAllRows(false)}
          >
            Mostrar menos
          </button>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   VENTANA DE VISTA PREVIA
========================================================= */

function PreviewModal({ preview, onClose }) {
  if (!preview) return null;

  const { file, url, sheets, text } = preview;

  return (
    <div
      className="preview-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="preview-modal">
        <div className="preview-header">
          <div className="preview-title">
            {isExcel(file) || isCsv(file) ? (
              <FileSpreadsheet size={21} />
            ) : (
              <Eye size={21} />
            )}

            <div>
              <strong>{getFileName(file)}</strong>
              <small>Vista previa</small>
            </div>
          </div>

          <button
            type="button"
            className="preview-close"
            onClick={onClose}
            aria-label="Cerrar vista previa"
          >
            <X size={22} />
          </button>
        </div>

        <div className="preview-content">
          {Array.isArray(sheets) ? (
            <ExcelPreview
              sheets={sheets}
              fileName={getFileName(file)}
            />
          ) : isPdf(file) && url ? (
            <iframe
              title={getFileName(file)}
              src={url}
              className="preview-pdf"
            />
          ) : isImage(file) && url ? (
            <div className="preview-image-container">
              <img src={url} alt={getFileName(file)} />
            </div>
          ) : isVideo(file) && url ? (
            <video
              src={url}
              controls
              className="preview-video"
            />
          ) : isAudio(file) && url ? (
            <div className="preview-audio-container">
              <Music size={42} />
              <h3>{getFileName(file)}</h3>
              <audio src={url} controls />
            </div>
          ) : isText(file) ? (
            <pre className="preview-text">
              {text || 'El archivo está vacío.'}
            </pre>
          ) : (
            <EmptyState
              icon={File}
              title="Vista previa no disponible"
              description="Puedes descargar este archivo para abrirlo en tu dispositivo."
            />
          )}
        </div>
      </div>
    </div>
  );
}
/* =========================================================
   ACCESO A LA SALA PRIVADA
========================================================= */

function RoomActivation({ onActivated }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleActivate(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!code.trim()) {
      setError('Ingresa el código de activación.');
      return;
    }

    try {
      setLoading(true);

      await api.post('/rooms/activate', {
        code: code.trim()
      });

      setMessage('Sala activada correctamente.');
      await onActivated();
    } catch (err) {
      setError(getErrorMessage(err, 'No fue posible activar la sala.'));
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setError('');
    setMessage('');

    try {
      setLoading(true);
      await api.post('/rooms/resend-code');
      setMessage('Se ha solicitado un nuevo código de activación.');
    } catch (err) {
      setError(getErrorMessage(err, 'No fue posible reenviar el código.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="room-activation-page">
      <div className="room-activation-card">
        <div className="room-activation-icon">
          <ShieldCheck size={42} />
        </div>

        <h2>Activa tu sala privada</h2>

        <p>
          Para acceder a tus archivos debes introducir el código
          de activación proporcionado por el administrador.
        </p>

        {error && <div className="auth-error">{error}</div>}
        {message && <div className="auth-success">{message}</div>}

        <form onSubmit={handleActivate}>
          <input
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Código de activación"
            autoComplete="one-time-code"
          />

          <button type="submit" disabled={loading}>
            {loading ? 'Validando...' : 'Activar sala'}
          </button>
        </form>

        <button
          type="button"
          className="auth-link"
          onClick={resendCode}
          disabled={loading}
        >
          Reenviar código
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   TARJETA DE CARPETA
========================================================= */

function FolderCard({
  folder,
  onOpen,
  onRename,
  onDelete
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className="drive-item folder-card"
      onDoubleClick={() => onOpen(folder)}
    >
      <div className="drive-item-top">
        <div className="drive-item-icon folder-icon">
          <Folder size={28} />
        </div>

        <div className="drive-item-menu">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Opciones de carpeta"
          >
            <MoreVertical size={19} />
          </button>

          {menuOpen && (
            <div className="drive-context-menu">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onRename(folder);
                }}
              >
                <Pencil size={15} />
                Renombrar
              </button>

              <button
                type="button"
                className="danger"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(folder);
                }}
              >
                <Trash2 size={15} />
                Eliminar
              </button>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        className="drive-item-name"
        onClick={() => onOpen(folder)}
      >
        {getFolderName(folder)}
      </button>

      <div className="drive-item-meta">
        <span>Carpeta</span>
        <span>{formatDate(folder.updated_at || folder.created_at)}</span>
      </div>
    </div>
  );
}

/* =========================================================
   TARJETA DE ARCHIVO
========================================================= */

function FileCard({
  file,
  onPreview,
  onDownload,
  onRename,
  onDelete,
  onFavorite,
  isTrash = false,
  onRestore,
  onPermanentDelete
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const Icon = getFileIcon(file);

  return (
    <div className="drive-item file-card">
      <div className="drive-item-top">
        <div className="drive-item-icon file-icon">
          <Icon size={28} />
        </div>

        <div className="drive-item-menu">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Opciones de archivo"
          >
            <MoreVertical size={19} />
          </button>

          {menuOpen && (
            <div className="drive-context-menu">
              {!isTrash && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onPreview(file);
                    }}
                  >
                    <Eye size={15} />
                    Vista previa
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onDownload(file);
                    }}
                  >
                    <Download size={15} />
                    Descargar
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onRename(file);
                    }}
                  >
                    <Pencil size={15} />
                    Renombrar
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onFavorite(file);
                    }}
                  >
                    <Star size={15} />
                    {file.is_favorite || file.isFavorite
                      ? 'Quitar favorito'
                      : 'Agregar favorito'}
                  </button>

                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(file);
                    }}
                  >
                    <Trash2 size={15} />
                    Mover a papelera
                  </button>
                </>
              )}

              {isTrash && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onRestore(file);
                    }}
                  >
                    <RotateCcw size={15} />
                    Restaurar
                  </button>

                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      setMenuOpen(false);
                      onPermanentDelete(file);
                    }}
                  >
                    <Trash2 size={15} />
                    Eliminar definitivamente
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        className="drive-item-name"
        onClick={() => !isTrash && onPreview(file)}
        title={getFileName(file)}
      >
        {getFileName(file)}
      </button>

      <div className="drive-item-meta">
        <span>{formatBytes(file.size || file.file_size || 0)}</span>
        <span>{formatDate(file.updated_at || file.created_at)}</span>
      </div>

      {!isTrash && (
        <div className="drive-item-actions">
          <button
            type="button"
            onClick={() => onPreview(file)}
            title="Vista previa"
          >
            <Eye size={16} />
          </button>

          <button
            type="button"
            onClick={() => onDownload(file)}
            title="Descargar"
          >
            <Download size={16} />
          </button>

          <button
            type="button"
            onClick={() => onFavorite(file)}
            title="Favorito"
            className={
              file.is_favorite || file.isFavorite
                ? 'favorite-active'
                : ''
            }
          >
            <Star size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   COMPONENTE PRINCIPAL DRIVE
========================================================= */

function Drive() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [room, setRoom] = useState(null);
  const [roomLoading, setRoomLoading] = useState(true);

  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [trash, setTrash] = useState([]);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [tab, setTab] = useState('all');
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [folderPath, setFolderPath] = useState([]);

  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const [notice, setNotice] = useState(null);
  const [preview, setPreview] = useState(null);

  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const uploadInputRef = useRef(null);
  const previewUrlRef = useRef(null);
  const requestSequence = useRef(0);

  const showNotice = useCallback((message, type = 'info') => {
    setNotice({ message, type });
  }, []);

  /* -------------------------------------------------------
     CARGAR INFORMACIÓN DE LA SALA
  ------------------------------------------------------- */

  const checkRoom = useCallback(async () => {
    try {
      setRoomLoading(true);

      const response = await api.get('/rooms/me');

      const roomData =
        response?.data?.room ||
        response?.data?.data ||
        response?.data ||
        null;

      setRoom(roomData);
      return roomData;
    } catch (error) {
      setRoom(null);
      return null;
    } finally {
      setRoomLoading(false);
    }
  }, []);

  /* -------------------------------------------------------
     CARGAR ARCHIVOS Y CARPETAS
  ------------------------------------------------------- */

  const load = useCallback(async () => {
    if (!room?.accessGranted) return;

    const sequence = ++requestSequence.current;

    setLoading(true);

    try {
      const params = {};

      if (activeFolderId) {
        params.folderId = activeFolderId;
      }

      const [filesResult, foldersResult] = await Promise.allSettled([
        api.get('/files', { params }),
        api.get('/files/folders', { params })
      ]);

      if (sequence !== requestSequence.current) return;

      if (filesResult.status === 'fulfilled') {
        setFiles(normalizeArray(filesResult.value.data));
      } else {
        setFiles([]);
        showNotice(
          getErrorMessage(filesResult.reason, 'No fue posible cargar los archivos.'),
          'error'
        );
      }

      if (foldersResult.status === 'fulfilled') {
        setFolders(normalizeArray(foldersResult.value.data));
      } else {
        setFolders([]);
      }
    } finally {
      if (sequence === requestSequence.current) {
        setLoading(false);
      }
    }
  }, [room?.accessGranted, activeFolderId, showNotice]);

  /* -------------------------------------------------------
     CARGAR PAPELERA
  ------------------------------------------------------- */

  const loadTrash = useCallback(async () => {
    try {
      setLoading(true);

      const response = await api.get('/files/trash');

      setTrash(normalizeArray(response.data));
    } catch (error) {
      showNotice(
        getErrorMessage(error, 'No fue posible cargar la papelera.'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [showNotice]);

  /* -------------------------------------------------------
     EFECTOS
  ------------------------------------------------------- */

  useEffect(() => {
    checkRoom();
  }, [checkRoom]);

  useEffect(() => {
    if (room?.accessGranted && tab !== 'trash') {
      load();
    }

    return () => {
      requestSequence.current += 1;
    };
  }, [load, room?.accessGranted, tab]);

  useEffect(() => {
    if (room?.accessGranted && tab === 'trash') {
      loadTrash();
    }
  }, [room?.accessGranted, tab, loadTrash]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  /* -------------------------------------------------------
     NAVEGACIÓN
  ------------------------------------------------------- */

  function changeTab(nextTab) {
    setTab(nextTab);
    setActiveFolderId(null);
    setFolderPath([]);
    setQuery('');
    setNotice(null);
  }

  function openFolder(folder) {
    setActiveFolderId(folder.id);
    setFolderPath((previous) => [
      ...previous,
      {
        id: folder.id,
        name: getFolderName(folder)
      }
    ]);
    setQuery('');
  }

  function navigateToFolder(index) {
    if (index < 0) {
      setActiveFolderId(null);
      setFolderPath([]);
      return;
    }

    const selected = folderPath[index];

    setActiveFolderId(selected?.id || null);
    setFolderPath(folderPath.slice(0, index + 1));
  }

  function closePreview() {
    setPreview(null);
  }

  /* -------------------------------------------------------
     CREAR CARPETA
  ------------------------------------------------------- */

  async function createFolder(event) {
    event.preventDefault();

    const name = newFolderName.trim();

    if (!name) {
      showNotice('Escribe un nombre para la carpeta.', 'error');
      return;
    }

    try {
      await api.post('/files/folders', {
        name,
        parentId: activeFolderId
      });

      setNewFolderName('');
      setShowCreateFolder(false);

      showNotice('Carpeta creada correctamente.', 'success');
      await load();
    } catch (error) {
      showNotice(
        getErrorMessage(error, 'No fue posible crear la carpeta.'),
        'error'
      );
    }
  }

  /* -------------------------------------------------------
     RENOMBRAR ARCHIVO O CARPETA
  ------------------------------------------------------- */

  function startRename(item, type = 'file') {
    setRenameTarget({ ...item, type });
    setRenameValue(
      type === 'folder'
        ? getFolderName(item)
        : getFileName(item)
    );
  }

  async function saveRename(event) {
    event.preventDefault();

    if (!renameTarget || !renameValue.trim()) return;

    try {
      const endpoint =
        renameTarget.type === 'folder'
          ? `/files/folders/${renameTarget.id}/rename`
          : `/files/${renameTarget.id}/rename`;

      await api.patch(endpoint, {
        name: renameValue.trim()
      });

      setRenameTarget(null);
      setRenameValue('');

      showNotice('Nombre actualizado correctamente.', 'success');

      if (tab === 'trash') {
        await loadTrash();
      } else {
        await load();
      }
    } catch (error) {
      showNotice(
        getErrorMessage(error, 'No fue posible cambiar el nombre.'),
        'error'
      );
    }
  }

  /* -------------------------------------------------------
     ELIMINAR CARPETA
  ------------------------------------------------------- */

  async function deleteFolder(folder) {
    const confirmed = window.confirm(
      `¿Deseas eliminar la carpeta "${getFolderName(folder)}"?`
    );

    if (!confirmed) return;

    try {
      await api.delete(`/files/folders/${folder.id}`);

      showNotice('Carpeta eliminada correctamente.', 'success');
      await load();
    } catch (error) {
      showNotice(
        getErrorMessage(error, 'No fue posible eliminar la carpeta.'),
        'error'
      );
    }
  }

  /* -------------------------------------------------------
     SUBIR ARCHIVOS
  ------------------------------------------------------- */

  async function uploadFiles(event) {
    const selectedFiles = Array.from(event.target.files || []);

    if (!selectedFiles.length) return;

    const oversized = selectedFiles.filter(
      (file) => file.size > MAX_UPLOAD_SIZE
    );

    if (oversized.length) {
      showNotice(
        `Estos archivos superan el límite permitido: ${oversized
          .map((file) => file.name)
          .join(', ')}`,
        'error'
      );

      event.target.value = '';
      return;
    }

    const formData = new FormData();

    selectedFiles.forEach((file) => {
      formData.append('files', file);
    });

    if (activeFolderId) {
      formData.append('folderId', String(activeFolderId));
    }

    try {
      setUploading(true);

      await api.post('/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      showNotice(
        `${selectedFiles.length} archivo(s) subido(s) correctamente.`,
        'success'
      );

      await load();
    } catch (error) {
      showNotice(
        await getBlobErrorMessage(
          error,
          'No fue posible subir los archivos.'
        ),
        'error'
      );
    } finally {
      setUploading(false);

      if (event.target) {
        event.target.value = '';
      }
    }
  }

  /* -------------------------------------------------------
     VISTA PREVIA DE ARCHIVOS
  ------------------------------------------------------- */

  async function openPreview(file) {
    try {
      closePreview();

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }

      showNotice('Preparando vista previa...', 'info');

      const response = await api.get(
        `/files/${file.id}/preview`,
        {
          responseType: 'blob'
        }
      );

      const blob = response.data;

      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error('El servidor devolvió un archivo vacío.');
      }

      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      const isZip =
        bytes.length >= 4 &&
        bytes[0] === 0x50 &&
        bytes[1] === 0x4b;

      const isOle =
        bytes.length >= 8 &&
        bytes[0] === 0xd0 &&
        bytes[1] === 0xcf &&
        bytes[2] === 0x11 &&
        bytes[3] === 0xe0;

      const spreadsheetBySignature = isZip || isOle;

      const spreadsheet =
        isExcel(file) ||
        isCsv(file) ||
        spreadsheetBySignature;

      if (spreadsheet) {
        let workbook;

        if (isCsv(file) && !spreadsheetBySignature) {
          const csvText = new TextDecoder('utf-8').decode(buffer);

          workbook = XLSX.read(csvText, {
            type: 'string',
            raw: false,
            cellDates: true
          });
        } else {
          workbook = XLSX.read(buffer, {
            type: 'array',
            cellDates: true,
            cellNF: true,
            cellText: true,
            dense: false,
            raw: false
          });
        }

        const sheets = workbook.SheetNames.map((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];

          return {
            name: sheetName,
            rows: XLSX.utils.sheet_to_json(worksheet, {
              header: 1,
              defval: '',
              raw: false,
              blankrows: true
            })
          };
        });

        setPreview({
          file,
          sheets
        });

        setNotice(null);
        return;
      }

      if (isText(file)) {
        const text = new TextDecoder('utf-8').decode(buffer);

        setPreview({
          file,
          text
        });

        setNotice(null);
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      previewUrlRef.current = objectUrl;

      setPreview({
        file,
        url: objectUrl
      });

      setNotice(null);
    } catch (error) {
      showNotice(
        await getBlobErrorMessage(
          error,
          'No fue posible abrir la vista previa.'
        ),
        'error'
      );
    }
  }

  /* -------------------------------------------------------
     DESCARGAR ARCHIVO
  ------------------------------------------------------- */

  async function downloadFile(file) {
    try {
      const response = await api.get(
        `/files/${file.id}/download`,
        {
          responseType: 'blob'
        }
      );

      const blob = response.data;

      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error('El archivo descargado está vacío.');
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = getFileName(file);

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);

      showNotice('Descarga iniciada.', 'success');
    } catch (error) {
      showNotice(
        await getBlobErrorMessage(
          error,
          'No fue posible descargar el archivo.'
        ),
        'error'
      );
    }
  }

  /* -------------------------------------------------------
     FAVORITOS
  ------------------------------------------------------- */

  async function toggleFavorite(file) {
    try {
      await api.patch(`/files/${file.id}/favorite`);

      showNotice('Favoritos actualizados.', 'success');
      await load();
    } catch (error) {
      showNotice(
        getErrorMessage(error, 'No fue posible actualizar el favorito.'),
        'error'
      );
    }
  }

  /* -------------------------------------------------------
     PAPELERA
  ------------------------------------------------------- */

  async function deleteFile(file) {
    const confirmed = window.confirm(
      `¿Mover "${getFileName(file)}" a la papelera?`
    );

    if (!confirmed) return;

    try {
      await api.delete(`/files/${file.id}`);

      showNotice('Archivo movido a la papelera.', 'success');
      await load();
    } catch (error) {
      showNotice(
        getErrorMessage(error, 'No fue posible eliminar el archivo.'),
        'error'
      );
    }
  }

  async function restoreFile(file) {
    try {
      await api.patch(`/files/${file.id}/restore`);

      showNotice('Archivo restaurado correctamente.', 'success');
      await loadTrash();
    } catch (error) {
      showNotice(
        getErrorMessage(error, 'No fue posible restaurar el archivo.'),
        'error'
      );
    }
  }

  async function permanentlyDeleteFile(file) {
    const confirmed = window.confirm(
      `¿Eliminar definitivamente "${getFileName(file)}"? Esta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    try {
      await api.delete(`/files/${file.id}/permanent`);

      showNotice('Archivo eliminado definitivamente.', 'success');
      await loadTrash();
    } catch (error) {
      showNotice(
        getErrorMessage(error, 'No fue posible eliminar definitivamente el archivo.'),
        'error'
      );
    }
  }

  /* -------------------------------------------------------
     CERRAR SESIÓN
  ------------------------------------------------------- */

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate('/login');
    }
  }
    /* -------------------------------------------------------
     FILTROS Y ORDENAMIENTO
  ------------------------------------------------------- */

  const visibleFolders = useMemo(() => {
    let result = [...folders];

    if (query.trim()) {
      const search = query.toLowerCase();

      result = result.filter((folder) =>
        getFolderName(folder).toLowerCase().includes(search)
      );
    }

    return result.sort((a, b) =>
      getFolderName(a).localeCompare(getFolderName(b), 'es')
    );
  }, [folders, query]);

  const visibleFiles = useMemo(() => {
    let result = [...files];

    if (tab === 'favorites') {
      result = result.filter(
        (file) => file.is_favorite || file.isFavorite
      );
    }

    if (tab === 'recent') {
      result = [...result].sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at || 0) -
          new Date(a.updated_at || a.created_at || 0)
      );
    }

    if (query.trim()) {
      const search = query.toLowerCase();

      result = result.filter((file) =>
        getFileName(file).toLowerCase().includes(search)
      );
    }

    if (sortBy === 'name') {
      result.sort((a, b) =>
        getFileName(a).localeCompare(getFileName(b), 'es')
      );
    } else if (sortBy === 'date') {
      result.sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at || 0) -
          new Date(a.updated_at || a.created_at || 0)
      );
    } else if (sortBy === 'size') {
      result.sort(
        (a, b) =>
          Number(b.size || b.file_size || 0) -
          Number(a.size || a.file_size || 0)
      );
    }

    return result;
  }, [files, tab, query, sortBy]);

  const visibleTrash = useMemo(() => {
    if (!query.trim()) return trash;

    const search = query.toLowerCase();

    return trash.filter((file) =>
      getFileName(file).toLowerCase().includes(search)
    );
  }, [trash, query]);

  const totalStorage = Number(
    room?.storage_limit ||
    room?.quota ||
    room?.max_storage ||
    0
  );

  const usedStorage = Number(
    room?.storage_used ||
    room?.used_storage ||
    room?.used ||
    0
  );

  const storagePercentage = totalStorage > 0
    ? Math.min(100, (usedStorage / totalStorage) * 100)
    : 0;

  /* -------------------------------------------------------
     RENDERIZADO PRINCIPAL
  ------------------------------------------------------- */

  if (roomLoading) {
    return <LoadingScreen message="Verificando tu sala privada..." />;
  }

  if (!room?.accessGranted) {
    return (
      <RoomActivation
        onActivated={checkRoom}
      />
    );
  }

  return (
    <div className="drive-app">
      <aside className={`drive-sidebar ${showMobileMenu ? 'mobile-open' : ''}`}>
        <div className="drive-logo">
          <div className="drive-logo-icon">
            <Cloud size={27} />
          </div>

          <div>
            <h2>PRIVATE DRIVE</h2>
            <span>PRO CLOUD STORAGE</span>
          </div>

          <button
            type="button"
            className="mobile-menu-close"
            onClick={() => setShowMobileMenu(false)}
          >
            <X size={21} />
          </button>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {(user?.name || user?.email || 'U')
              .charAt(0)
              .toUpperCase()}
          </div>

          <div className="sidebar-user-info">
            <strong>{user?.name || 'Usuario'}</strong>
            <span>{user?.email || 'Cuenta privada'}</span>
          </div>
        </div>

        <div className="sidebar-section">
          <span className="sidebar-label">MI ESPACIO</span>

          <button
            type="button"
            className={`sidebar-link ${tab === 'all' ? 'active' : ''}`}
            onClick={() => {
              changeTab('all');
              setShowMobileMenu(false);
            }}
          >
            <HardDrive size={19} />
            <span>Todos los archivos</span>
          </button>

          <button
            type="button"
            className={`sidebar-link ${tab === 'recent' ? 'active' : ''}`}
            onClick={() => {
              changeTab('recent');
              setShowMobileMenu(false);
            }}
          >
            <Clock size={19} />
            <span>Recientes</span>
          </button>

          <button
            type="button"
            className={`sidebar-link ${tab === 'favorites' ? 'active' : ''}`}
            onClick={() => {
              changeTab('favorites');
              setShowMobileMenu(false);
            }}
          >
            <Star size={19} />
            <span>Favoritos</span>
          </button>

          <button
            type="button"
            className={`sidebar-link ${tab === 'trash' ? 'active' : ''}`}
            onClick={() => {
              changeTab('trash');
              setShowMobileMenu(false);
            }}
          >
            <Trash2 size={19} />
            <span>Papelera</span>
          </button>
        </div>

        <div className="sidebar-storage">
          <div className="sidebar-storage-heading">
            <HardDrive size={17} />
            <span>Almacenamiento</span>
          </div>

          <div className="storage-progress">
            <div
              className="storage-progress-value"
              style={{ width: `${storagePercentage}%` }}
            />
          </div>

          <div className="storage-details">
            <span>{formatBytes(usedStorage)} usados</span>
            <span>
              {totalStorage > 0
                ? formatBytes(totalStorage)
                : 'Sin límite definido'}
            </span>
          </div>
        </div>

        <div className="sidebar-bottom">
          <button
            type="button"
            className="sidebar-link"
            onClick={handleLogout}
          >
            <LogOut size={19} />
            <span>Cerrar sesión</span>
          </button>

          <div className="sidebar-security">
            <ShieldCheck size={17} />
            <span>Almacenamiento privado</span>
          </div>
        </div>
      </aside>

      {showMobileMenu && (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={() => setShowMobileMenu(false)}
          aria-label="Cerrar menú"
        />
      )}

      <main className="drive-main">
        <header className="drive-header">
          <div className="drive-header-left">
            <button
              type="button"
              className="mobile-menu-button"
              onClick={() => setShowMobileMenu(true)}
              aria-label="Abrir menú"
            >
              <Menu size={22} />
            </button>

            <div>
              <span className="drive-header-overline">
                PRIVATE DRIVE PRO
              </span>

              <h1>
                {tab === 'all' && 'Mis archivos'}
                {tab === 'recent' && 'Archivos recientes'}
                {tab === 'favorites' && 'Mis favoritos'}
                {tab === 'trash' && 'Papelera'}
              </h1>
            </div>
          </div>

          <div className="drive-header-actions">
            <div className="drive-search">
              <Search size={18} />

              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar archivos..."
              />

              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Limpiar búsqueda"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <button
              type="button"
              className="icon-button"
              onClick={tab === 'trash' ? loadTrash : load}
              title="Actualizar"
            >
              <RefreshCw size={19} />
            </button>
          </div>
        </header>

        <div className="drive-content">
          <Notice
            notice={notice}
            onClose={() => setNotice(null)}
          />

          {tab !== 'trash' && (
            <>
              <section className="drive-welcome">
                <div>
                  <span className="drive-eyebrow">
                    TU ESPACIO DIGITAL
                  </span>

                  <h2>Todo tu contenido, en un solo lugar.</h2>

                  <p>
                    Gestiona tus archivos y carpetas de forma
                    privada y segura.
                  </p>
                </div>

                <div className="drive-welcome-icon">
                  <Cloud size={68} />
                </div>
              </section>

              <section className="drive-toolbar">
                <div className="drive-breadcrumb">
                  <button
                    type="button"
                    onClick={() => navigateToFolder(-1)}
                  >
                    <Home size={16} />
                    Mi unidad
                  </button>

                  {folderPath.map((folder, index) => (
                    <span
                      className="breadcrumb-item"
                      key={`${folder.id}-${index}`}
                    >
                      <ChevronRight size={15} />

                      <button
                        type="button"
                        onClick={() => navigateToFolder(index)}
                      >
                        {folder.name}
                      </button>
                    </span>
                  ))}
                </div>

                <div className="drive-toolbar-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setShowCreateFolder(true)}
                  >
                    <FolderPlus size={17} />
                    Nueva carpeta
                  </button>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => uploadInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload size={17} />
                    {uploading ? 'Subiendo...' : 'Subir archivos'}
                  </button>

                  <input
                    ref={uploadInputRef}
                    type="file"
                    multiple
                    hidden
                    onChange={uploadFiles}
                  />
                </div>
              </section>

              <section className="drive-list-heading">
                <div>
                  <h3>
                    {tab === 'favorites'
                      ? 'Archivos favoritos'
                      : tab === 'recent'
                        ? 'Actividad reciente'
                        : folderPath.length
                          ? 'Contenido de la carpeta'
                          : 'Carpetas y archivos'}
                  </h3>

                  <p>
                    {visibleFolders.length} carpetas · {visibleFiles.length} archivos
                  </p>
                </div>

                <div className="drive-sort">
                  <ArrowUpDown size={16} />

                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                  >
                    <option value="name">Nombre</option>
                    <option value="date">Más recientes</option>
                    <option value="size">Tamaño</option>
                  </select>
                </div>
              </section>

              {loading ? (
                <LoadingScreen message="Cargando tus archivos..." />
              ) : (
                <>
                  {tab === 'all' && visibleFolders.length > 0 && (
                    <section className="drive-grid">
                      {visibleFolders.map((folder) => (
                        <FolderCard
                          key={folder.id}
                          folder={folder}
                          onOpen={openFolder}
                          onRename={(item) => startRename(item, 'folder')}
                          onDelete={deleteFolder}
                        />
                      ))}
                    </section>
                  )}

                  {visibleFiles.length > 0 && (
                    <section className="drive-grid">
                      {visibleFiles.map((file) => (
                        <FileCard
                          key={file.id}
                          file={file}
                          onPreview={openPreview}
                          onDownload={downloadFile}
                          onRename={(item) => startRename(item, 'file')}
                          onDelete={deleteFile}
                          onFavorite={toggleFavorite}
                        />
                      ))}
                    </section>
                  )}

                  {visibleFolders.length === 0 &&
                    visibleFiles.length === 0 && (
                      <EmptyState
                        icon={tab === 'favorites' ? Star : Folder}
                        title={
                          query
                            ? 'No se encontraron resultados'
                            : tab === 'favorites'
                              ? 'No tienes favoritos'
                              : 'Esta carpeta está vacía'
                        }
                        description={
                          query
                            ? 'Intenta buscar con otro nombre.'
                            : 'Sube archivos o crea una carpeta para comenzar.'
                        }
                      />
                    )}
                </>
              )}
            </>
          )}

          {tab === 'trash' && (
            <>
              <section className="trash-information">
                <div className="trash-information-icon">
                  <Trash2 size={25} />
                </div>

                <div>
                  <h2>Papelera</h2>
                  <p>
                    Los archivos eliminados se muestran aquí.
                    Puedes restaurarlos o eliminarlos definitivamente.
                  </p>
                </div>
              </section>

              <section className="drive-list-heading">
                <div>
                  <h3>Archivos eliminados</h3>
                  <p>{visibleTrash.length} elementos</p>
                </div>
              </section>

              {loading ? (
                <LoadingScreen message="Cargando papelera..." />
              ) : visibleTrash.length > 0 ? (
                <section className="drive-grid">
                  {visibleTrash.map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      isTrash
                      onPreview={() => {}}
                      onDownload={() => {}}
                      onRename={() => {}}
                      onDelete={() => {}}
                      onFavorite={() => {}}
                      onRestore={restoreFile}
                      onPermanentDelete={permanentlyDeleteFile}
                    />
                  ))}
                </section>
              ) : (
                <EmptyState
                  icon={Trash2}
                  title="La papelera está vacía"
                  description="Los archivos que elimines aparecerán aquí."
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* MODAL CREAR CARPETA */}
      {showCreateFolder && (
        <div
          className="app-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowCreateFolder(false);
            }
          }}
        >
          <div className="app-modal">
            <div className="app-modal-header">
              <div>
                <h2>Nueva carpeta</h2>
                <p>Crea una carpeta en tu unidad.</p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateFolder(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={createFolder}>
              <label>Nombre de la carpeta</label>

              <input
                autoFocus
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder="Ej. Documentos"
                maxLength={150}
                required
              />

              <div className="app-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowCreateFolder(false)}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="primary-button"
                >
                  Crear carpeta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RENOMBRAR */}
      {renameTarget && (
        <div
          className="app-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setRenameTarget(null);
            }
          }}
        >
          <div className="app-modal">
            <div className="app-modal-header">
              <div>
                <h2>Renombrar</h2>
                <p>Escribe el nuevo nombre.</p>
              </div>

              <button
                type="button"
                onClick={() => setRenameTarget(null)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={saveRename}>
              <label>Nuevo nombre</label>

              <input
                autoFocus
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                maxLength={255}
                required
              />

              <div className="app-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setRenameTarget(null)}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="primary-button"
                >
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PreviewModal
        preview={preview}
        onClose={closePreview}
      />
    </div>
  );
}

/* =========================================================
   PROTECCIÓN DE RUTAS Y APLICACIÓN
========================================================= */

function ProtectedRoute({ children }) {
  const auth = useAuth();

  if (auth.loading) {
    return <LoadingScreen message="Verificando sesión..." />;
  }

  if (!auth.user) {
    return <Navigate to="/login" replace />;
  }

  if (
    auth.user.must_change_password ||
    auth.user.mustChangePassword
  ) {
    return <Navigate to="/auth/change-temporary-password" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const auth = useAuth();

  if (auth.loading) {
    return <LoadingScreen message="Verificando sesión..." />;
  }

  if (auth.user) {
    if (
      auth.user.must_change_password ||
      auth.user.mustChangePassword
    ) {
      return (
        <Navigate
          to="/auth/change-temporary-password"
          replace
        />
      );
    }

    return <Navigate to="/drive" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      <Route
        path="/auth/forgot-password"
        element={<ForgotPasswordPage />}
      />

      <Route
        path="/auth/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />

      <Route
        path="/auth/verify-email"
        element={<VerifyEmailPage />}
      />

      <Route
        path="/auth/resend-verification"
        element={<ResendVerificationPage />}
      />

      <Route
        path="/auth/change-temporary-password"
        element={<ChangeTemporaryPasswordPage />}
      />

      <Route
        path="/drive"
        element={
          <ProtectedRoute>
            <Drive />
          </ProtectedRoute>
        }
      />

      <Route
        path="/"
        element={<Navigate to="/drive" replace />}
      />

      <Route
        path="*"
        element={<Navigate to="/drive" replace />}
      />
    </Routes>
  );
}