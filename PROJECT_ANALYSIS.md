# Sandbox Platform - Comprehensive Analysis

## 1. What Is It?

**Sandbox Platform** is a Docker-based isolated development environment platform that provides users with secure, containerized workspaces accessible through a web browser. It combines:

- **Web-based Terminal**: Full shell access via xterm.js over WebSocket
- **Multi-runtime Support**: Node.js, Python, Java, Go, Rust, PHP, Ruby, .NET
- **Admin Dashboard**: Complete system monitoring and user management
- **Security-first Architecture**: Multi-layered security with command filtering, network isolation, and container hardening

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16.1.3, React 19, TypeScript |
| UI | shadcn/ui + Tailwind CSS v4 |
| Database | SQLite + Drizzle ORM |
| Containers | Docker (dockerode) |
| Auth | Better Auth (Google, GitHub OAuth) |
| Real-time | WebSocket (xterm.js), SSE |
| Notifications | Telegram Bot |

---

## 2. Why? (Purpose & Motivation)

### Problem Solved

1. **Isolated Development Environments**: Users need sandboxed environments without affecting host systems
2. **Security Concerns**: Running untrusted code requires strict isolation
3. **Resource Management**: Prevent resource abuse with CPU/memory/disk limits
4. **Internet Control**: Granular control over outbound network access
5. **Multi-tenant Platform**: Multiple users sharing infrastructure safely

### Target Scenarios

- Educational platforms for coding exercises
- Code interview/assessment platforms
- Development playgrounds
- CI/CD testing environments
- Secure experimentation spaces

---

## 3. Benefits

### For Users

| Benefit | Description |
|---------|-------------|
| **Zero Setup** | Pre-configured environments ready instantly |
| **Multiple Languages** | Support for 8+ runtimes with version selection |
| **Browser-based** | No local installation required |
| **File Management** | Upload, download, browse, archive files |
| **Port Exposure** | Expose services via global routing (`/s/<serviceName>`) |
| **Scheduling** | Automated start/stop for cost optimization |

### For Administrators

| Benefit | Description |
|---------|-------------|
| **Complete Visibility** | Monitor all containers, commands, and resources |
| **Security Monitoring** | Real-time alerts for suspicious activities |
| **Granular Control** | Approve/deny internet access, manage bans |
| **Audit Trail** | Full logging of actions for compliance |
| **Telegram Integration** | Instant notifications for admin actions |
| **Configurable Limits** | Adjust resources, rules, and thresholds |

### For Organizations

- **Cost Control**: Resource limits prevent abuse
- **Compliance**: Comprehensive audit logging
- **Scalability**: Docker-based architecture scales horizontally
- **Customization**: Configurable settings and terminology

---

## 4. Use Cases

### 4.1 Coding Education Platform

```
Students → Create sandbox → Write/run code → Submit assignments
Teachers → Monitor activity → Review submissions → Manage access
```

### 4.2 Technical Interview Platform

```
Candidates → Access pre-configured environment → Solve problems
Interviewers → Monitor in real-time → Review command history
```

### 4.3 Development Playground

```
Developers → Experiment with new languages/frameworks
             → No local environment setup needed
             → Disposable environments
```

### 4.4 Secure Testing Environment

```
Security teams → Test potentially malicious code
                → Isolated from production systems
                → Command-level monitoring
```

### 4.5 Workshop/Training Platform

```
Trainers → Pre-configure environments for attendees
           → Monitor progress in real-time
           → Control internet access during sessions
```

---

## 5. How to Use

### For Users

#### 1. Registration & Login

- Sign up via Google or GitHub OAuth
- Access dashboard at `/sandbox`

#### 2. Create Sandbox

```
Dashboard → "Create Sandbox" → Select:
  - Base image (Alpine, Ubuntu, Debian)
  - Runtimes (Node.js, Python, etc.)
  - Resource limits (CPU, Memory, Disk)
```

#### 3. Access Terminal

```
Sandbox card → "Terminal" button → Web-based shell
```

