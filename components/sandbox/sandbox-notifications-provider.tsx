"use client";

import { createContext, useContext, ReactNode } from "react";
import { useSandboxNotifications, type CreationProgressData } from "@/hooks/use-sandbox-notifications";

interface SandboxNotificationsContextValue {
  isConnected: boolean;
  creatingContainers: CreationProgressData[];
}

const SandboxNotificationsContext = createContext<SandboxNotificationsContextValue>({
  isConnected: false,
  creatingContainers: [],
});

export function useSandboxNotificationsContext() {
  return useContext(SandboxNotificationsContext);
}

interface SandboxNotificationsProviderProps {
  children: ReactNode;
}

export function SandboxNotificationsProvider({ children }: SandboxNotificationsProviderProps) {
  const { isConnected, creatingContainers } = useSandboxNotifications({
    showToasts: true,
  });

  return (
    <SandboxNotificationsContext.Provider value={{ isConnected, creatingContainers }}>
      {children}
    </SandboxNotificationsContext.Provider>
  );
}
