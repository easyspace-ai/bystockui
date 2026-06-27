import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Resizable, ResizableHandle, ResizablePanel } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

type WorkbenchLayoutProps = {
  left?: ReactNode;
  main: ReactNode;
  right: ReactNode;
  className?: string;
  innerClassName?: string;
  mainClassName?: string;
  leftPanelId?: string;
  mainPanelId?: string;
  rightPanelId?: string;
  leftMinPx?: number;
  leftMaxPx?: number;
  rightMinPx?: number;
  rightMaxPx?: number;
  leftSidebarVisible?: boolean;
  rightSidebarVisible?: boolean;
};

export function WorkbenchLayout({
  left,
  main,
  right,
  className,
  innerClassName,
  mainClassName,
  leftPanelId = "workbench-left",
  mainPanelId = "workbench-main",
  rightPanelId = "workbench-right",
  leftMinPx = 280,
  leftMaxPx = 480,
  rightMinPx = 280,
  rightMaxPx = 480,
  leftSidebarVisible = true,
  rightSidebarVisible = true,
}: WorkbenchLayoutProps) {
  const [leftSidebarWidth, setLeftSidebarWidthState] = useState(280);
  const [rightSidebarWidth, setRightSidebarWidthState] = useState(280);

  const setLeftSidebarWidth = (w: number) => setLeftSidebarWidthState(w);
  const setRightSidebarWidth = (w: number) => setRightSidebarWidthState(w);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const toPct = useMemo(
    () => (px: number) => {
      if (!containerWidth || containerWidth <= 0) return 20;
      return Math.max(0, Math.min(100, (px / containerWidth) * 100));
    },
    [containerWidth],
  );

  const onLeftResize = (size: number) => {
    if (!containerWidth) return;
    setLeftSidebarWidth(Math.round((size / 100) * containerWidth));
  };

  const onRightResize = (size: number) => {
    if (!containerWidth) return;
    setRightSidebarWidth(Math.round((size / 100) * containerWidth));
  };

  const layoutKey = `${leftSidebarVisible ? "L" : ""}${rightSidebarVisible ? "R" : ""}`;

  return (
    <div className={cn("flex flex-1 min-w-0 overflow-hidden", className)}>
      <div className={cn("flex flex-1 min-w-0 overflow-hidden", innerClassName)} ref={containerRef}>
        <Resizable direction="horizontal" className="flex flex-1 min-w-0" key={layoutKey}>
          {leftSidebarVisible && left != null && (
            <>
              <ResizablePanel
                id={leftPanelId}
                order={1}
                defaultSize={toPct(leftSidebarWidth)}
                minSize={toPct(leftMinPx)}
                maxSize={toPct(leftMaxPx)}
                onResize={onLeftResize}
              >
                {left}
              </ResizablePanel>
              <ResizableHandle className="w-px bg-slate-200 dark:bg-slate-800" />
            </>
          )}

          <ResizablePanel id={mainPanelId} order={2} className={cn("flex-1 min-w-0", mainClassName)}>
            {main}
          </ResizablePanel>

          {rightSidebarVisible && (
            <>
              <ResizableHandle className="w-px bg-slate-200 dark:bg-slate-800" />
              <ResizablePanel
                id={rightPanelId}
                order={3}
                defaultSize={toPct(rightSidebarWidth)}
                minSize={toPct(rightMinPx)}
                maxSize={toPct(rightMaxPx)}
                onResize={onRightResize}
              >
                {right}
              </ResizablePanel>
            </>
          )}
        </Resizable>
      </div>
    </div>
  );
}
