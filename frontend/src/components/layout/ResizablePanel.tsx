import * as React from "react";
import { cn } from "@/lib/utils";

interface ResizablePanelProps {
  children: React.ReactNode;
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  side: "left" | "right";
  isCollapsed: boolean;
  className?: string;
}

export function ResizablePanel({
  children,
  defaultWidth,
  minWidth = 150,
  maxWidth = 600,
  side,
  isCollapsed,
  className,
}: ResizablePanelProps) {
  const [width, setWidth] = React.useState(defaultWidth);
  const [isResizing, setIsResizing] = React.useState(false);

  const startResizing = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = React.useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        let newWidth;
        if (side === "left") {
          newWidth = e.clientX - 80; // Subtract ActivityBar width (w-20 = 80px)
        } else {
          newWidth = window.innerWidth - e.clientX;
        }

        if (newWidth >= minWidth && newWidth <= maxWidth) {
          setWidth(newWidth);
        }
      }
    },
    [isResizing, side, minWidth, maxWidth]
  );

  React.useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  if (isCollapsed) return null;

  return (
    <div
      style={{ width: `${width}px` }}
      className={cn(
        "relative flex flex-col shrink-0 h-full bg-muted/30 border-slate-200/50 dark:border-slate-800/50",
        side === "left" ? "border-r" : "border-l",
        className
      )}
    >
      {children}
      <div
        onMouseDown={startResizing}
        className={cn(
          "absolute top-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors z-50",
          side === "left" ? "right-0" : "left-0"
        )}
      />
    </div>
  );
}
