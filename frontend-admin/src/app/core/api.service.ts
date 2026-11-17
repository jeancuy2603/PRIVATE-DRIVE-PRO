
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private base = 'http://localhost:4000/api';

  // ==========================================
  // AUTENTICACIÓN
  // ==========================================

  login(identifier: string, password: string) {
    return this.http.post<any>(
      `${this.base}/auth/login`,
      { identifier, password },
      { withCredentials: true }
    );
  }

  logout() {
    return this.http.post<any>(
      `${this.base}/auth/logout`,
      {},
      { withCredentials: true }
    );
  }

  // Estado real de la API (no mostrar conexión solo por estar autenticado).
  health() {
    return this.http.get<any>(`${this.base}/health`);
  }

  // ==========================================
  // DASHBOARD
  // ==========================================

  dashboard() {
    return this.http.get<any>(
      `${this.base}/admin/dashboard`
    );
  }

  // ==========================================
  // USUARIOS
  // ==========================================

  users(search = '', status = '') {
    let params = new HttpParams();

    if (search) {
      params = params.set('search', search);
    }

    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<any[]>(
      `${this.base}/admin/users`,
      { params }
    );
  }

  pending() {
    return this.http.get<any[]>(
      `${this.base}/admin/users/pending`
    );
  }

  approve(id: number) {
    return this.http.patch(
      `${this.base}/admin/users/${id}/approve`,
      {}
    );
  }

  resendVerification(id: number) {
    return this.http.post(
      `${this.base}/admin/users/${id}/resend-verification`,
      {}
    );
  }

  suspend(id: number) {
    return this.http.patch(
      `${this.base}/admin/users/${id}/suspend`,
      {}
    );
  }

  reactivate(id: number) {
    return this.http.patch(
      `${this.base}/admin/users/${id}/reactivate`,
      {}
    );
  }

  deleteUser(id: number) {
    return this.http.delete<any>(
      `${this.base}/admin/users/${id}`
    );
  }

  // ==========================================
  // ESPACIOS PRIVADOS
  // ==========================================

  rooms() {
    return this.http.get<any[]>(
      `${this.base}/admin/rooms`
    );
  }

  createRoom(data: {
    name: string;
    description: string;
    owner_id: number;
    quota_bytes: number;
  }) {
    return this.http.post<any>(
      `${this.base}/admin/rooms`,
      data
    );
  }

  updateRoom(id: number, data: { name: string; description: string; quota_bytes: number }) {
    return this.http.patch<any>(`${this.base}/admin/rooms/${id}`, data);
  }

  deleteRoom(id: number) {
    return this.http.delete<any>(`${this.base}/admin/rooms/${id}`);
  }

  regenerateRoomCode(id: number) {
    return this.http.post<any>(`${this.base}/admin/rooms/${id}/regenerate-code`, {});
  }

  // ==========================================
  // ARCHIVOS
  // ==========================================

  files() {
    return this.http.get<any[]>(
      `${this.base}/admin/files`
    );
  }

  // ==========================================
  // AUDITORÍA Y SEGURIDAD
  // ==========================================

  audit() {
    return this.http.get<any[]>(
      `${this.base}/admin/audit`
    );
  }

  securityEvents() {
    return this.http.get<any[]>(
      `${this.base}/admin/security/events`
    );
  }

  // ==========================================
  // NOTIFICACIONES
  // ==========================================

  notifications() {
    return this.http.get<any[]>(
      `${this.base}/admin/notifications`
    );
  }

  // ==========================================
  // COPIAS DE SEGURIDAD
  // ==========================================

  backups() {
    return this.http.get<any[]>(
      `${this.base}/admin/backups`
    );
  }

  // ==========================================
  // CONFIGURACIÓN
  // ==========================================

  settings() {
    return this.http.get<any[]>(`${this.base}/admin/settings`);
  }

  saveSetting(setting_key: string, setting_value: any) {
    return this.http.put<any>(`${this.base}/admin/settings`, { setting_key, setting_value });
  }

  deleteSetting(key: string) {
    return this.http.delete<any>(`${this.base}/admin/settings/${encodeURIComponent(key)}`);
  }
}
