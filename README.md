
# SaaS HR System

CoreHR is a comprehensive web-based Human Resources Management System designed for modern enterprises. Built with a React/TypeScript frontend and Laravel backend, it provides employee management, payroll processing, leave management, recruitment, and advanced HR analytics.

**Design Reference:**

---

## 🚀 Features

- **Employee Management** - Comprehensive employee profiles, documents, and asset tracking
- **Payroll Management** - Automated payroll processing with allowances and deductions
- **Leave Management** - Leave request workflows with balance tracking
- **Recruitment** - Job posting, candidate management, and application tracking
- **Expense Management** - Employee expense claims with approval workflows
- **Loan Management** - Loan request processing and tracking
- **Performance Reviews** - Employee evaluation and feedback system
- **Training & Development** - Training program enrollment and material management
- **Attendance Tracking** - Real-time attendance and analytics
- **Two-Factor Authentication** - Email OTP-based 2FA for enhanced security
- **AI HR Assistant** - Rule-based or OpenAI-powered chatbot for HR queries
- **Multi-branch Support** - Manage multiple organizational branches
- **Email & SMS Notifications** - Automated messaging for key HR events
- **Role-Based Access Control** - Fine-grained permission management

---

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** - Lightning fast build tool
- **Tailwind CSS** - Utility-first styling
- **ShadCN/UI** - Accessible component library
- **TanStack Query** - Server state management
- **React Router** - Client-side routing

### Backend
- **Laravel 11** - PHP web framework
- **Laravel Sanctum** - API authentication
- **MySQL** - Relational database
- **Laravel Queue** - Async job processing
- **Laravel Mail** - Email notifications

---

## 📋 Prerequisites

- **Node.js** 18+ (for frontend)
- **PHP** 8.2+ (for backend)
- **Composer** (PHP dependency manager)
- **MySQL** 8.0+ (or compatible)
- **Git**

---

## 🚀 Quick Start

### 1. Install Frontend Dependencies
```bash
npm install
```

### 2. Install Backend Dependencies
```bash
cd backend
composer install
cd ..
```

### 3. Configure Environment
Copy the example environment files:
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your configuration (database, mail, etc.)

### 4. Generate Laravel Key
```bash
cd backend
php artisan key:generate
cd ..
```

### 5. Run Migrations
```bash
cd backend
php artisan migrate
cd ..
```

### 6. Start Development Server
```bash
# Frontend (runs on http://localhost:5173)
npm run dev
```

In a new terminal:
```bash
# Backend (runs on http://localhost:8000)
cd backend
php artisan serve
```

---

## ⚙️ Configuration

### Backend Messaging (Email & SMS)

The backend sends notifications during recruitment, leave requests, expense claims, and loan workflows.

#### Email Configuration
Configure in `backend/.env`:
```env
MAIL_MAILER=smtp
MAIL_HOST=smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USERNAME=your_username
MAIL_PASSWORD=your_password
MAIL_FROM_ADDRESS=noreply@corehr.app
MAIL_FROM_NAME="CoreHR System"
```

#### SMS Configuration (Optional)
Configure in `backend/.env`:
```env
SMS_GATEWAY_ENDPOINT=https://your-sms-provider.com/api/send
SMS_GATEWAY_TOKEN=your_api_token
SMS_GATEWAY_TIMEOUT=30
```

If `SMS_GATEWAY_ENDPOINT` is empty, SMS messages are simulated and logged by Laravel.

### Two-Factor Authentication

Two-factor authentication (email OTP) can be enabled per user:
1. Login to the application
2. Navigate to **Settings → Security**
3. Toggle **Enable Two-Factor Authentication**
4. Follow the email verification process

### AI HR Assistant (Optional OpenAI)

The HR Assistant uses rule-based responses by default. To enable OpenAI integration:

Configure in `backend/.env`:
```env
OPENAI_API_KEY=sk-your-api-key
OPENAI_MODEL=gpt-4o-mini
```

Supported models: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`

---

## 📚 Deployment Guides

- **[Backend Deployment (Render)](./RENDER_DEPLOYMENT_CHECKLIST.md)** - Complete Render setup guide
- **[Frontend Deployment (Vercel)](./VERCEL_DEPLOYMENT_GUIDE.md)** - Complete Vercel setup guide
- **[Environment Configuration](./DEPLOYMENT_ENV_GUIDE.md)** - Detailed environment variable reference
- **[CSRF Token & Cross-Domain Setup](./CSRF_FIX_SUMMARY.md)** - CORS and session configuration

---

## 🔧 Development Commands

### Frontend
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview       # Preview production build
npm run lint         # Run ESLint
```

