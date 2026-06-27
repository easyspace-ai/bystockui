import * as React from "react";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
  type PanelOnResize,
} from "react-resizable-panels";

type ResizableProps = React.ComponentProps<typeof PanelGroup>;

export function Resizable({ className, ...props }: ResizableProps) {
  return <PanelGroup className={className} {...props} />;
}

export const ResizablePanel = React.forwardRef<
  ImperativePanelHandle,
  React.ComponentProps<typeof Panel>
>(({ className, ...props }, ref) => {
  return <Panel ref={ref} className={className} {...props} />;
});

ResizablePanel.displayName = "ResizablePanel";

export function ResizableHandle({
  className,
  withHandle = false,
  ...props
}: React.ComponentProps<typeof PanelResizeHandle> & { withHandle?: boolean }) {
  return (
    <PanelResizeHandle
      className={[
        "relative flex items-center justify-center",
        "data-[resize-handle-state=drag]:bg-slate-300",
        "dark:data-[resize-handle-state=drag]:bg-slate-600",
        "transition-colors",
        className || "",
      ].join(" ")}
      {...props}
    >
      {withHandle ? (
        <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
          <div className="h-2 w-0.5 bg-slate-300 dark:bg-slate-600" />
        </div>
      ) : null}
    </PanelResizeHandle>
  );
}

export type { PanelOnResize };
