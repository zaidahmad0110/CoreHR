import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Checkbox } from "../components/ui/checkbox";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../components/ui/input-otp";
import { authService } from "../api/services";
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
  const [passwordResetMode, setPasswordResetMode] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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

  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await authService.requestPasswordReset(email);
      setResetCodeSent(true);
      setSuccessMessage("If this email exists, a reset code has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request password reset.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await authService.resetPassword({
        email,
        code: resetCode,
        password: newPassword,
        password_confirmation: confirmNewPassword,
      });
      setPasswordResetMode(false);
      setResetCode("");
      setNewPassword("");
      setConfirmNewPassword("");
      setResetCodeSent(false);
      setSuccessMessage("Password reset successfully. You can now sign in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password.");
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
          <form
            onSubmit={passwordResetMode ? (resetCodeSent ? handleResetPassword : handleRequestPasswordReset) : handleLogin}
            className="space-y-6"
          >
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                {successMessage}
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

            {!passwordResetMode && (
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
            )}

            {passwordResetMode && resetCodeSent && (
              <>
                <div>
                  <label htmlFor="reset-code" className="block text-sm font-medium text-gray-700 mb-2">
                    Reset Code
                  </label>
                  <Input
                    id="reset-code"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                    required
                    className="bg-gray-50"
                  />
                </div>
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="********"
                    required
                    className="bg-gray-50"
                  />
                </div>
                <div>
                  <label htmlFor="confirm-new-password" className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm New Password
                  </label>
                  <Input
                    id="confirm-new-password"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="********"
                    required
                    className="bg-gray-50"
                  />
                </div>
              </>
            )}

            {twoFactorRequired && !passwordResetMode && (
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

            {!passwordResetMode && (
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
                <button
                  type="button"
                  className="text-sm font-medium text-[#2563EB] hover:text-[#1d4ed8]"
                  onClick={() => {
                    setPasswordResetMode(true);
                    setError(null);
                    setSuccessMessage(null);
                  }}
                >
                  {t("login.forgot")}
                </button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
              disabled={submitting || (!passwordResetMode && twoFactorRequired && otpCode.length < 6)}
            >
              {submitting
                ? t("login.submitting")
                : passwordResetMode
                  ? resetCodeSent ? "Reset Password" : "Send Reset Code"
                  : twoFactorRequired ? "Verify & Sign In" : t("login.submit")}
            </Button>
            {passwordResetMode && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setPasswordResetMode(false);
                  setResetCodeSent(false);
                  setError(null);
                  setSuccessMessage(null);
                }}
              >
                Back to Sign In
              </Button>
            )}
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
