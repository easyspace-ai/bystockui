import * as React from "react";
import { Mail, Eye, EyeOff, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface LoginPageProps {
  onRegisterClick: () => void;
  onLoginSuccess: () => void;
}

export function LoginPage({ onRegisterClick, onLoginSuccess }: LoginPageProps) {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = React.useState(false);
  const [loginId, setLoginId] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!loginId.trim() || !password) {
      setError("请填写账号和密码");
      return;
    }
    setPending(true);
    try {
      await login(loginId.trim(), password);
      if (!remember) {
        /* token stays in localStorage; "remember me" could use sessionStorage — omitted for simplicity */
      }
      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-white dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100 flex relative">
      {/* 左侧登录表单 */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
              <TrendingUp size={20} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-gray-900 dark:text-white">Quantum Pro</span>
              <span className="text-gray-500 dark:text-gray-400 text-sm">专业量化投研平台</span>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">欢迎回来</h1>
            <p className="text-gray-500 dark:text-gray-400">登录您的账户，继续您的量化之旅</p>
          </div>

          {error ? (
            <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 flex items-start gap-3">
              <span className="text-red-600 dark:text-red-400 text-sm">{error}</span>
            </div>
          ) : null}

          <form className="space-y-5" onSubmit={(e) => void handleSubmit(e)}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                邮箱或手机号码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={18} className="text-gray-400" />
                </div>
                <input
                  className={cn(
                    "w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg pl-10 pr-4 py-3 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all outline-none",
                    pending && "opacity-50 cursor-not-allowed"
                  )}
                  placeholder="name@company.com"
                  type="text"
                  name="login"
                  autoComplete="username"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  disabled={pending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  密码
                </label>
                <button type="button" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                  忘记密码？
                </button>
              </div>
              <div className="relative">
                <input
                  className={cn(
                    "w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg pl-4 pr-10 py-3 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all outline-none",
                    pending && "opacity-50 cursor-not-allowed"
                  )}
                  placeholder="••••••••"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={pending}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={pending}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500/20 bg-gray-50 dark:bg-gray-900"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  disabled={pending}
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  记住登录状态
                </span>
              </label>
            </div>

            <Button
              type="submit"
              disabled={pending}
              className={cn(
                "w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors",
                pending && "opacity-70 cursor-not-allowed"
              )}
            >
              {pending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  登录中…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Zap size={16} />
                  立即登录
                </span>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
            还没有账号？{" "}
            <button
              type="button"
              onClick={onRegisterClick}
              className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700"
            >
              免费注册
            </button>
          </p>
        </motion.div>
      </div>

      {/* 右侧品牌区域 */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-50 dark:bg-gray-900 relative">
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12">
          <div className="max-w-md text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-8">
                <TrendingUp size={32} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                专业量化投研平台
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                强大的AI分析、智能选股、策略回测，助您在市场中把握每一个机会。
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
