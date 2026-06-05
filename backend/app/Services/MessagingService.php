<?php

namespace App\Services;

use App\Models\CompanySetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class MessagingService
{
    private ?CompanySetting $companySettingCache = null;

    /**
     * @return array{channel:string,status:string,meta:array<string,mixed>}
     */
    public function send(
        string $channel,
        ?string $email,
        ?string $phone,
        string $subject,
        string $message,
        array $context = [],
    ): array {
        $normalizedChannel = strtolower(trim($channel));

        return match ($normalizedChannel) {
            'email' => $this->sendEmail($email, $subject, $message, $context),
            'sms' => $this->sendSms($phone, $message, $context),
            default => [
                'channel' => $normalizedChannel,
                'status' => 'failed',
                'meta' => [
                    'error' => 'Unsupported communication channel.',
                ],
            ],
        };
    }

    /**
     * Attempt channels in order and stop at first successful/simulated delivery.
     *
     * @param  array<int, string>  $channels
     * @return array{channel:string,status:string,meta:array<string,mixed>}
     */
    public function sendPreferred(
        ?string $email,
        ?string $phone,
        string $subject,
        string $message,
        array $channels = ['email', 'sms'],
        array $context = [],
    ): array {
        $queue = $this->normalizeChannels($channels);
        if ($queue === []) {
            $queue = ['email', 'sms'];
        }

        $last = [
            'channel' => $queue[0],
            'status' => 'skipped',
            'meta' => [
                'error' => 'No channel was attempted.',
            ],
        ];

        foreach ($queue as $channel) {
            $result = $this->send(
                $channel,
                $email,
                $phone,
                $subject,
                $message,
                $context,
            );
            $last = $result;

            if (in_array($result['status'], ['sent', 'simulated'], true)) {
                return $result;
            }
        }

        return $last;
    }

    /**
     * @return array{channel:string,status:string,meta:array<string,mixed>}
     */
    private function sendEmail(?string $email, string $subject, string $message, array $context = []): array
    {
        $to = trim((string) $email);
        if ($to === '') {
            return [
                'channel' => 'email',
                'status' => 'skipped',
                'meta' => [
                    'error' => 'Recipient email is not available.',
                ],
            ];
        }

        $emailConfig = $this->resolveEmailConfig();
        if ($emailConfig['mailer'] === 'smtp' && $emailConfig['host'] === '') {
            Log::warning('Email dispatch skipped because SMTP host is missing.', [
                'to' => $to,
                'subject' => $subject,
                'context' => $context,
            ]);

            return [
                'channel' => 'email',
                'status' => 'failed',
                'meta' => [
                    'error' => 'SMTP host is not configured.',
                ],
            ];
        }

        if ($emailConfig['mailer'] === 'smtp' && $emailConfig['from_address'] === '') {
            Log::warning('Email dispatch skipped because SMTP from address is missing.', [
                'to' => $to,
                'subject' => $subject,
                'context' => $context,
            ]);

            return [
                'channel' => 'email',
                'status' => 'failed',
                'meta' => [
                    'error' => 'SMTP from address is not configured.',
                ],
            ];
        }

        $this->applyDynamicMailConfig($emailConfig);
        $emailBody = $this->composeEmailBody($message, $context);
        $attachments = $this->normalizeEmailAttachments($context['attachments'] ?? []);

        try {
            Mail::mailer($emailConfig['mailer'])->raw($emailBody, function ($mail) use ($to, $subject, $emailConfig, $attachments): void {
                $mail->to($to)->subject($subject);

                if ($emailConfig['from_address'] !== '') {
                    $mail->from(
                        $emailConfig['from_address'],
                        $emailConfig['from_name'] !== '' ? $emailConfig['from_name'] : null,
                    );
                }

                foreach ($attachments as $attachment) {
                    $options = [];
                    if (($attachment['name'] ?? '') !== '') {
                        $options['as'] = (string) $attachment['name'];
                    }
                    if (($attachment['mime'] ?? '') !== '') {
                        $options['mime'] = (string) $attachment['mime'];
                    }

                    if ($options === []) {
                        $mail->attach((string) $attachment['path']);
                    } else {
                        $mail->attach((string) $attachment['path'], $options);
                    }
                }
            });

            return [
                'channel' => 'email',
                'status' => 'sent',
                'meta' => [],
            ];
        } catch (\Throwable $exception) {
            Log::warning('Email dispatch failed.', [
                'to' => $to,
                'subject' => $subject,
                'error' => $exception->getMessage(),
                'context' => $context,
            ]);

            return [
                'channel' => 'email',
                'status' => 'failed',
                'meta' => [
                    'error' => $exception->getMessage(),
                ],
            ];
        }
    }

    /**
     * @return array{channel:string,status:string,meta:array<string,mixed>}
     */
    private function sendSms(?string $phone, string $message, array $context = []): array
    {
        $to = trim((string) $phone);
        if ($to === '') {
            return [
                'channel' => 'sms',
                'status' => 'skipped',
                'meta' => [
                    'error' => 'Recipient phone is not available.',
                ],
            ];
        }

        $smsConfig = $this->resolveSmsConfig();
        $smsEndpoint = $smsConfig['endpoint'];
        $smsToken = $smsConfig['token'];
        $timeoutSeconds = $smsConfig['timeout'];

        if ($smsEndpoint === '') {
            Log::info('Simulated SMS dispatch', [
                'to' => $to,
                'message' => $message,
                'context' => $context,
            ]);

            return [
                'channel' => 'sms',
                'status' => 'simulated',
                'meta' => [],
            ];
        }

        try {
            $request = Http::timeout($timeoutSeconds)->acceptJson();
            if ($smsToken !== '') {
                $request = $request->withToken($smsToken);
            }

            $response = $request->post($smsEndpoint, [
                'to' => $to,
                'message' => $message,
            ]);

            return [
                'channel' => 'sms',
                'status' => $response->successful() ? 'sent' : 'failed',
                'meta' => [
                    'provider_status' => $response->status(),
                ],
            ];
        } catch (\Throwable $exception) {
            Log::warning('SMS dispatch failed.', [
                'to' => $to,
                'error' => $exception->getMessage(),
                'context' => $context,
            ]);

            return [
                'channel' => 'sms',
                'status' => 'failed',
                'meta' => [
                    'error' => $exception->getMessage(),
                ],
            ];
        }
    }

    /**
     * @return array{mailer:string,host:string,port:int,timeout:int,username:string,password:string,encryption:?string,from_address:string,from_name:string}
     */
    private function resolveEmailConfig(): array
    {
        $settings = $this->getCompanySettings();

        $mailer = $this->resolveMailerName((string) ($settings?->mail_mailer ?? config('mail.default', 'log')));

        $encryption = strtolower(trim((string) ($settings?->mail_encryption ?? config('mail.mailers.smtp.encryption', ''))));
        if ($encryption === '' || $encryption === 'none') {
            $encryption = null;
        }

        $host = trim((string) ($settings?->mail_host ?? ''));
        if ($host === '') {
            $host = trim((string) config('mail.mailers.smtp.host', ''));
        }

        $port = (int) ($settings?->mail_port ?? config('mail.mailers.smtp.port', 587));
        if ($port < 1) {
            $port = 587;
        }

        $timeout = (int) config('mail.mailers.smtp.timeout', 10);
        if ($timeout < 1) {
            $timeout = 10;
        }

        return [
            'mailer' => $mailer,
            'host' => $host,
            'port' => $port,
            'timeout' => $timeout,
            'username' => trim((string) ($settings?->mail_username ?? config('mail.mailers.smtp.username', ''))),
            'password' => trim((string) ($settings?->mail_password ?? config('mail.mailers.smtp.password', ''))),
            'encryption' => $encryption,
            'from_address' => trim((string) ($settings?->mail_from_address ?? config('mail.from.address', ''))),
            'from_name' => trim((string) ($settings?->mail_from_name ?? config('mail.from.name', ''))),
        ];
    }

    /**
     * @param  array{mailer:string,host:string,port:int,timeout:int,username:string,password:string,encryption:?string,from_address:string,from_name:string}  $emailConfig
     */
    private function applyDynamicMailConfig(array $emailConfig): void
    {
        config([
            'mail.default' => $emailConfig['mailer'],
            'mail.mailers.smtp.host' => $emailConfig['host'],
            'mail.mailers.smtp.port' => $emailConfig['port'],
            'mail.mailers.smtp.timeout' => $emailConfig['timeout'],
            'mail.mailers.smtp.username' => $emailConfig['username'] !== '' ? $emailConfig['username'] : null,
            'mail.mailers.smtp.password' => $emailConfig['password'] !== '' ? $emailConfig['password'] : null,
            'mail.mailers.smtp.encryption' => $emailConfig['encryption'],
            'mail.from.address' => $emailConfig['from_address'] !== '' ? $emailConfig['from_address'] : config('mail.from.address'),
            'mail.from.name' => $emailConfig['from_name'] !== '' ? $emailConfig['from_name'] : config('mail.from.name'),
        ]);

        $mailManager = app('mail.manager');
        if (method_exists($mailManager, 'forgetMailers')) {
            $mailManager->forgetMailers();
        }
    }

    /**
     * @return array{endpoint:string,token:string,timeout:int}
     */
    private function resolveSmsConfig(): array
    {
        $settings = $this->getCompanySettings();

        return [
            'endpoint' => trim((string) ($settings?->sms_gateway_endpoint ?? config('services.sms.endpoint', ''))),
            'token' => trim((string) ($settings?->sms_gateway_token ?? config('services.sms.token', ''))),
            'timeout' => max((int) ($settings?->sms_gateway_timeout ?? config('services.sms.timeout', 10)), 1),
        ];
    }

    private function getCompanySettings(): ?CompanySetting
    {
        if ($this->companySettingCache !== null) {
            return $this->companySettingCache;
        }

        $this->companySettingCache = CompanySetting::query()->first();

        return $this->companySettingCache;
    }

    private function resolveMailerName(string $mailer): string
    {
        $normalized = strtolower(trim($mailer));
        if ($normalized === '') {
            $normalized = strtolower((string) config('mail.default', 'log'));
        }

        $configuredMailers = config('mail.mailers', []);
        if (! is_array($configuredMailers) || ! array_key_exists($normalized, $configuredMailers)) {
            return 'log';
        }

        return $normalized;
    }

    /**
     * @param  array<int, string>  $channels
     * @return array<int, string>
     */
    private function normalizeChannels(array $channels): array
    {
        $normalized = [];

        foreach ($channels as $channel) {
            $value = strtolower(trim((string) $channel));
            if (! in_array($value, ['email', 'sms'], true)) {
                continue;
            }

            if (! in_array($value, $normalized, true)) {
                $normalized[] = $value;
            }
        }

        return $normalized;
    }

    /**
     * @return array<int, array{path:string,name:?string,mime:?string}>
     */
    private function normalizeEmailAttachments(mixed $attachments): array
    {
        if (! is_array($attachments)) {
            return [];
        }

        $normalized = [];

        foreach ($attachments as $attachment) {
            if (! is_array($attachment)) {
                continue;
            }

            $path = trim((string) ($attachment['path'] ?? ''));
            if ($path === '' || ! is_file($path)) {
                continue;
            }

            $name = trim((string) ($attachment['name'] ?? ''));
            if ($name === '') {
                $name = basename($path);
            }

            $mime = trim((string) ($attachment['mime'] ?? ''));

            $normalized[] = [
                'path' => $path,
                'name' => $name !== '' ? $name : null,
                'mime' => $mime !== '' ? $mime : null,
            ];
        }

        return $normalized;
    }

    private function composeEmailBody(string $message, array $context = []): string
    {
        $companyName = trim((string) ($this->getCompanySettings()?->company_name ?? config('app.name', 'CoreHR')));
        if ($companyName === '') {
            $companyName = 'CoreHR';
        }

        $cleanMessage = trim($message);
        $startsWithGreeting = preg_match('/^(hi|hello|dear)\b/i', $cleanMessage) === 1;

        $lines = [];
        if (! $startsWithGreeting) {
            $lines[] = 'Hello,';
            $lines[] = '';
        }

        $lines[] = $cleanMessage;
        $lines[] = '';
        $lines[] = '---';
        $lines[] = 'This is an automated notification from '.$companyName.'.';
        $lines[] = "don't reply to this email";
        $lines[] = 'Generated at: '.now()->format('F d, Y h:i A');
        if (isset($context['scope']) && trim((string) $context['scope']) !== '') {
            $lines[] = 'Reference: '.strtoupper((string) $context['scope']);
        }
        $lines[] = '';
        $lines[] = 'Regards,';
        $lines[] = $companyName.' HR Team';

        return implode("\n", $lines);
    }
}
