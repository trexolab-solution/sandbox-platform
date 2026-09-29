"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Bell,
  Globe,
  AlertTriangle,
  Shield,
  Terminal,
  User,
  Server,
  Check,
  CheckCheck,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAdminNotifications,
  type StoredNotification,
} from "@/hooks/use-admin-notifications";
import { formatDistanceToNow } from "date-fns";

const notificationIcons: Record<string, React.ElementType> = {
  internet_request: Globe,
  security_alert: AlertTriangle,
  command_blocked: Terminal,
  blocked_command: Terminal,
  user_blocked: Shield,
  user_banned: Shield,
  user_unblocked: Shield,
  container_stopped: Server,
  container_started: Server,
  new_user_registered: User,
};

const severityColors: Record<string, string> = {
  info: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  warning: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  critical: "bg-red-500/10 text-red-600 border-red-500/20",
};

function NotificationItem({
  notification,
  onMarkAsRead,
  onClick,
}: {
  notification: StoredNotification;
  onMarkAsRead: () => void;
  onClick: () => void;
}) {
  const Icon = notificationIcons[notification.type] || Bell;
  const timeAgo = formatDistanceToNow(new Date(notification.timestamp), {
    addSuffix: true,
  });

  return (
    <div
      className={cn(
        "flex gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted/50",
        !notification.read && "bg-muted/30"
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
          severityColors[notification.severity]
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-sm leading-tight",
              !notification.read && "font-medium"
            )}
          >
            {notification.title}
          </p>
          {!notification.read && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead();
              }}
            >
              <Check className="h-3 w-3" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground/70">{timeAgo}</p>
      </div>
    </div>
  );
}

interface AdminNotificationCenterProps {
  onRefreshRequests?: () => void;
}

export function AdminNotificationCenter({
  onRefreshRequests,
}: AdminNotificationCenterProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleInternetRequest = useCallback(() => {
    // Refresh the requests table if callback provided
    onRefreshRequests?.();
  }, [onRefreshRequests]);

  const {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useAdminNotifications({
    onInternetRequest: handleInternetRequest,
    showToasts: true,
  });

  const handleNotificationClick = (notification: StoredNotification) => {
    // Mark as read
    markAsRead(notification.id);

    // Navigate based on type
    switch (notification.type) {
      case "internet_request":
        router.push("/admin/internet-requests");
        break;
      case "security_alert":
        router.push("/admin/security-alerts");
        break;
      case "command_blocked":
      case "blocked_command":
        router.push("/admin/command-logs");
        break;
      case "user_blocked":
      case "user_banned":
      case "user_unblocked":
      case "new_user_registered":
        router.push("/admin/users");
        break;
      case "container_stopped":
      case "container_started":
        router.push("/admin/sandboxes");
        break;
    }

    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[380px] p-0"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">Notifications</h4>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Connection status */}
            <Badge
              variant="outline"
              className={cn(
                "text-xs gap-1",
                isConnected
                  ? "text-green-600 border-green-500/30"
                  : "text-red-600 border-red-500/30"
              )}
            >
              {isConnected ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              {isConnected ? "Live" : "Offline"}
            </Badge>
            {notifications.length > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={clearAll}
                  title="Clear all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Notifications list */}
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm">No notifications yet</p>
              <p className="text-xs mt-1">
                You&apos;ll see alerts and requests here
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={() => markAsRead(notification.id)}
                  onClick={() => handleNotificationClick(notification)}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  router.push("/admin/internet-requests");
                  setOpen(false);
                }}
              >
                View all requests
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