#### 4. Manage Files

```
Sandbox → "Files" → Upload/Download/Browse/Archive
```

#### 5. Expose Services

```
Run a web server (e.g., port 3000)
→ Create port mapping
→ Access via /s/<serviceName>
```

#### 6. Request Internet Access

```
Sandbox → "Request Internet" → Submit reason → Wait for admin approval
```

### For Administrators

#### 1. Login

- Access admin panel at `/admin-auth/admin/login`
- Email/password authentication (no OAuth)

#### 2. Dashboard

- View system statistics
- Monitor recent users and containers

#### 3. Manage Requests

```
/admin/internet-requests → Approve/Deny with notes and duration
/admin/schedule-requests → Manage automated schedules
```

#### 4. Security Monitoring

```
/admin/security-alerts → View and acknowledge threats
/admin/command-logs → Search command history by risk level
/admin/dangerous-commands → Manage blocking patterns
```

#### 5. User Management

```
/admin/users → View all users → Ban/unban as needed
```

---

## 6. Pros and Cons

### Pros

| Pro | Detail |
|-----|--------|
| **Strong Security** | Multi-layer defense (seccomp, AppArmor, command filtering, network isolation) |
| **Modern Stack** | Next.js 16, React 19, TypeScript - maintainable and performant |
| **shadcn/ui** | Beautiful, accessible UI components |
| **Real-time Features** | WebSocket terminal, SSE progress, Telegram notifications |
| **Comprehensive Admin** | Full control over users, resources, security |
| **Audit Compliance** | Complete logging of all actions |
| **OAuth Integration** | Easy user onboarding with Google/GitHub |
| **Flexible Scheduling** | Automated container management |
| **Multi-runtime** | Support for 8+ programming languages |
| **Service Routing** | Easy exposure of container services |

### Cons

| Con | Detail |
|-----|--------|
| **SQLite Limitation** | Single-file database may not scale to high concurrency |
| **Docker Dependency** | Requires Docker daemon on host |
| **Single Host** | No built-in multi-host clustering |
| **Admin Overhead** | Manual approval for internet access can be bottleneck |
| **Resource Intensive** | Each sandbox is a full container |
| **WebSocket Complexity** | Separate WS server (port 3001) requires additional setup |
| **Telegram Dependency** | Admin notifications tied to Telegram |

---

## 7. Limitations

### Technical Limitations

| Limitation | Current Value | Impact |
|------------|---------------|--------|
| Max sandboxes per user | 5 | Users can't create more environments |
| Max CPU per sandbox | 2 cores | Compute-intensive tasks limited |
| Max memory per sandbox | 1 GB | Large datasets/apps may fail |
| Max disk per sandbox | 2 GB | Storage-heavy projects restricted |
| Max file upload | 10 MB/file, 50 MB total | Large file transfers difficult |
| Process limit | 100 per container | Fork-heavy apps limited |
| Port mappings | 10 per sandbox | Multiple services may conflict |

### Architectural Limitations

1. **Single Database**: SQLite limits concurrent writes
2. **No Horizontal Scaling**: Docker containers bound to single host
3. **No Persistent Storage Across Recreates**: Volume data tied to container lifecycle
4. **No GPU Support**: Configured for CPU-only workloads
5. **No Windows Containers**: Linux containers only
6. **Internet Access Requires Approval**: Not self-service

### Security Limitations

1. **Command Filtering is Pattern-based**: Sophisticated bypass possible
2. **No Runtime Sandboxing Inside Container**: Process-level isolation only
3. **Admin Has Full Access**: No separation of admin duties
4. **No MFA for Admin**: Email/password only for admin login

---

## 8. Additional Information

### Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Command Filter (Block dangerous commands)          │   │
│  │  - Privilege escalation patterns                    │   │
│  │  - Container escape patterns                        │   │
│  │  - Host probing patterns                            │   │
│  │  - Network scanning patterns                        │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    Container Layer                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Docker Security                                    │   │
│  │  - Non-root user                                    │   │
│  │  - Capability dropping                              │   │
│  │  - seccomp profiles                                 │   │
│  │  - AppArmor profiles                                │   │
│  │  - Resource limits (CPU, memory, PIDs)              │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    Network Layer                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Network Isolation                                  │   │
│  │  - sandbox-isolated: 172.29.0.0/16 (no internet)    │   │
│  │  - sandbox-internet: 172.30.0.0/16 (internet)       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema Summary

```
auth (Better Auth)
├── user (id, email, role, banned, etc.)
└── session (id, userId, expiresAt, etc.)

sandbox
├── containers (id, userId, status, resources, etc.)
├── portMappings (id, containerId, port, serviceName)
├── userVolumes (id, userId, path, size)
├── auditLogs (id, userId, action, details)
├── bugReports (id, userId, status, description)
└── sandboxScheduleRequests (id, containerId, type, etc.)

security
├── internetAccessRequests (id, containerId, status, etc.)
├── commandLogs (id, containerId, command, riskLevel)
├── securityAlerts (id, containerId, severity, type)
├── networkEvents (id, containerId, eventType)
└── dangerousCommandPatterns (id, pattern, category, risk)
```

### Runtime Installation Commands

| Runtime | Installation Method |
|---------|---------------------|
| Node.js | nvm + npm |
| Python | pyenv + pip |
| Java | SDKMAN |
| Go | Direct binary |
| Rust | rustup |
| PHP | apt/apk + composer |
| Ruby | rbenv + bundler |
| .NET | Microsoft packages |

### API Endpoint Summary

| Category | Endpoints |
|----------|-----------|
| User Sandbox | 15+ endpoints for container CRUD, files, ports |
| Admin | 20+ endpoints for users, security, settings |
| Auth | Better Auth routes for OAuth/sessions |
| Service | Proxy routes for container services |
| Cron | 3 endpoints for scheduled tasks |
| Internal | Seeding, idle check, Telegram polling |

### Deployment Considerations

1. **Docker Required**: Host must have Docker daemon
2. **Port 3001**: WebSocket server needs this port open
3. **Environment Variables**: OAuth credentials, Telegram token required
4. **Database**: SQLite file needs persistent storage
5. **Security Profiles**: seccomp/AppArmor profiles need loading

---

## 9. Project Structure

```
/app
  ├── /api              # REST API endpoints
  ├── /admin            # Admin dashboard pages
  ├── /sandbox          # User sandbox pages
  ├── /auth             # Authentication pages
  ├── /(admin-auth)     # Admin-specific auth routes
  ├── /service          # Service proxy routes
  └── /s                # Global service routing

/lib
  ├── /auth             # Authentication configuration
  ├── /docker           # Docker client & container service
  ├── /security         # Command filtering & alerts
  ├── /config           # Configuration files
  ├── /scheduler        # Sandbox scheduling service
  ├── /telegram         # Telegram notifications
  ├── /sse              # Server-sent events manager
  └── /settings         # Application settings

/database
  ├── /schemas          # Drizzle ORM schemas
  └── /seed.ts          # Database seeding

/components
  ├── /ui               # shadcn/ui components
  ├── /admin            # Admin components
  ├── /sandbox          # User sandbox components
  ├── /auth             # Authentication components
  └── /terminal         # Terminal UI component

/server
  └── /ws-terminal.ts   # WebSocket terminal server

/security
  └── (AppArmor & seccomp profiles)
```

---

## 10. Summary

The **Sandbox Platform** is a well-architected, security-focused solution for providing isolated development environments. It excels in educational, interview, and experimentation use cases where security and monitoring are priorities. The modern tech stack (Next.js 16, React 19, shadcn/ui) ensures maintainability, while the multi-layered security approach provides strong isolation.

### Best Suited For

- Educational institutions
- Technical interview platforms
- Development playgrounds
- Security research environments

### Consider Alternatives If You Need

- Massive scale (1000+ concurrent users)
- GPU/specialized hardware
- Windows container support
- Fully self-service internet access
