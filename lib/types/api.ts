/**
 * Shared API types used across the application
 * Standardizes API request/response types
 */

// Internet request types
export type InternetRequestStatus =
  | "pending"
  | "approved"
  | "denied"
  | "expired"
  | "revoked";

export interface InternetRequest {
  id: string;
  containerId: string;
  userId: string;
  status: InternetRequestStatus;
  reason: string;
  durationMinutes: number;
  requestedAt: string; // ISO 8601
  reviewedAt: string | null;
  reviewedBy: string | null;
  adminNotes: string | null;
  expiresAt: string | null;
}

export interface InternetStatusResponse {
  internetAccess: boolean;
  internetExpiresAt: string | null; // ISO 8601
  currentNetwork: string | null;
  latestRequest: InternetRequest | null;
}

// Generic API response types
export interface ApiSuccessResponse<T = void> {
  success: true;
  data?: T;
  message?: string;
}

export interface ApiErrorResponse {
  success?: false;
  error: string;
  code?: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
}

export type ApiResponse<T = void> = ApiSuccessResponse<T> | ApiErrorResponse;

// Auth response types
export interface SessionVerifyResponse {
  valid: boolean;
  userId?: string;
  userName?: string;
  userEmail?: string;
  reason?: "expired" | "banned" | "not_found";
}

// User types
export interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string | null;
  banned: boolean;
  createdAt: Date;
}

// Security alert types
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertType =
  | "privilege_escalation"
  | "network_scan"
  | "host_probe"
  | "container_escape"
  | "blocked_command"
  | "user_blocked"
  | "suspicious_activity";

export interface SecurityAlert {
  id: string;
  containerId: string | null;
  userId: string | null;
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  details: Record<string, unknown> | null;
  acknowledged: boolean;
  createdAt: Date;
}

// Pagination types
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}
