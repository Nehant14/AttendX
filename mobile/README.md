# AttendX Mobile Frontend

Cross-platform mobile application for professors built with **Expo**, **React Native**, **TypeScript**, and **Expo Router**, integrating directly with the AttendX FastAPI face-recognition attendance backend.

---

## 🏗️ Architecture

```
mobile/
├── app/                              # File-based routing (Expo Router)
│   ├── _layout.tsx                   # Root layout, AuthProvider, protected navigation
│   ├── (auth)/                       # Authentication flow
│   │   ├── _layout.tsx
│   │   ├── login.tsx                 # Professor login
│   │   └── signup.tsx                # Professor registration
│   ├── (tabs)/                       # Authenticated tab navigation
│   │   ├── _layout.tsx
│   │   ├── index.tsx                 # Professor Dashboard (Overview, classes, sessions)
│   │   ├── classes/                  # Class & Roster Management
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx             # Class list + Create class
│   │   │   └── [id].tsx              # Class roster & student assignment
│   │   ├── students/                 # Student Biometrics & Profiles
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx             # Student list + New student registration
│   │   │   └── [roll_no].tsx         # Multi-photo face enrollment & embeddings
│   │   └── attendance/               # Attendance Lifecycle
│   │       ├── _layout.tsx
│   │       ├── index.tsx             # Select class, capture/pick classroom photo
│   │       └── session/
│   │           └── [id].tsx          # Status polling, face bounding boxes, resolution & finalization
│   └── settings.tsx                  # Server Base URL config, /health test, logout
├── components/                       # Modular UI & Attendance components
│   ├── ui/                           # Button, Input, Card, Badge, Header, LoadingView, EmptyState
│   └── attendance/                   # FaceBoundingBoxOverlay, FlaggedFaceCard, RosterChecklist, AuditModal
├── context/
│   └── AuthContext.tsx               # Auth state, session persistence, server URL state
├── hooks/
│   ├── useClasses.ts                 # Class CRUD & roster operations
│   ├── useStudents.ts                # Student creation & multi-photo face enrollment
│   └── useAttendanceSession.ts       # Session lifecycle, polling, face resolution, finalization, audit
├── services/
│   ├── api/                          # Centralized API client & endpoint handlers
│   │   ├── client.ts                 # Fetch client with dynamic base URL, JWT headers, multipart upload
│   │   ├── auth.ts                   # /auth/signup, /auth/login, /health
│   │   ├── classes.ts                # /classes, /classes/{id}/roster
│   │   ├── students.ts               # /students, /students/{roll_no}/enroll, embeddings
│   │   └── sessions.ts               # /sessions, /sessions/{id}/status, review, resolve, finalize, audit
│   └── storage/
│       ├── secureStore.ts            # Secure token storage (expo-secure-store)
│       └── cache.ts                  # AsyncStorage persistence for offline/local state
├── types/
│   └── api.ts                        # Exact TypeScript types matching FastAPI Pydantic schemas
├── constants/
│   ├── theme.ts                      # Modern academic color tokens, typography, shadows
│   └── config.ts                     # Default endpoints and constants
└── utils/
    ├── formatters.ts                 # Date and percentage formatters
    └── image.ts                      # Camera and photo picker helpers with permissions
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd mobile
npm install
```

### 2. Configure Backend URL
Classes, students and sessions are stored on the server; the phone only caches them for offline display.
- **Development (`npx expo start`):** the app auto-detects your PC's LAN IP and uses port 8000.
- **Installed APK/IPA:** enter the PC's address once in **Settings** (e.g. `http://192.168.1.15:8000`). It is remembered.
  Run `npm run lan-ip` on the PC to find it. Use **Test Health** before **Save URL**.
- Android emulator: `http://10.0.2.2:8000`. iOS simulator: `http://localhost:8000`.
- `EXPO_PUBLIC_API_URL` can pre-fill the address; `EXPO_PUBLIC_USE_MOCK=true` runs on built-in demo data (login `test@attendx.com` / `test1234`).

### 3. Run
```bash
npx expo start     # scan the QR with Expo Go (same Wi-Fi as the PC)
npm run typecheck
```

### 4. Build an installable app
```bash
npx eas-cli login
npx eas-cli build -p android --profile preview   # produces an .apk
```
iOS device builds require a paid Apple Developer account (`--profile preview` with registered devices).
The app allows plain HTTP (Android cleartext + iOS ATS exception) so it can reach a backend on your LAN.
`.npmrc` sets `legacy-peer-deps=true`; keep it, EAS runs `npm ci`.
