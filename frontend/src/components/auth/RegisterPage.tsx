import * as React from "react";
import { User, Mail, Lock, Eye, EyeOff, ShieldCheck, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { sendVerificationCode } from "@/lib/authApi";
import { cn } from "@/lib/utils";

interface RegisterPageProps {
  onLoginClick: () => void;
  onRegisterSuccess: () => void;
}

export function RegisterPage({ onLoginClick, onRegisterSuccess }: RegisterPageProps) {
  const { register } = useAuth();
  const [showPassword, setShowPassword] = React.useState(false);
  const [username, setUsername] = React.useState("");
  const [contact, setContact] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [agree, setAgree] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [codeBusy, setCodeBusy] = React.useState(false);

  async function handleSendCode() {
    setError(null);
    if (!contact.trim()) {
      setError("请先填写手机号或邮箱");
      return;
    }
    setCodeBusy(true);
    try {
      await sendVerificationCode(contact.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setCodeBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!agree) {
      setError("请阅读并同意服务条款与隐私政策");
      return;
    }
    if (!username.trim() || !contact.trim() || !password) {
      setError("请填写用户名、联系方式和密码");
      return;
    }
    setPending(true);
    try {
      await register(username.trim(), contact.trim(), password);
      onRegisterSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-white dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100 flex relative">
      {/* 左侧注册表单 */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12 relative z-10">
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">创建账号</h1>
            <p className="text-gray-500 dark:text-gray-400">加入我们，开启专业的量化投研之旅</p>
          </div>

          {error ? (
            <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          ) : null}

          <form className="space-y-5" onSubmit={(e) => void handleSubmit(e)}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                用户名
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={18} className="text-gray-400" />
                </div>
                <input
                  className={cn(
                    "w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg pl-10 pr-4 py-3 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all outline-none",
                    pending && "opacity-50 cursor-not-allowed"
                  )}
                  placeholder="设置您的用户名"
                  type="text"
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={pending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                手机号 / 邮箱
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
                  placeholder="用于账号验证与找回"
                  type="text"
                  name="contact"
                  autoComplete="email"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  disabled={pending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                验证码
              </label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <ShieldCheck size={18} className="text-gray-400" />
                  </div>
                  <input
                    className={cn(
                      "w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg pl-10 pr-4 py-3 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all outline-none",
                      pending && "opacity-50 cursor-not-allowed"
                    )}
                    placeholder="输入验证码"
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    disabled={pending}
                  />
                </div>
                <button
                  className={cn(
                    "px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 font-medium text-sm rounded-lg transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed",
                    codeBusy && "cursor-wait"
                  )}
                  type="button"
                  onClick={() => void handleSendCode()}
                  disabled={pending || codeBusy}
                >
                  {codeBusy ? "发送中…" : "获取验证码"}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                登录密码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-gray-400" />
                </div>
                <input
                  className={cn(
                    "w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg pl-10 pr-11 py-3 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all outline-none",
                    pending && "opacity-50 cursor-not-allowed"
                  )}
                  placeholder="设置登录密码"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="new-password"
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

            <div className="flex items-start gap-3 py-2">
              <input
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500/20 bg-gray-50 dark:bg-gray-900 mt-0.5"
                id="terms"
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                disabled={pending}
              />
              <label className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer" htmlFor="terms">
                我已阅读并同意 <span className="text-blue-600 dark:text-blue-400">服务条款</span> 和 <span className="text-blue-600 dark:text-blue-400">隐私政策</span>
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
                  注册中…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Zap size={16} />
                  完成注册
                </span>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
            已有账号？{" "}
            <button
              type="button"
              onClick={onLoginClick}
              className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700"
            >
              立即登录
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
                专业投研，从此刻开始
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                加入数万名专业投资者，使用强大的量化工具提升您的投资效率。
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
