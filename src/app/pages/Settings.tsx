import { useEffect, useState } from "react";
import { Save, Plus } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Switch } from "../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { authService, settingsService } from "../api/services";
import type { SettingsData } from "../api/types";
import { useApiQuery } from "../hooks/useApiQuery";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nContext";

type CompanyFormState = {
  name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  logoUrl: string;
  logoFile: File | null;
  defaultLanguage: "en" | "ar";
};

type CommunicationFormState = {
  mail_mailer: string;
  mail_host: string;
  mail_port: string;
  mail_username: string;
  mail_password: string;
  mail_encryption: string;
  mail_from_address: string;
  mail_from_name: string;
  sms_gateway_endpoint: string;
  sms_gateway_token: string;
  sms_gateway_timeout: string;
};

type BroadcastNotificationFormState = {
  title: string;
  body: string;
  type: "info" | "success" | "warning" | "error";
  includeSender: boolean;
};

const defaultCompanyFormState: CompanyFormState = {
  name: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  logoUrl: "",
  logoFile: null,
  defaultLanguage: "en",
};

const defaultNotificationPreferences: SettingsData["notifications"] = {
  leave_request_notifications: true,
  attendance_alerts: true,
  expense_approvals: true,
  payroll_reminders: false,
};

const defaultCommunicationFormState: CommunicationFormState = {
  mail_mailer: "",
  mail_host: "",
  mail_port: "",
  mail_username: "",
  mail_password: "",
  mail_encryption: "",
  mail_from_address: "",
  mail_from_name: "",
  sms_gateway_endpoint: "",
  sms_gateway_token: "",
  sms_gateway_timeout: "10",
};

const defaultBroadcastNotificationFormState: BroadcastNotificationFormState = {
  title: "",
  body: "",
  type: "info",
  includeSender: true,
};

