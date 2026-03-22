import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Checkbox } from "../components/ui/checkbox";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../components/ui/input-otp";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nContext";

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await login({
        email,
        password,
        remember: rememberMe,
        otp_code: twoFactorRequired ? otpCode : undefined,
      });

      if (result.twoFactorRequired) {
        setTwoFactorRequired(true);
        setOtpHint(result.emailHint ?? null);
        return;
      }

      navigate("/dashboard");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unable to sign in.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl mb-4 shadow-lg">
            <div className="w-12 h-12 bg-[#2563EB] rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">HR</span>
            </div>
          </div>
          <h1 className="text-3xl font-semibold text-white mb-2">{t("login.welcome")}</h1>
          <p className="text-blue-100">{t("login.subtitle")}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                {t("login.email")}
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="bg-gray-50"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                {t("login.password")}
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                required
                className="bg-gray-50"
              />
            </div>

            {twoFactorRequired && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Verification Code</label>
                <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                <p className="text-xs text-gray-500 mt-2">
                  {otpHint ? `We sent a 6-digit code to ${otpHint}.` : "We sent a 6-digit code to your email."}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer">
                  {t("login.remember")}
                </label>
              </div>
              <a href="#" className="text-sm font-medium text-[#2563EB] hover:text-[#1d4ed8]">
                {t("login.forgot")}
              </a>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
              disabled={submitting || (twoFactorRequired && otpCode.length < 6)}
            >
              {submitting ? t("login.submitting") : twoFactorRequired ? "Verify & Sign In" : t("login.submit")}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {t("login.no_account")}{" "}
              <a href="#" className="font-medium text-[#2563EB] hover:text-[#1d4ed8]">
                {t("login.contact_admin")}
              </a>
            </p>
          </div>
        </div>

        <div className="text-center mt-8 text-blue-100 text-sm">
          Copyright 2026 HRManager. {t("login.footer")}
        </div>
      </div>
    </div>
  );
}
