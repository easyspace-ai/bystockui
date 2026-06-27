import { LogOut, PanelLeft, PanelRight, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkbenchChrome } from "@/components/layout/WorkbenchChromeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

/** 顶栏：左右栏折叠、设置、当前用户与退出登录 */
export function TopNav() {
  const { toggleLeft, toggleRight } = useWorkbenchChrome();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="flex items-center justify-between px-4 sticky top-0 z-40 w-full bg-white dark:bg-slate-950 h-14 border-b border-slate-200/50 dark:border-slate-800/50 gap-2">
      <Button variant="ghost" size="icon" onClick={toggleLeft} className="h-8 w-8 shrink-0" aria-label="切换左侧栏">
        <PanelLeft size={18} className="text-slate-500" />
      </Button>

      <div className="flex-1 min-w-0" />

      <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-3 shrink-0 min-w-0">
        <span
          className="hidden sm:inline text-xs text-slate-600 dark:text-slate-400 truncate max-w-[140px]"
          title={user ? user.email || user.name : ""}
        >
          {user?.name ?? "—"}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs shrink-0"
          onClick={() => void handleLogout()}
          aria-label="退出登录"
        >
          <LogOut size={14} className="text-slate-500" />
          <span className="hidden md:inline">退出登录</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleRight} className="h-8 w-8" aria-label="切换右侧栏">
          <PanelRight size={18} className="text-slate-500" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="设置">
          <Settings size={18} className="text-slate-500" />
        </Button>
      </div>
    </header>
  );
}
