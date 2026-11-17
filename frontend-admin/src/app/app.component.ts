
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from './core/api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- INICIO DE SESIÓN -->
    <div class="login-screen" *ngIf="!authenticated">
      <div class="login-card">

        <div class="brand-logo">
          <svg viewBox="0 0 66 66" aria-hidden="true">
            <rect x="1" y="1" width="64" height="64" rx="18"
              fill="#101f38" stroke="#24466e"/>
            <path
              d="M15 39c-5-1-8-5-8-10 0-6 5-11 11-11 3-8 10-12 18-10 7 1 12 7 13 14 7 0 12 5 12 11 0 7-5 12-12 12H18"
              transform="translate(2 5)"
              fill="none" stroke="#38bdf8" stroke-width="4"
              stroke-linecap="round"/>
            <rect x="25" y="33" width="22" height="19" rx="5" fill="#2563eb"/>
            <path d="M30 33v-5a6 6 0 0 1 12 0v5"
              fill="none" stroke="#eaf6ff" stroke-width="3"/>
            <circle cx="36" cy="42" r="2" fill="white"/>
            <path d="M36 44v3" stroke="white" stroke-width="2"/>
          </svg>

          <div class="brand-logo-text">
            <strong>PRIVATE DRIVE</strong>
            <span>PRO</span>
          </div>
        </div>

        <span class="eyebrow">CENTRO DE CONTROL</span>
        <h1>Panel de administración</h1>
        <p class="muted">Acceso seguro al centro de control.</p>

        <form (ngSubmit)="login()">
          <label>Correo o usuario</label>
          <input
            type="text"
            [(ngModel)]="identifier"
            name="identifier"
            placeholder="Administrador"
            autocomplete="username"
            required
          />

          <label>Contraseña</label>
          <input
            type="password"
            [(ngModel)]="password"
            name="password"
            placeholder="Ingresa tu contraseña"
            autocomplete="current-password"
            required
          />

          <p class="error" *ngIf="errorMessage">{{ errorMessage }}</p>

          <button class="primary-btn full" type="submit" [disabled]="loading">
            {{ loading ? 'Verificando...' : 'Iniciar sesión' }}
          </button>
        </form>

        <div class="login-footer">
          PRIVATE DRIVE PRO · Acceso restringido
        </div>
      </div>
    </div>

    <!-- PANEL ADMINISTRATIVO -->
    <div class="admin-layout" *ngIf="authenticated">
      <aside class="sidebar">

        <div class="brand-logo">
          <svg viewBox="0 0 66 66" aria-hidden="true">
            <rect x="1" y="1" width="64" height="64" rx="18"
              fill="#101f38" stroke="#24466e"/>
            <path
              d="M15 39c-5-1-8-5-8-10 0-6 5-11 11-11 3-8 10-12 18-10 7 1 12 7 13 14 7 0 12 5 12 11 0 7-5 12-12 12H18"
              transform="translate(2 5)"
              fill="none" stroke="#38bdf8" stroke-width="4"
              stroke-linecap="round"/>
            <rect x="25" y="33" width="22" height="19" rx="5" fill="#2563eb"/>
            <path d="M30 33v-5a6 6 0 0 1 12 0v5"
              fill="none" stroke="#eaf6ff" stroke-width="3"/>
            <circle cx="36" cy="42" r="2" fill="white"/>
            <path d="M36 44v3" stroke="white" stroke-width="2"/>
          </svg>

          <div class="brand-logo-text">
            <strong>PRIVATE DRIVE</strong>
            <span>PRO ADMIN</span>
          </div>
        </div>

        <div class="menu-caption">GENERAL</div>

        <button
          *ngFor="let item of mainMenu"
          class="menu-item"
          [class.active]="section === item.id"
          (click)="navigate(item.id)"
        >
          <span class="menu-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
          <span class="menu-arrow" *ngIf="section === item.id">●</span>
        </button>

        <div class="menu-caption secondary-caption">GESTIÓN Y CONTROL</div>

        <button
          *ngFor="let item of managementMenu"
          class="menu-item"
          [class.active]="section === item.id"
          (click)="navigate(item.id)"
        >
          <span class="menu-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
          <span class="menu-arrow" *ngIf="section === item.id">●</span>
        </button>

        <div class="sidebar-bottom">
          <div class="secure-label">
            <span class="secure-dot"></span>
            Sistema protegido
          </div>

          <button class="logout-btn" (click)="logout()">
            <span>↪</span> Cerrar sesión
          </button>
        </div>
      </aside>

      <main class="main-area">
        <header class="topbar">
          <div>
            <div class="breadcrumb">PRIVATE DRIVE PRO / ADMINISTRACIÓN</div>
            <h2>{{ currentTitle }}</h2>
          </div>

          <div class="topbar-right">
            <div class="connection-status">
              <span class="secure-dot" [class.offline]="!apiOnline"></span>
              {{ apiOnline ? 'API conectada' : 'API sin conexión' }}
            </div>
            <div class="avatar">AD</div>
          </div>
        </header>

        <div class="content">
          <div class="page-message error-banner" *ngIf="errorMessage && authenticated">
            {{ errorMessage }}
            <button (click)="errorMessage = ''">×</button>
          </div>

          <div class="page-message success-banner" *ngIf="successMessage">
            {{ successMessage }}
            <button (click)="successMessage = ''">×</button>
          </div>

          <div class="loading-line" *ngIf="loading">
            Cargando información...
          </div>

          <!-- DASHBOARD -->
          <section *ngIf="section === 'dashboard'">
            <div class="welcome-row">
              <div>
                <h3>Resumen general</h3>
                <p>Estado actual de tu infraestructura privada.</p>
              </div>
              <button class="secondary-btn" (click)="load()">
                ↻ Actualizar datos
              </button>
            </div>

            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-top">
                  <span>Usuarios registrados</span>
                  <span class="stat-icon blue">♙</span>
                </div>
                <strong>{{ dashboardData?.users?.total ?? 0 }}</strong>
                <small>Usuarios en el sistema</small>
              </div>

              <div class="stat-card">
                <div class="stat-top">
                  <span>Usuarios activos</span>
                  <span class="stat-icon green">✓</span>
                </div>
                <strong>{{ dashboardData?.users?.active ?? 0 }}</strong>
                <small>Cuentas habilitadas</small>
              </div>

              <div class="stat-card">
                <div class="stat-top">
                  <span>Pendientes</span>
                  <span class="stat-icon orange">◷</span>
                </div>
                <strong>{{ dashboardData?.users?.pending ?? 0 }}</strong>
                <small>Solicitudes por revisar</small>
              </div>

              <div class="stat-card">
                <div class="stat-top">
                  <span>Archivos almacenados</span>
                  <span class="stat-icon purple">▤</span>
                </div>
                <strong>{{ dashboardData?.files?.total ?? 0 }}</strong>
                <small>Archivos registrados</small>
              </div>

              <div class="stat-card">
                <div class="stat-top">
                  <span>Almacenamiento</span>
                  <span class="stat-icon cyan">▣</span>
                </div>
                <strong>{{ formatBytes(dashboardData?.files?.bytes ?? 0) }}</strong>
                <small>Espacio ocupado</small>
              </div>

              <div class="stat-card">
                <div class="stat-top">
                  <span>Salas privadas</span>
                  <span class="stat-icon pink">▦</span>
                </div>
                <strong>{{ getRoomCount() }}</strong>
                <small>Salas registradas</small>
              </div>
            </div>

            <div class="panel">
              <div class="panel-heading">
                <div>
                  <h3>Actividad reciente</h3>
                  <p>Últimos movimientos registrados en el sistema.</p>
                </div>
                <button class="text-btn" (click)="navigate('audit')">
                  Ver auditoría →
                </button>
              </div>

              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Acción</th>
                      <th>Entidad</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let activity of dashboardData?.activity">
                      <td>
                        {{ activity.first_name || 'Sistema' }}
                        {{ activity.last_name || '' }}
                      </td>
                      <td>{{ activity.action }}</td>
                      <td>{{ activity.entity || 'General' }}</td>
                      <td>{{ formatDate(activity.created_at) }}</td>
                    </tr>
                    <tr *ngIf="!dashboardData?.activity?.length">
                      <td colspan="4" class="empty">
                        No hay actividad registrada.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <!-- USUARIOS -->
          <section *ngIf="section === 'users'">
            <div class="welcome-row">
              <div>
                <h3>Administración de usuarios</h3>
                <p>Consulta y controla las cuentas registradas.</p>
              </div>
              <button class="secondary-btn" (click)="loadUsers()">
                ↻ Actualizar
              </button>
            </div>

            <div class="filter-bar">
              <input
                [(ngModel)]="userSearch"
                placeholder="Buscar por nombre, correo o usuario..."
                (keyup.enter)="loadUsers()"
              />
              <select [(ngModel)]="userStatus" (change)="loadUsers()">
                <option value="">Todos los estados</option>
                <option value="ACTIVA">Activos</option>
                <option value="PENDIENTE">Pendientes</option>
                <option value="VERIFICACION_PENDIENTE">Verificación pendiente</option>
                <option value="SUSPENDIDA">Suspendidos</option>
                <option value="BLOQUEADA">Bloqueados</option>
              </select>
              <button class="primary-btn" (click)="loadUsers()">Buscar</button>
            </div>

            <div class="panel">
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Correo</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      <th>Registro</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let user of users">
                      <td>
                        <strong>{{ user.first_name }} {{ user.last_name }}</strong>
                        <small class="subtext">&#64;{{ user.username }}</small>
                      </td>
                      <td>{{ user.email }}</td>
                      <td>{{ user.role || user.role_name || 'Usuario' }}</td>
                      <td>
                        <span class="status" [ngClass]="statusClass(user.status)">
                          {{ user.status }}
                        </span>
                      </td>
                      <td>{{ formatDate(user.created_at) }}</td>
                      <td>
                        <button
                          class="action-btn danger"
                          *ngIf="user.status !== 'SUSPENDIDA' && user.status !== 'BLOQUEADA'"
                          (click)="suspendUser(user.id)"
                        >
                          Suspender
                        </button>
                        <button
                          class="action-btn"
                          *ngIf="user.status === 'SUSPENDIDA' || user.status === 'BLOQUEADA'"
                          (click)="reactivateUser(user.id)"
                        >
                          Reactivar
                        </button>
                        <button
                          class="action-btn danger"
                          *ngIf="user.role !== 'SUPERADMIN' && user.role_name !== 'SUPERADMIN'"
                          (click)="deleteUser(user)"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                    <tr *ngIf="!users.length">
                      <td colspan="6" class="empty">
                        No se encontraron usuarios.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <!-- SOLICITUDES -->
          <section *ngIf="section === 'requests'">
            <div class="welcome-row">
              <div>
                <h3>Solicitudes de registro</h3>
                <p>Revisa las solicitudes antes de habilitar una cuenta.</p>
              </div>
              <button class="secondary-btn" (click)="loadPending()">
                ↻ Actualizar
              </button>
            </div>

            <div class="panel">
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Solicitante</th>
                      <th>Correo</th>
                      <th>Estado</th>
                      <th>Fecha</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let user of pendingUsers">
                      <td>{{ user.first_name }} {{ user.last_name }}</td>
                      <td>{{ user.email }}</td>
                      <td>
                        <span class="status pending">{{ user.status }}</span>
                      </td>
                      <td>{{ formatDate(user.created_at) }}</td>
                      <td>
                        <button class="action-btn" (click)="approveUser(user.id)">
                          Aprobar
                        </button>
                      </td>
                    </tr>
                    <tr *ngIf="!pendingUsers.length">
                      <td colspan="5" class="empty">
                        No hay solicitudes pendientes.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <!-- SALAS PRIVADAS -->
          <section *ngIf="section === 'rooms'">
            <div class="welcome-row">
              <div>
                <h3>Salas privadas</h3>
                <p>Administra las salas, propietarios y capacidades de almacenamiento.</p>
              </div>

              <div>
                <button class="primary-btn" (click)="openRoomForm()">
                  + Crear sala privada
                </button>
                <button class="secondary-btn" (click)="loadRooms()">
                  ↻ Actualizar
                </button>
              </div>
            </div>

            <div class="panel room-form-panel" *ngIf="showRoomForm">
              <div class="panel-heading">
                <div>
                  <h3>{{ editingRoomId ? 'Editar sala privada' : 'Nueva sala privada' }}</h3>
                  <p>{{ editingRoomId ? 'Actualiza el nombre, descripción o capacidad.' : 'Registra una sala y asigna su propietario.' }}</p>
                </div>
                <button class="text-btn" (click)="closeRoomForm()">
                  Cerrar ×
                </button>
              </div>

              <form (ngSubmit)="saveRoom()">
                <div class="filter-bar room-form-grid">
                  <div>
                    <label>Nombre de la sala</label>
                    <input
                      name="roomName"
                      [(ngModel)]="roomForm.name"
                      maxlength="120"
                      placeholder="Ej. Documentos personales"
                      required
                    />
                  </div>

                  <div *ngIf="!editingRoomId">
                    <label>Propietario</label>
                    <select
                      name="roomOwner"
                      [(ngModel)]="roomForm.owner_id"
                      required
                    >
                      <option [ngValue]="0">Seleccionar propietario</option>
                      <option *ngFor="let user of roomOwners" [ngValue]="user.id">
                        {{ user.first_name }} {{ user.last_name }} — {{ user.email }}
                      </option>
                    </select>
                    <small class="subtext" *ngIf="!roomOwners.length">
                      No hay usuarios habilitados disponibles.
                    </small>
                  </div>

                  <div>
                    <label>Capacidad de almacenamiento</label>
                    <select
                      name="roomQuota"
                      [(ngModel)]="roomForm.quota_bytes"
                      required
                    >
                      <option [ngValue]="1073741824">1 GB</option>
                      <option [ngValue]="5368709120">5 GB</option>
                      <option [ngValue]="10737418240">10 GB</option>
                      <option [ngValue]="53687091200">50 GB</option>
                      <option [ngValue]="107374182400">100 GB</option>
                    </select>
                  </div>

                  <div>
                    <label>Descripción</label>
                    <textarea
                      name="roomDescription"
                      [(ngModel)]="roomForm.description"
                      rows="3"
                      placeholder="Describe el propósito de esta sala"
                    ></textarea>
                  </div>
                </div>

                <div class="welcome-row">
                  <p class="subtext">
                    Se generará un código de acceso y se enviará al correo del propietario.
                  </p>

                  <div>
                    <button
                      type="button"
                      class="secondary-btn"
                      (click)="closeRoomForm()"
                      [disabled]="savingRoom"
                    >
                      Cancelar
                    </button>

                    <button
                      type="submit"
                      class="primary-btn"
                      [disabled]="savingRoom || (!editingRoomId && !roomOwners.length)"
                    >
                      {{ savingRoom ? 'Guardando...' : (editingRoomId ? 'Guardar cambios' : 'Crear sala y enviar código') }}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            <div class="data-grid">
              <div class="data-card" *ngFor="let room of rooms">
                <div class="data-card-icon">▦</div>
                <h3>{{ room.name }}</h3>
                <p>{{ room.description || 'Sin descripción' }}</p>

                <div class="data-line">
                  <span>Propietario</span>
                  <strong>{{ room.owner_name || room.owner_id }}</strong>
                </div>

                <div class="data-line">
                  <span>Miembros</span>
                  <strong>{{ room.members ?? 0 }}</strong>
                </div>

                <div class="data-line">
                  <span>Capacidad</span>
                  <strong>{{ formatBytes(room.quota_bytes ?? 0) }}</strong>
                </div>

                <div class="data-line">
                  <span>Almacenamiento usado</span>
                  <strong>{{ formatBytes(room.storage_bytes ?? 0) }}</strong>
                </div>

                <div class="data-line">
                  <span>Estado</span>
                  <span class="status" [ngClass]="statusClass(room.status)">
                    {{ room.status }}
                  </span>
                </div>
                <div class="room-actions">
                  <button class="secondary-btn" (click)="editRoom(room)">Editar / Renombrar</button>
                  <button class="secondary-btn" (click)="regenerateRoomCode(room.id)">↻ Nuevo código</button>
                  <button class="danger-btn" (click)="removeRoom(room)">Eliminar</button>
                </div>
              </div>

              <div class="empty-card" *ngIf="!rooms.length">
                No hay salas registradas.
              </div>
            </div>
          </section>

          <!-- ALMACENAMIENTO -->
          <section *ngIf="section === 'storage'">
            <div class="welcome-row">
              <div>
                <h3>Almacenamiento</h3>
                <p>Uso de espacio registrado en las salas privadas.</p>
              </div>
              <button class="secondary-btn" (click)="loadRooms()">
                ↻ Actualizar
              </button>
            </div>

            <div class="panel">
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Sala</th>
                      <th>Capacidad</th>
                      <th>Utilizado</th>
                      <th>Disponible</th>
                      <th>Uso</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let room of rooms">
                      <td>{{ room.name }}</td>
                      <td>{{ formatBytes(room.quota_bytes) }}</td>
                      <td>{{ formatBytes(room.storage_bytes) }}</td>
                      <td>
                        {{ formatBytes(availableBytes(room.quota_bytes, room.storage_bytes)) }}
                      </td>
                      <td>
                        <div class="progress-track">
                          <div
                            class="progress-value"
                            [style.width.%]="usagePercent(room.storage_bytes, room.quota_bytes)"
                          ></div>
                        </div>
                        <small>
                          {{ usagePercent(room.storage_bytes, room.quota_bytes) }}%
                        </small>
                      </td>
                    </tr>
                    <tr *ngIf="!rooms.length">
                      <td colspan="5" class="empty">
                        No hay información de almacenamiento.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <!-- ARCHIVOS -->
          <section *ngIf="section === 'files'">
            <div class="welcome-row">
              <div>
                <h3>Gestión de archivos</h3>
                <p>Consulta los metadatos de los archivos almacenados.</p>
              </div>
              <button class="secondary-btn" (click)="loadFiles()">
                ↻ Actualizar
              </button>
            </div>

            <div class="panel">
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Tipo</th>
                      <th>Tamaño</th>
                      <th>Propietario</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let file of files">
                      <td><strong>{{ file.original_name }}</strong></td>
                      <td>{{ file.mime_type }}</td>
                      <td>{{ formatBytes(file.size_bytes) }}</td>
                      <td>{{ file.owner_name || file.owner_id }}</td>
                      <td>{{ formatDate(file.created_at) }}</td>
                    </tr>
                    <tr *ngIf="!files.length">
                      <td colspan="5" class="empty">
                        No hay archivos registrados.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <!-- SEGURIDAD -->
          <section *ngIf="section === 'security'">
            <div class="welcome-row">
              <div>
                <h3>Centro de seguridad</h3>
                <p>Eventos y alertas de seguridad registrados.</p>
              </div>
              <button class="secondary-btn" (click)="loadSecurity()">
                ↻ Actualizar
              </button>
            </div>

            <div class="security-banner">
              <div class="security-shield">✓</div>
              <div>
                <strong>Protección y supervisión</strong>
                <p>
                  Consulta los eventos registrados por los mecanismos de seguridad del sistema.
                </p>
              </div>
            </div>

            <div class="panel">
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Evento</th>
                      <th>Severidad</th>
                      <th>Usuario</th>
                      <th>Detalles</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let event of security">
                      <td>{{ event.event }}</td>
                      <td>
                        <span class="status" [ngClass]="statusClass(event.severity)">
                          {{ event.severity }}
                        </span>
                      </td>
                      <td>{{ event.user_id || 'Sistema' }}</td>
                      <td>{{ event.details | json }}</td>
                      <td>{{ formatDate(event.created_at) }}</td>
                    </tr>
                    <tr *ngIf="!security.length">
                      <td colspan="5" class="empty">
                        No hay eventos de seguridad registrados.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <!-- AUDITORÍA -->
          <section *ngIf="section === 'audit'">
            <div class="welcome-row">
              <div>
                <h3>Registro de auditoría</h3>
                <p>Historial de operaciones realizadas dentro de la plataforma.</p>
              </div>
              <button class="secondary-btn" (click)="loadAudit()">
                ↻ Actualizar
              </button>
            </div>

            <div class="panel">
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Acción</th>
                      <th>Entidad</th>
                      <th>ID</th>
                      <th>IP</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let log of auditLogs">
                      <td>{{ log.action }}</td>
                      <td>{{ log.entity || 'General' }}</td>
                      <td>{{ log.entity_id || '—' }}</td>
                      <td>{{ log.ip_address || '—' }}</td>
                      <td>{{ formatDate(log.created_at) }}</td>
                    </tr>
                    <tr *ngIf="!auditLogs.length">
                      <td colspan="5" class="empty">
                        No hay registros de auditoría.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <!-- NOTIFICACIONES -->
          <section *ngIf="section === 'notifications'">
            <div class="welcome-row">
              <div>
                <h3>Notificaciones</h3>
                <p>Consulta las notificaciones almacenadas en el sistema.</p>
              </div>
              <button class="secondary-btn" (click)="loadNotifications()">
                ↻ Actualizar
              </button>
            </div>

            <div class="notification-list">
              <div class="notification-card" *ngFor="let notification of notifications">
                <div class="notification-icon">✉</div>
                <div class="notification-content">
                  <strong>{{ notification.title }}</strong>
                  <p>{{ notification.message }}</p>
                  <small>{{ formatDate(notification.created_at) }}</small>
                </div>
                <span
                  class="status"
                  [ngClass]="notification.read_at ? 'active' : 'pending'"
                >
                  {{ notification.read_at ? 'Leída' : 'Pendiente' }}
                </span>
              </div>
              <div class="empty-card" *ngIf="!notifications.length">
                No hay notificaciones registradas.
              </div>
            </div>
          </section>

          <!-- RESPALDOS -->
          <section *ngIf="section === 'backups'">
            <div class="welcome-row">
              <div>
                <h3>Copias de seguridad</h3>
                <p>Historial de respaldos registrados.</p>
              </div>
              <button class="secondary-btn" (click)="loadBackups()">
                ↻ Actualizar
              </button>
            </div>

            <div class="security-banner">
              <div class="security-shield">▣</div>
              <div>
                <strong>Historial de respaldos</strong>
                <p>
                  Esta vista consulta los registros existentes. La creación y restauración
                  de respaldos se implementará con controles específicos.
                </p>
              </div>
            </div>

            <div class="panel">
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Archivo</th>
                      <th>Tipo</th>
                      <th>Tamaño</th>
                      <th>Estado</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let backup of backups">
                      <td>{{ backup.file_name }}</td>
                      <td>{{ backup.backup_type }}</td>
                      <td>{{ formatBytes(backup.size_bytes) }}</td>
                      <td>
                        <span class="status" [ngClass]="statusClass(backup.status)">
                          {{ backup.status }}
                        </span>
                      </td>
                      <td>{{ formatDate(backup.created_at) }}</td>
                    </tr>
                    <tr *ngIf="!backups.length">
                      <td colspan="5" class="empty">
                        No hay respaldos registrados.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <!-- CONFIGURACIÓN -->
          <section *ngIf="section === 'settings'">
            <div class="welcome-row">
              <div>
                <h3>Configuración del sistema</h3>
                <p>Administra parámetros funcionales de la plataforma. Los valores se guardan como JSON.</p>
              </div>
              <button class="secondary-btn" (click)="loadSettings()">
                ↻ Actualizar
              </button>
            </div>

            <div class="panel settings-editor">
              <div class="panel-heading"><div><h3>Crear o actualizar parámetro</h3><p>Usa una clave única y un valor JSON válido.</p></div></div>
              <form class="settings-form" (ngSubmit)="saveSetting()">
                <div><label>Clave</label><input name="settingKey" [(ngModel)]="settingForm.key" placeholder="Ej. app.max_upload_mb" required maxlength="100" /></div>
                <div><label>Valor JSON</label><textarea name="settingValue" [(ngModel)]="settingForm.value" rows="3" placeholder='Ej. 100 o "Mi plataforma" o {"enabled":true}' required></textarea></div>
                <button class="primary-btn" type="submit" [disabled]="savingSetting">{{ savingSetting ? 'Guardando...' : 'Guardar configuración' }}</button>
              </form>
            </div>
            <div class="panel">
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Parámetro</th>
                      <th>Valor</th>
                      <th>Última actualización</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let setting of settings">
                      <td><strong>{{ setting.setting_key }}</strong></td>
                      <td>{{ setting.setting_value | json }}</td>
                      <td>{{ formatDate(setting.updated_at) }}</td>
                      <td><button class="action-btn" (click)="editSetting(setting)">Editar</button> <button class="danger-btn" (click)="removeSetting(setting.setting_key)">Eliminar</button></td>
                    </tr>
                    <tr *ngIf="!settings.length">
                      <td colspan="4" class="empty">
                        No hay parámetros configurados.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  `
})
export class AppComponent implements OnInit {
  private api = inject(ApiService);

  authenticated = false;
  loading = false;
  apiOnline = false;

  identifier = '';
  password = '';

  errorMessage = '';
  successMessage = '';

  section = 'dashboard';

  dashboardData: any = null;

  users: any[] = [];
  pendingUsers: any[] = [];
  rooms: any[] = [];
  roomOwners: any[] = [];
  files: any[] = [];
  security: any[] = [];
  auditLogs: any[] = [];
  notifications: any[] = [];
  backups: any[] = [];
  settings: any[] = [];

  userSearch = '';
  userStatus = '';

  showRoomForm = false;
  savingRoom = false;
  editingRoomId: number | null = null;
  savingSetting = false;
  settingForm = { key: '', value: 'true' };

  roomForm = {
    name: '',
    description: '',
    owner_id: 0,
    quota_bytes: 1073741824
  };

  mainMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: '⌂' },
    { id: 'users', label: 'Usuarios', icon: '♙' },
    { id: 'requests', label: 'Solicitudes', icon: '▤' },
    { id: 'rooms', label: 'Salas privadas', icon: '▦' },
    { id: 'storage', label: 'Almacenamiento', icon: '▣' },
    { id: 'files', label: 'Archivos', icon: '▧' }
  ];

  managementMenu = [
    { id: 'security', label: 'Seguridad', icon: '◈' },
    { id: 'audit', label: 'Auditoría', icon: '◷' },
    { id: 'notifications', label: 'Notificaciones', icon: '♧' },
    { id: 'backups', label: 'Respaldos', icon: '▥' },
    { id: 'settings', label: 'Configuración', icon: '⚙' }
  ];

  get currentTitle(): string {
    const all = [...this.mainMenu, ...this.managementMenu];
    return all.find(item => item.id === this.section)?.label || 'Administración';
  }

  ngOnInit(): void {
    this.checkApiStatus();
    const token = sessionStorage.getItem('accessToken');

    if (token) {
      this.authenticated = true;
      this.load();
    }
  }

  checkApiStatus(): void {
    this.api.health().subscribe({
      next: () => { this.apiOnline = true; },
      error: () => { this.apiOnline = false; }
    });
  }

  login(): void {
    this.errorMessage = '';

    if (!this.identifier.trim() || !this.password) {
      this.errorMessage = 'Ingresa tu usuario y contraseña.';
      return;
    }

    this.loading = true;

    this.api.login(this.identifier, this.password).subscribe({
      next: (response: any) => {
        const token =
          response.accessToken ||
          response.access_token ||
          response.token;

        if (!token) {
          this.errorMessage = 'El servidor no devolvió un token de acceso.';
          this.loading = false;
          return;
        }

        sessionStorage.setItem('accessToken', token);
        this.authenticated = true;
        this.checkApiStatus();
        this.password = '';
        this.loading = false;
        this.load();
      },
      error: (error: any) => {
        this.loading = false;
        this.errorMessage =
          error.error?.message || 'No fue posible iniciar sesión.';
      }
    });
  }

  // CIERRE DE SESIÓN CON REVOCACIÓN EN EL BACKEND
  logout(): void {
    // Se solicita al backend revocar la cookie de actualización.
    // La limpieza local se realiza inmediatamente, incluso si falla la petición.
    this.api.logout().subscribe({
      next: () => {
        console.log('Sesión cerrada y revocada correctamente.');
      },
      error: (error: any) => {
        console.error(
          'No fue posible confirmar la revocación de la sesión:',
          error
        );
      }
    });

    sessionStorage.removeItem('accessToken');

    this.authenticated = false;
    this.loading = false;

    this.identifier = '';
    this.password = '';

    this.section = 'dashboard';

    this.errorMessage = '';
    this.successMessage = '';

    this.dashboardData = null;
  }

  navigate(section: string): void {
    this.section = section;
    this.errorMessage = '';
    this.successMessage = '';

    switch (section) {
      case 'dashboard':
        this.load();
        break;
      case 'users':
        this.loadUsers();
        break;
      case 'requests':
        this.loadPending();
        break;
      case 'rooms':
        this.loadRooms();
        this.loadRoomOwners();
        break;
      case 'storage':
        this.loadRooms();
        break;
      case 'files':
        this.loadFiles();
        break;
      case 'security':
        this.loadSecurity();
        break;
      case 'audit':
        this.loadAudit();
        break;
      case 'notifications':
        this.loadNotifications();
        break;
      case 'backups':
        this.loadBackups();
        break;
      case 'settings':
        this.loadSettings();
        break;
    }
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';

    this.api.dashboard().subscribe({
      next: (data: any) => {
        console.log('RESPUESTA COMPLETA DEL DASHBOARD:', data);
        console.log('DATOS DE SALAS:', data?.rooms);

        this.dashboardData = data;
        this.loading = false;
      },
      error: (error: any) => this.handleError(error)
    });
  }

  getRoomCount(): number {
    const rooms = this.dashboardData?.rooms;

    if (typeof rooms === 'number' && Number.isFinite(rooms)) {
      return rooms;
    }

    if (Array.isArray(rooms)) {
      return rooms.length;
    }

    if (rooms && typeof rooms === 'object') {
      const possibleCounts = [
        rooms.active,
        rooms.total,
        rooms.count
      ];

      for (const count of possibleCounts) {
        const parsed = Number(count);

        if (
          count !== null &&
          count !== undefined &&
          count !== '' &&
          Number.isFinite(parsed)
        ) {
          return parsed;
        }
      }

      if (Array.isArray(rooms.rooms)) {
        return rooms.rooms.length;
      }
    }

    return 0;
  }

  loadUsers(): void {
    this.loading = true;

    this.api.users(this.userSearch, this.userStatus).subscribe({
      next: (data: any) => {
        this.users = Array.isArray(data) ? data : data.users || [];
        this.loading = false;
      },
      error: (error: any) => this.handleError(error)
    });
  }

  loadPending(): void {
    this.loading = true;

    this.api.pending().subscribe({
      next: (data: any) => {
        this.pendingUsers = Array.isArray(data) ? data : data.users || [];
        this.loading = false;
      },
      error: (error: any) => this.handleError(error)
    });
  }

  loadRooms(): void {
    this.loading = true;

    this.api.rooms().subscribe({
      next: (data: any) => {
        this.rooms = Array.isArray(data) ? data : data.rooms || [];
        this.loading = false;
      },
      error: (error: any) => this.handleError(error)
    });
  }

  loadRoomOwners(): void {
    this.api.users().subscribe({
      next: (data: any) => {
        const list = Array.isArray(data) ? data : data.users || [];

        this.roomOwners = list.filter((user: any) =>
          ['ACTIVA', 'VERIFICADA'].includes(
            String(user.status || '').toUpperCase()
          )
        );
      },
      error: (error: any) => {
        this.roomOwners = [];
        this.errorMessage =
          'No se pudieron cargar los propietarios disponibles.';
      }
    });
  }

  openRoomForm(): void {
    this.editingRoomId = null;
    this.errorMessage = '';
    this.successMessage = '';

    this.roomForm = {
      name: '',
      description: '',
      owner_id: 0,
      quota_bytes: 1073741824
    };

    this.showRoomForm = true;

    if (!this.roomOwners.length) {
      this.loadRoomOwners();
    }
  }

  closeRoomForm(): void {
    if (this.savingRoom) return;
    this.showRoomForm = false;
    this.editingRoomId = null;
  }

  editRoom(room: any): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.editingRoomId = Number(room.id);
    this.roomForm = { name: room.name || '', description: room.description || '', owner_id: Number(room.owner_id), quota_bytes: Number(room.quota_bytes) };
    this.showRoomForm = true;
  }

  regenerateRoomCode(id: number): void {
    if (!confirm('¿Revocar el código anterior y generar uno nuevo para esta sala?')) return;
    this.loading = true;
    this.api.regenerateRoomCode(id).subscribe({
      next: (response: any) => { this.loading = false; this.successMessage = response.message; this.loadRooms(); },
      error: (error: any) => this.handleError(error)
    });
  }

  removeRoom(room: any): void {
    if (!confirm(`¿Eliminar la sala "${room.name}"? La operación solo se permite si no contiene archivos ni carpetas.`)) return;
    this.loading = true;
    this.api.deleteRoom(Number(room.id)).subscribe({
      next: (response: any) => { this.loading = false; this.successMessage = response.message; this.loadRooms(); this.load(); },
      error: (error: any) => this.handleError(error)
    });
  }

  saveRoom(): void {
    this.errorMessage = '';
    this.successMessage = '';

    const name = this.roomForm.name.trim();
    const ownerId = Number(this.roomForm.owner_id);
    const quota = Number(this.roomForm.quota_bytes);

    if (!name) {
      this.errorMessage = 'Escribe el nombre de la sala.';
      return;
    }

    if (!Number.isSafeInteger(ownerId) || ownerId <= 0) {
      this.errorMessage = 'Selecciona un propietario.';
      return;
    }

    if (!Number.isSafeInteger(quota) || quota <= 0) {
      this.errorMessage = 'Selecciona una capacidad válida.';
      return;
    }

    this.savingRoom = true;

    const payload = {
      name,
      description: this.roomForm.description.trim(),
      owner_id: ownerId,
      quota_bytes: quota
    };

    const request = this.editingRoomId
      ? this.api.updateRoom(this.editingRoomId, { name, description: payload.description, quota_bytes: quota })
      : this.api.createRoom(payload);

    const wasEditing = Boolean(this.editingRoomId);
    request.subscribe({
      next: (response: any) => {
        this.savingRoom = false;
        this.showRoomForm = false;
        this.editingRoomId = null;

        this.successMessage = response.message || (wasEditing ? 'Sala actualizada correctamente.' : 'Sala privada creada correctamente.');

        this.roomForm = {
          name: '',
          description: '',
          owner_id: 0,
          quota_bytes: 1073741824
        };

        this.loadRooms();
        this.loadRoomOwners();
        this.load();
      },
      error: (error: any) => {
        this.savingRoom = false;
        this.handleError(error);
      }
    });
  }

  loadFiles(): void {
    this.loading = true;

    this.api.files().subscribe({
      next: (data: any) => {
        this.files = Array.isArray(data) ? data : data.files || [];
        this.loading = false;
      },
      error: (error: any) => this.handleError(error)
    });
  }

  loadSecurity(): void {
    this.loading = true;

    this.api.securityEvents().subscribe({
      next: (data: any) => {
        this.security = Array.isArray(data) ? data : data.events || [];
        this.loading = false;
      },
      error: (error: any) => this.handleError(error)
    });
  }

  loadAudit(): void {
    this.loading = true;

    this.api.audit().subscribe({
      next: (data: any) => {
        this.auditLogs = Array.isArray(data) ? data : data.logs || [];
        this.loading = false;
      },
      error: (error: any) => this.handleError(error)
    });
  }

  loadNotifications(): void {
    this.loading = true;

    this.api.notifications().subscribe({
      next: (data: any) => {
        this.notifications = Array.isArray(data)
          ? data
          : data.notifications || [];
        this.loading = false;
      },
      error: (error: any) => this.handleError(error)
    });
  }

  loadBackups(): void {
    this.loading = true;

    this.api.backups().subscribe({
      next: (data: any) => {
        this.backups = Array.isArray(data) ? data : data.backups || [];
        this.loading = false;
      },
      error: (error: any) => this.handleError(error)
    });
  }

  loadSettings(): void {
    this.loading = true;

    this.api.settings().subscribe({
      next: (data: any) => {
        this.settings = Array.isArray(data) ? data : data.settings || [];
        this.loading = false;
      },
      error: (error: any) => this.handleError(error)
    });
  }

  saveSetting(): void {
    this.errorMessage = '';
    let parsed: any;
    try { parsed = JSON.parse(this.settingForm.value); }
    catch { this.errorMessage = 'El valor debe ser JSON válido. Ejemplos: true, 100, "texto" o {"enabled":true}.'; return; }
    this.savingSetting = true;
    this.api.saveSetting(this.settingForm.key.trim(), parsed).subscribe({
      next: (response: any) => { this.savingSetting = false; this.successMessage = response.message; this.settingForm = { key: '', value: 'true' }; this.loadSettings(); },
      error: (error: any) => { this.savingSetting = false; this.handleError(error); }
    });
  }

  editSetting(setting: any): void {
    this.settingForm = { key: setting.setting_key, value: JSON.stringify(setting.setting_value, null, 2) };
  }

  removeSetting(key: string): void {
    if (!confirm(`¿Eliminar la configuración "${key}"?`)) return;
    this.api.deleteSetting(key).subscribe({
      next: (response: any) => { this.successMessage = response.message; this.loadSettings(); },
      error: (error: any) => this.handleError(error)
    });
  }

  approveUser(id: number): void {
    if (!confirm('¿Deseas aprobar esta solicitud y enviar el código de verificación?')) {
      return;
    }

    this.loading = true;

    this.api.approve(id).subscribe({
      next: () => {
        this.successMessage =
          'Solicitud aprobada. Se intentó enviar el correo de verificación.';
        this.loadPending();
      },
      error: (error: any) => this.handleError(error)
    });
  }

  suspendUser(id: number): void {
    if (!confirm('¿Deseas suspender esta cuenta?')) return;

    this.loading = true;

    this.api.suspend(id).subscribe({
      next: () => {
        this.successMessage = 'Cuenta suspendida.';
        this.loadUsers();
      },
      error: (error: any) => this.handleError(error)
    });
  }

  reactivateUser(id: number): void {
    if (!confirm('¿Deseas solicitar la reactivación de esta cuenta?')) return;

    this.loading = true;

    this.api.reactivate(id).subscribe({
      next: () => {
        this.successMessage = 'Cuenta reactivada.';
        this.loadUsers();
      },
      error: (error: any) => this.handleError(error)
    });
  }

  deleteUser(user: any): void {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    const confirmed = confirm(
      `Vas a eliminar definitivamente la cuenta de ${fullName || user.username || user.email}. ` +
      'También se eliminarán sus archivos, carpetas y sala privada. Esta acción no se puede deshacer. ¿Continuar?'
    );

    if (!confirmed) return;

    this.loading = true;
    this.api.deleteUser(Number(user.id)).subscribe({
      next: (response: any) => {
        this.successMessage = response?.message || 'Cuenta eliminada correctamente.';
        this.loadUsers();
        this.load();
        this.loadRooms();
        this.loadFiles();
      },
      error: (error: any) => this.handleError(error)
    });
  }

  handleError(error: any): void {
    this.loading = false;

    if (error.status === 401 || error.status === 403) {
      this.errorMessage =
        error.error?.message || 'Tu sesión no tiene autorización.';

      if (error.status === 401) {
        this.logout();
      }

      return;
    }

    this.errorMessage =
      error.error?.message ||
      'No se pudo cargar la información del servidor.';
  }

  formatBytes(bytes: number | string | null | undefined): string {
    const value = Number(bytes || 0);

    if (!Number.isFinite(value) || value <= 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];

    const index = Math.min(
      Math.floor(Math.log(value) / Math.log(1024)),
      units.length - 1
    );

    return `${(value / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
  }

  formatDate(date: string | null | undefined): string {
    if (!date) return '—';

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) return '—';

    return parsed.toLocaleString('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }

  statusClass(status: string): string {
    const value = String(status || '').toUpperCase();

    if (
      [
        'ACTIVA',
        'ACTIVO',
        'APROBADA',
        'VERIFICADA',
        'SUCCESS',
        'COMPLETED'
      ].includes(value)
    ) {
      return 'active';
    }

    if (
      [
        'PENDIENTE',
        'EN_REVISION',
        'VERIFICACION_PENDIENTE',
        'MEDIUM',
        'WARNING'
      ].includes(value)
    ) {
      return 'pending';
    }

    if (
      [
        'SUSPENDIDA',
        'BLOQUEADA',
        'RECHAZADA',
        'CRITICAL',
        'HIGH',
        'FAILED'
      ].includes(value)
    ) {
      return 'blocked';
    }

    return 'neutral';
  }

  availableBytes(
    quota: number | string,
    used: number | string
  ): number {
    return Math.max(
      0,
      Number(quota || 0) - Number(used || 0)
    );
  }

  usagePercent(
    used: number | string,
    quota: number | string
  ): number {
    const capacity = Number(quota || 0);

    if (!Number.isFinite(capacity) || capacity <= 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.round((Number(used || 0) / capacity) * 100)
    );
  }
}