### Backend
```bash
cd backend

# Migrations
php artisan migrate              # Run migrations
php artisan migrate:rollback     # Rollback migrations
php artisan migrate:reset        # Reset all migrations

# Tinker (interactive shell)
php artisan tinker

# Clear caches
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear

# Database seeding
php artisan seed:run
php artisan db:seed --class=EmployeeSeeder
```

---

## 🗂️ Project Structure

```
CoreHR/
├── src/                          # Frontend (React + TypeScript)
│   ├── app/
│   │   ├── api/                  # API client & services
│   │   ├── auth/                 # Authentication logic
│   │   ├── components/           # Reusable React components
│   │   ├── hooks/                # Custom React hooks
│   │   ├── pages/                # Page components
│   │   └── utils/                # Utility functions
│   ├── styles/                   # Global styles & Tailwind
│   └── main.tsx                  # Application entry point
│
├── backend/                       # Backend (Laravel)
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/      # API controllers
│   │   │   ├── Middleware/       # Custom middleware
│   │   │   └── Requests/         # Form request validation
│   │   ├── Models/               # Database models
│   │   └── Services/             # Business logic services
│   ├── config/                   # Configuration files
│   ├── database/
│   │   ├── migrations/           # Database migrations
│   │   └── seeders/              # Database seeders
│   ├── routes/
│   │   ├── api.php               # API routes
│   │   └── web.php               # Web routes
│   └── storage/                  # Logs, sessions, uploads
│
├── public/
│   ├── templates/                # CSV import templates
│   └── storage/                  # Public file storage
│
├── vite.config.ts                # Vite configuration
├── tailwind.config.js            # Tailwind configuration
├── package.json                  # Frontend dependencies
└── README.md                      # This file
```

---

## 🐞 Troubleshooting

### CSRF Token Mismatch
If you encounter "CSRF token mismatch" errors during cross-domain requests:
- See [CSRF_FIX_SUMMARY.md](./CSRF_FIX_SUMMARY.md)
- Check [QUICK_TROUBLESHOOTING.md](./QUICK_TROUBLESHOOTING.md)

### Login Returns 419 Error
This is typically a session/CSRF validation issue:
- See [FIX_419_LOGIN_ERROR.md](./FIX_419_LOGIN_ERROR.md)

### Database Connection Issues
1. Verify database credentials in `backend/.env`
2. Test connection: `cd backend && php artisan db:show`
3. Check database server is running

### Frontend Build Fails
1. Clear node_modules: `rm -rf node_modules && npm install`
2. Clear Vite cache: `rm -rf .vite`
3. Check Node.js version: `node --version` (needs 18+)

---

## 📖 API Documentation

The backend provides a RESTful API with the following main endpoints:

### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/me` - Get current user

### Employees
- `GET /api/employees` - List employees
- `POST /api/employees` - Create employee
- `GET /api/employees/{id}` - Get employee details
- `PATCH /api/employees/{id}` - Update employee

### Payroll
- `GET /api/payroll` - List payroll records
- `POST /api/payroll` - Generate payroll
- `GET /api/payroll/{id}` - Get payroll details

### Leave Management
- `GET /api/leave-requests` - List leave requests
- `POST /api/leave-requests` - Create leave request
- `PATCH /api/leave-requests/{id}/approve` - Approve leave
- `PATCH /api/leave-requests/{id}/reject` - Reject leave

### Recruitment
- `GET /api/recruitment/jobs` - List job postings
- `POST /api/recruitment/jobs` - Create job posting
- `POST /api/recruitment/apply` - Apply for position
- `GET /api/recruitment/candidates` - List candidates

### Other
- Complete API documentation available in backend routes: `backend/routes/api.php`

---

## 🔐 Security

- **CORS Enabled** - Configured for cross-origin requests from frontend
- **CSRF Protection** - Laravel CSRF tokens on all state-changing requests
- **Sanctum Authentication** - Stateful API authentication
- **Password Hashing** - Bcrypt password hashing with 12 rounds
- **Two-Factor Authentication** - Optional email OTP-based 2FA
- **Role-Based Access Control** - Permission system for features

---

## 📄 License

This project is provided as-is for educational and commercial use.

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -am 'Add your feature'`
3. Push to branch: `git push origin feature/your-feature`
4. Submit a pull request

---

## 💬 Support

For issues, questions, or contribution ideas:
- Check existing documentation in the root directory
- Review troubleshooting guides
- Check Render/Vercel deployment logs for detailed error messages

---

**Last Updated:** March 2026  
**Version:** 1.0.0
