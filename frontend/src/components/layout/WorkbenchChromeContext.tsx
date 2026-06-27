import * as React from "react";

export type WorkbenchChromeState = {
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  toggleLeft: () => void;
  toggleRight: () => void;
};

const WorkbenchChromeContext = React.createContext<WorkbenchChromeState | null>(null);

export function WorkbenchChromeProvider({
  value,
  children,
}: {
  value: WorkbenchChromeState;
  children: React.ReactNode;
}) {
  return <WorkbenchChromeContext.Provider value={value}>{children}</WorkbenchChromeContext.Provider>;
}

export function useWorkbenchChrome(): WorkbenchChromeState {
  const ctx = React.useContext(WorkbenchChromeContext);
  if (!ctx) {
    throw new Error("useWorkbenchChrome must be used within WorkbenchChromeProvider");
  }
  return ctx;
}