const parsePromptNumber = (value: string | null): number | null => {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export function Settings() {
  const { refreshUser } = useAuth();
  const { setLanguage } = useI18n();
  const { data, loading, error, refetch } = useApiQuery(() => settingsService.getSettings(), []);
  const smtpUnavailableInProduction = import.meta.env.PROD;
  const [companyForm, setCompanyForm] = useState<CompanyFormState>(defaultCompanyFormState);
  const [notificationForm, setNotificationForm] = useState<SettingsData["notifications"]>(
    defaultNotificationPreferences,
  );
  const [communicationForm, setCommunicationForm] = useState<CommunicationFormState>(
    defaultCommunicationFormState,
  );
  const [companySaving, setCompanySaving] = useState(false);
  const [communicationSaving, setCommunicationSaving] = useState(false);
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [broadcastNotificationForm, setBroadcastNotificationForm] = useState<BroadcastNotificationFormState>(
    defaultBroadcastNotificationFormState,
  );
  const [broadcastNotificationSending, setBroadcastNotificationSending] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorSaving, setTwoFactorSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setCompanyForm({
      name: data.company.name ?? "",
      email: data.company.email ?? "",
      phone: data.company.phone ?? "",
      website: data.company.website ?? "",
      address: data.company.address ?? "",
      logoUrl: data.company.logo_url ?? "",
      logoFile: null,
      defaultLanguage: data.company.default_language ?? "en",
    });
    setCommunicationForm({
      mail_mailer: data.communications.mail_mailer ?? "",
      mail_host: data.communications.mail_host ?? "",
      mail_port: data.communications.mail_port != null ? String(data.communications.mail_port) : "",
      mail_username: data.communications.mail_username ?? "",
      mail_password: data.communications.mail_password ?? "",
      mail_encryption: data.communications.mail_encryption ?? "",
      mail_from_address: data.communications.mail_from_address ?? "",
      mail_from_name: data.communications.mail_from_name ?? "",
      sms_gateway_endpoint: data.communications.sms_gateway_endpoint ?? "",
      sms_gateway_token: data.communications.sms_gateway_token ?? "",
      sms_gateway_timeout: data.communications.sms_gateway_timeout != null
        ? String(data.communications.sms_gateway_timeout)
        : "10",
    });
    setNotificationForm(data.notifications);
  }, [data]);

  useEffect(() => {
    const loadTwoFactor = async () => {
      setTwoFactorLoading(true);
      try {
        const status = await authService.getTwoFactorStatus();
        setTwoFactorEnabled(status.enabled);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Failed to load security settings.");
      } finally {
        setTwoFactorLoading(false);
      }
    };

    void loadTwoFactor();
  }, []);

  const canManageSettings = data?.permissions.can_manage ?? false;
  const leaveTypes = data?.leave_types ?? [];
  const allowanceTypes = data?.payroll_settings.allowances ?? [];
  const deductionTypes = data?.payroll_settings.deductions ?? [];
  const holidays = data?.holidays ?? [];

  const runAction = async (runner: () => Promise<void>) => {
    setActionError(null);
    try {
      await runner();
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
    }
  };

  const handleSaveCompany = async () => {
    setCompanySaving(true);
    await runAction(async () => {
      await settingsService.updateCompany({
        company_name: companyForm.name.trim(),
        company_email: companyForm.email.trim() || undefined,
        company_phone: companyForm.phone.trim() || undefined,
        company_website: companyForm.website.trim() || undefined,
        company_address: companyForm.address.trim() || undefined,
        company_logo: companyForm.logoFile ?? undefined,
        default_language: companyForm.defaultLanguage,
      });
      setLanguage(companyForm.defaultLanguage);
      await refreshUser();
    });
    setCompanySaving(false);
  };

  const handleSaveNotifications = async () => {
    setNotificationSaving(true);
    await runAction(async () => settingsService.updateNotifications(notificationForm));
    setNotificationSaving(false);
  };

  const handleBroadcastNotification = async () => {
    if (!broadcastNotificationForm.title.trim()) {
      setActionError("Notification title is required.");
      return;
    }

    setBroadcastNotificationSending(true);
    await runAction(async () => {
      const result = await settingsService.broadcastNotification({
        title: broadcastNotificationForm.title.trim(),
        body: broadcastNotificationForm.body.trim() || undefined,
        type: broadcastNotificationForm.type,
        include_sender: broadcastNotificationForm.includeSender,
      });

      setBroadcastNotificationForm(defaultBroadcastNotificationFormState);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("corehr:notifications:refresh"));
      }
      window.alert(`Notification sent to ${result.delivered} users.`);
    });
    setBroadcastNotificationSending(false);
  };

  const handleSaveTwoFactor = async () => {
    setTwoFactorSaving(true);
    await runAction(async () => {
      const status = await authService.updateTwoFactor(twoFactorEnabled);
      setTwoFactorEnabled(status.enabled);
      await refreshUser();
    });
    setTwoFactorSaving(false);
  };

  const handleSaveCommunications = async () => {
    setCommunicationSaving(true);
    await runAction(async () => {
      const result = await settingsService.updateCommunications({
        mail_mailer: communicationForm.mail_mailer.trim() || null,
        mail_host: communicationForm.mail_host.trim() || null,
        mail_port: communicationForm.mail_port.trim() ? Number(communicationForm.mail_port.trim()) : null,
        mail_username: communicationForm.mail_username.trim() || null,
        mail_password: communicationForm.mail_password.trim() || null,
        mail_encryption: communicationForm.mail_encryption.trim() || null,
        mail_from_address: communicationForm.mail_from_address.trim() || null,
        mail_from_name: communicationForm.mail_from_name.trim() || null,
        sms_gateway_endpoint: communicationForm.sms_gateway_endpoint.trim() || null,
        sms_gateway_token: communicationForm.sms_gateway_token.trim() || null,
        sms_gateway_timeout: communicationForm.sms_gateway_timeout.trim()
          ? Number(communicationForm.sms_gateway_timeout.trim())
          : 10,
      });

      if (result.test_email?.status === "sent") {
        window.alert(`SMTP test email sent to ${result.test_email.recipient}.`);
      } else if (result.test_email?.status === "simulated") {
        window.alert("Email settings saved. Mail delivery is currently simulated.");
      } else if (result.test_email?.status === "failed") {
        window.alert(
          result.test_email.error
            ? `Email settings saved, but the SMTP test email failed: ${result.test_email.error}`
            : "Email settings saved, but the SMTP test email failed.",
        );
      }
    });
    setCommunicationSaving(false);
  };

  const handleUpsertLeaveType = async (item?: SettingsData["leave_types"][number]) => {
    const name = window.prompt("Leave type name", item?.name ?? "");
    if (!name) return;
    const days = parsePromptNumber(window.prompt("Annual days", String(item?.days ?? 0)));
    if (days === null) return window.alert("Invalid annual days value.");
    const carryOver = window.confirm("Allow carry over?");
    await runAction(async () => {
      if (item) {
        await settingsService.updateLeaveType(item.id, { name: name.trim(), days: Math.round(days), carry_over: carryOver });
      } else {
        await settingsService.createLeaveType({ name: name.trim(), days: Math.round(days), carry_over: carryOver });
      }
    });
  };

  const handleUpsertAllowance = async (item?: SettingsData["payroll_settings"]["allowances"][number]) => {
    const name = window.prompt("Allowance name", item?.name ?? "");
    if (!name) return;
    const amount = parsePromptNumber(window.prompt("Amount", String(item?.amount ?? 0)));
    if (amount === null) return window.alert("Invalid amount value.");
    await runAction(async () => {
      if (item) {
        await settingsService.updateAllowance(item.id, { name: name.trim(), amount });
      } else {
        await settingsService.createAllowance({ name: name.trim(), amount });
      }
    });
  };

  const handleUpsertDeduction = async (item?: SettingsData["payroll_settings"]["deductions"][number]) => {
    const name = window.prompt("Deduction name", item?.name ?? "");
    if (!name) return;
    const typeInput = window.prompt("Value type: amount or percentage", item?.percentage != null ? "percentage" : "amount");
    const valueType = typeInput === "percentage" ? "percentage" : typeInput === "amount" ? "amount" : null;
    if (!valueType) return window.alert("Invalid value type.");
    const existing = valueType === "percentage" ? item?.percentage : item?.amount;
    const value = parsePromptNumber(window.prompt("Value", String(existing ?? 0)));
    if (value === null) return window.alert("Invalid deduction value.");
    await runAction(async () => {
      if (item) {
        await settingsService.updateDeduction(item.id, { name: name.trim(), value_type: valueType, value });
      } else {
        await settingsService.createDeduction({ name: name.trim(), value_type: valueType, value });
      }
    });
  };

  const handleUpsertHoliday = async (item?: SettingsData["holidays"][number]) => {
    const name = window.prompt("Holiday name", item?.name ?? "");
    if (!name) return;
    const date = window.prompt("Date (YYYY-MM-DD)", item?.date_iso ?? "");
    if (!date) return;
    await runAction(async () => {
      if (item) {
        await settingsService.updateHoliday(item.id, { name: name.trim(), date });
      } else {
        await settingsService.createHoliday({ name: name.trim(), date });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage system configurations and preferences</p>
      </div>

      {(error || actionError) && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="text-red-600">{error ?? actionError}</div>
            <Button variant="outline" onClick={() => void refetch()}>Retry</Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="company" className="space-y-6">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="communications">Email & SMS</TabsTrigger>
          <TabsTrigger value="leave">Leave Types</TabsTrigger>
          <TabsTrigger value="payroll">Payroll Settings</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="company-logo">Company Logo</Label>
                  <div className="mt-2 flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                      {companyForm.logoUrl ? (
                        <img src={companyForm.logoUrl} alt="Company logo" className="h-full w-full object-contain" />
                      ) : (
                        <span className="text-xs font-semibold text-gray-400">No Logo</span>
                      )}
                    </div>
                    <Input
                      id="company-logo"
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.svg"
                      disabled={loading || !canManageSettings}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setCompanyForm((prev) => ({
                          ...prev,
                          logoFile: file,
                          logoUrl: file ? URL.createObjectURL(file) : prev.logoUrl,
                        }));
                      }}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="company-name">Company Name</Label>
                  <Input
                    id="company-name"
                    className="mt-2"
                    disabled={loading || !canManageSettings}
                    value={companyForm.name}
                    onChange={(event) => setCompanyForm((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="company-email">Company Email</Label>
                  <Input
                    id="company-email"
                    type="email"
                    className="mt-2"
                    disabled={loading || !canManageSettings}
                    value={companyForm.email}
                    onChange={(event) => setCompanyForm((prev) => ({ ...prev, email: event.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="company-phone">Phone Number</Label>
                  <Input
                    id="company-phone"
                    type="tel"
                    className="mt-2"
                    disabled={loading || !canManageSettings}
                    value={companyForm.phone}
                    onChange={(event) => setCompanyForm((prev) => ({ ...prev, phone: event.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="company-website">Website</Label>
                  <Input
                    id="company-website"
                    type="url"
                    className="mt-2"
                    disabled={loading || !canManageSettings}
                    value={companyForm.website}
                    onChange={(event) => setCompanyForm((prev) => ({ ...prev, website: event.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="company-language">Default Language</Label>
                  <Select
                    value={companyForm.defaultLanguage}
                    onValueChange={(value) =>
                      setCompanyForm((prev) => ({ ...prev, defaultLanguage: value as "en" | "ar" }))
                    }
                  >
                    <SelectTrigger id="company-language" className="mt-2" disabled={loading || !canManageSettings}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ar">Arabic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="company-address">Address</Label>
                <Input
                  id="company-address"
                  className="mt-2"
                  disabled={loading || !canManageSettings}
                  value={companyForm.address}
                  onChange={(event) => setCompanyForm((prev) => ({ ...prev, address: event.target.value }))}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                  disabled={loading || companySaving || !canManageSettings}
                  onClick={() => void handleSaveCompany()}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {companySaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Account Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">Two-Factor Authentication (2FA)</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Require a 6-digit email verification code during login.
                  </div>
                </div>
                <Switch
                  checked={twoFactorEnabled}
                  disabled={twoFactorLoading || twoFactorSaving}
                  onCheckedChange={(checked) => setTwoFactorEnabled(checked)}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                  disabled={twoFactorLoading || twoFactorSaving}
                  onClick={() => void handleSaveTwoFactor()}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {twoFactorSaving ? "Saving..." : "Save Security"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communications" className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Email & SMS Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900">Email (SMTP)</h3>
                {smtpUnavailableInProduction && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    SMTP email delivery is not working in production mode on the current hosting environment.
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="mail-mailer">Mailer</Label>
                    <Input id="mail-mailer" className="mt-2" placeholder="smtp / log" disabled={loading || !canManageSettings} value={communicationForm.mail_mailer} onChange={(event) => setCommunicationForm((prev) => ({ ...prev, mail_mailer: event.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="mail-host">SMTP Host</Label>
                    <Input id="mail-host" className="mt-2" placeholder="smtp.mailtrap.io" disabled={loading || !canManageSettings} value={communicationForm.mail_host} onChange={(event) => setCommunicationForm((prev) => ({ ...prev, mail_host: event.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="mail-port">SMTP Port</Label>
                    <Input id="mail-port" type="number" className="mt-2" placeholder="587" disabled={loading || !canManageSettings} value={communicationForm.mail_port} onChange={(event) => setCommunicationForm((prev) => ({ ...prev, mail_port: event.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="mail-encryption">Encryption</Label>
                    <Input id="mail-encryption" className="mt-2" placeholder="tls / ssl / none" disabled={loading || !canManageSettings} value={communicationForm.mail_encryption} onChange={(event) => setCommunicationForm((prev) => ({ ...prev, mail_encryption: event.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="mail-username">Username</Label>
                    <Input id="mail-username" className="mt-2" disabled={loading || !canManageSettings} value={communicationForm.mail_username} onChange={(event) => setCommunicationForm((prev) => ({ ...prev, mail_username: event.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="mail-password">Password</Label>
                    <Input id="mail-password" type="password" className="mt-2" disabled={loading || !canManageSettings} value={communicationForm.mail_password} onChange={(event) => setCommunicationForm((prev) => ({ ...prev, mail_password: event.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="mail-from-address">From Address</Label>
                    <Input id="mail-from-address" type="email" className="mt-2" disabled={loading || !canManageSettings} value={communicationForm.mail_from_address} onChange={(event) => setCommunicationForm((prev) => ({ ...prev, mail_from_address: event.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="mail-from-name">From Name</Label>
                    <Input id="mail-from-name" className="mt-2" disabled={loading || !canManageSettings} value={communicationForm.mail_from_name} onChange={(event) => setCommunicationForm((prev) => ({ ...prev, mail_from_name: event.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">SMS Gateway</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sms-endpoint">Gateway Endpoint</Label>
                    <Input id="sms-endpoint" className="mt-2" placeholder="https://api.sms-provider.com/send" disabled={loading || !canManageSettings} value={communicationForm.sms_gateway_endpoint} onChange={(event) => setCommunicationForm((prev) => ({ ...prev, sms_gateway_endpoint: event.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="sms-timeout">Timeout (seconds)</Label>
                    <Input id="sms-timeout" type="number" className="mt-2" disabled={loading || !canManageSettings} value={communicationForm.sms_gateway_timeout} onChange={(event) => setCommunicationForm((prev) => ({ ...prev, sms_gateway_timeout: event.target.value }))} />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="sms-token">Gateway Token</Label>
                    <Input id="sms-token" type="password" className="mt-2" disabled={loading || !canManageSettings} value={communicationForm.sms_gateway_token} onChange={(event) => setCommunicationForm((prev) => ({ ...prev, sms_gateway_token: event.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white" disabled={loading || communicationSaving || !canManageSettings} onClick={() => void handleSaveCommunications()}>
                  <Save className="w-4 h-4 mr-2" />
                  {communicationSaving ? "Saving..." : "Save Communication Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leave" className="space-y-6"><Card className="border-0 shadow-sm"><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Leave Types</CardTitle><Button variant="outline" disabled={!canManageSettings} onClick={() => void handleUpsertLeaveType()}><Plus className="w-4 h-4 mr-2" />Add Leave Type</Button></CardHeader><CardContent>{loading && <div className="text-sm text-gray-500">Loading leave types...</div>}{!loading && leaveTypes.length === 0 && <div className="text-sm text-gray-500">No leave types found.</div>}{!loading && leaveTypes.length > 0 && (<Table><TableHeader><TableRow><TableHead>Leave Type</TableHead><TableHead>Annual Days</TableHead><TableHead>Carry Over</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{leaveTypes.map((type) => (<TableRow key={type.id}><TableCell className="font-medium text-gray-900">{type.name}</TableCell><TableCell className="text-gray-700">{type.days} days</TableCell><TableCell><Badge className={type.carry_over ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"} variant="secondary">{type.carry_over ? "Yes" : "No"}</Badge></TableCell><TableCell><Button variant="outline" size="sm" disabled={!canManageSettings} onClick={() => void handleUpsertLeaveType(type)}>Edit</Button></TableCell></TableRow>))}</TableBody></Table>)}</CardContent></Card></TabsContent>

        <TabsContent value="payroll" className="space-y-6"><Card className="border-0 shadow-sm"><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Allowance Types</CardTitle><Button variant="outline" disabled={!canManageSettings} onClick={() => void handleUpsertAllowance()}><Plus className="w-4 h-4 mr-2" />Add Allowance</Button></CardHeader><CardContent>{loading && <div className="text-sm text-gray-500">Loading allowance types...</div>}{!loading && allowanceTypes.length === 0 && <div className="text-sm text-gray-500">No allowance types found.</div>}{!loading && allowanceTypes.length > 0 && (<Table><TableHeader><TableRow><TableHead>Allowance Type</TableHead><TableHead>Amount</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{allowanceTypes.map((type) => (<TableRow key={type.id}><TableCell className="font-medium text-gray-900">{type.name}</TableCell><TableCell className="text-gray-700">${type.amount}</TableCell><TableCell><Button variant="outline" size="sm" disabled={!canManageSettings} onClick={() => void handleUpsertAllowance(type)}>Edit</Button></TableCell></TableRow>))}</TableBody></Table>)}</CardContent></Card><Card className="border-0 shadow-sm"><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Deduction Types</CardTitle><Button variant="outline" disabled={!canManageSettings} onClick={() => void handleUpsertDeduction()}><Plus className="w-4 h-4 mr-2" />Add Deduction</Button></CardHeader><CardContent>{loading && <div className="text-sm text-gray-500">Loading deduction types...</div>}{!loading && deductionTypes.length === 0 && <div className="text-sm text-gray-500">No deduction types found.</div>}{!loading && deductionTypes.length > 0 && (<Table><TableHeader><TableRow><TableHead>Deduction Type</TableHead><TableHead>Value</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{deductionTypes.map((type) => (<TableRow key={type.id}><TableCell className="font-medium text-gray-900">{type.name}</TableCell><TableCell className="text-gray-700">{type.percentage != null ? `${type.percentage}%` : `$${type.amount ?? 0}`}</TableCell><TableCell><Button variant="outline" size="sm" disabled={!canManageSettings} onClick={() => void handleUpsertDeduction(type)}>Edit</Button></TableCell></TableRow>))}</TableBody></Table>)}</CardContent></Card></TabsContent>

        <TabsContent value="holidays" className="space-y-6"><Card className="border-0 shadow-sm"><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Holiday Calendar</CardTitle><Button variant="outline" disabled={!canManageSettings} onClick={() => void handleUpsertHoliday()}><Plus className="w-4 h-4 mr-2" />Add Holiday</Button></CardHeader><CardContent>{loading && <div className="text-sm text-gray-500">Loading holidays...</div>}{!loading && holidays.length === 0 && <div className="text-sm text-gray-500">No holidays found.</div>}{!loading && holidays.length > 0 && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{holidays.map((holiday) => (<div key={holiday.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"><div><div className="font-medium text-gray-900">{holiday.name}</div><div className="text-sm text-gray-600 mt-1">{holiday.date}</div></div><Button variant="outline" size="sm" disabled={!canManageSettings} onClick={() => void handleUpsertHoliday(holiday)}>Edit</Button></div>))}</div>}</CardContent></Card></TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">Leave Request Notifications</div>
                  <div className="text-sm text-gray-600 mt-1">Get notified when employees submit leave requests</div>
                </div>
                <Switch
                  checked={notificationForm.leave_request_notifications}
                  disabled={loading || !canManageSettings}
                  onCheckedChange={(checked) => setNotificationForm((prev) => ({ ...prev, leave_request_notifications: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">Attendance Alerts</div>
                  <div className="text-sm text-gray-600 mt-1">Receive alerts for late arrivals and absences</div>
                </div>
                <Switch
                  checked={notificationForm.attendance_alerts}
                  disabled={loading || !canManageSettings}
                  onCheckedChange={(checked) => setNotificationForm((prev) => ({ ...prev, attendance_alerts: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">Expense Approvals</div>
                  <div className="text-sm text-gray-600 mt-1">Get notified about pending expense approvals</div>
                </div>
                <Switch
                  checked={notificationForm.expense_approvals}
                  disabled={loading || !canManageSettings}
                  onCheckedChange={(checked) => setNotificationForm((prev) => ({ ...prev, expense_approvals: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">Payroll Reminders</div>
                  <div className="text-sm text-gray-600 mt-1">Reminders for payroll processing deadlines</div>
                </div>
                <Switch
                  checked={notificationForm.payroll_reminders}
                  disabled={loading || !canManageSettings}
                  onCheckedChange={(checked) => setNotificationForm((prev) => ({ ...prev, payroll_reminders: checked }))}
                />
              </div>
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <Button
                  className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                  disabled={loading || notificationSaving || !canManageSettings}
                  onClick={() => void handleSaveNotifications()}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {notificationSaving ? "Saving..." : "Save Preferences"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Send Notification To Everyone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="broadcast-title">Title</Label>
                <Input
                  id="broadcast-title"
                  className="mt-2"
                  disabled={loading || !canManageSettings || broadcastNotificationSending}
                  value={broadcastNotificationForm.title}
                  onChange={(event) =>
                    setBroadcastNotificationForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="broadcast-body">Message</Label>
                <Textarea
                  id="broadcast-body"
                  className="mt-2"
                  rows={4}
                  disabled={loading || !canManageSettings || broadcastNotificationSending}
                  value={broadcastNotificationForm.body}
                  onChange={(event) =>
                    setBroadcastNotificationForm((prev) => ({ ...prev, body: event.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="broadcast-type">Type</Label>
                  <Select
                    value={broadcastNotificationForm.type}
                    onValueChange={(value) =>
                      setBroadcastNotificationForm((prev) => ({
                        ...prev,
                        type: value as BroadcastNotificationFormState["type"],
                      }))
                    }
                    disabled={loading || !canManageSettings || broadcastNotificationSending}
                  >
                    <SelectTrigger id="broadcast-type" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 mt-6 md:mt-0">
                  <div>
                    <div className="font-medium text-gray-900">Include Me</div>
                    <div className="text-sm text-gray-600">Receive this announcement too</div>
                  </div>
                  <Switch
                    checked={broadcastNotificationForm.includeSender}
                    disabled={loading || !canManageSettings || broadcastNotificationSending}
                    onCheckedChange={(checked) =>
                      setBroadcastNotificationForm((prev) => ({ ...prev, includeSender: checked }))
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                  disabled={loading || !canManageSettings || broadcastNotificationSending}
                  onClick={() => void handleBroadcastNotification()}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {broadcastNotificationSending ? "Sending..." : "Send To Everyone"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
