"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";

export interface StoredNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  userId?: string;
  userName?: string;
  containerId?: string;
  timestamp: string;
  read: boolean;
}

export interface AdminNotification {
  type: "blocked_command" | "user_banned" | "security_alert" | "internet_request" | "connected";
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  userId?: string;
  userName?: string;
  containerId?: string;
  timestamp: string;
}

interface UseAdminNotificationsOptions {
  onInternetRequest?: () => void;
  showToasts?: boolean;
}

const STORAGE_KEY = "admin_notifications";
const MAX_NOTIFICATIONS = 100;

function loadNotifications(): StoredNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveNotifications(notifications: StoredNotification[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch {
    // Ignore storage errors
  }
}

export function useAdminNotifications(options: UseAdminNotificationsOptions = {}) {
  const { onInternetRequest, showToasts = false } = options;
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onInternetRequestRef = useRef(onInternetRequest);

  // Update ref when callback changes
  useEffect(() => {
    onInternetRequestRef.current = onInternetRequest;
  }, [onInternetRequest]);

  // Load notifications from localStorage on mount
  useEffect(() => {
    setNotifications(loadNotifications());
  }, []);

  // Save to localStorage whenever notifications change
  useEffect(() => {
    saveNotifications(notifications);
  }, [notifications]);

  const addNotification = useCallback((notification: AdminNotification) => {
    const stored: StoredNotification = {
      id: Math.random().toString(36).substring(7),
      ...notification,
      read: false,
    };

    setNotifications((prev) => {
      const updated = [stored, ...prev].slice(0, MAX_NOTIFICATIONS);
      return updated;
    });

    // Show toast if enabled
    if (showToasts && notification.type !== "connected") {
      const toastFn = notification.severity === "critical" ? toast.error :
                      notification.severity === "warning" ? toast.warning :
                      toast.info;
      
      toastFn(notification.title, {
        description: notification.message,
      });
    }

    // Trigger callback for internet requests
    if (notification.type === "internet_request" && onInternetRequestRef.current) {
      onInternetRequestRef.current();
    }
  }, [showToasts]);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      return;
    }

    const eventSource = new EventSource("/api/admin/notifications/stream");
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log("[Admin Notifications] Connected to SSE stream");
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const notification = JSON.parse(event.data) as AdminNotification;
        
        // Skip "connected" messages
        if (notification.type === "connected") {
          return;
        }

        console.log("[Admin Notifications] Received:", notification);
        addNotification(notification);
      } catch (error) {
        console.error("[Admin Notifications] Parse error:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("[Admin Notifications] SSE error:", error);
      setIsConnected(false);
      eventSource.close();
      eventSourceRef.current = null;

      // Reconnect after 5 seconds
      setTimeout(() => {
        connect();
      }, 5000);
    };
  }, [addNotification]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
}
