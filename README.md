# Now Med

**Real-time appointment visibility for patients. One structured schedule for reception staff.**

Now Med is a web application that improves communication and transparency between patients and reception staff around medical appointments and scheduling delays. It targets a well-documented problem in South African healthcare: long, uncommunicated waiting times. Patients see the live status of their appointment, and secretaries manage the practice's schedule from a single place.

Built with **React**, **Vite**, **Firebase Authentication** and **Cloud Firestore**.

> Developed for DIGA4004A / DIGA4005A. Design decisions, deviations from the original PRD and known limitations are documented in the accompanying Individual Progress Report. This README is a practical guide to running, testing and understanding the project.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Testing the Application](#testing-the-application)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Security](#security)
- [Deployment](#deployment)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Author](#author)

---

## Features

### Authentication and access control
- Multi-role registration (**Patient** and **Secretary**), with secretary sign-up gated by a practice code
- SA ID / passport number capture, used to automatically link walk-in bookings and records to a patient's account when they later register
- Email verification, login and password reset
- Role-based protected routes
- Tab-scoped session storage, so you can be logged in as different roles in different tabs at the same time

### Patient
- **Dashboard** with live appointment status and real-time delay notifications
- **Appointment booking** via a calendar, using transaction-safe writes so two people can never book the same slot
- **Medical records** (read-only, scoped strictly to the logged-in patient)
- **Profile** editing

### Secretary
- **Dashboard** with an overview of the day's schedule
- **Schedule management**: add, edit and delete appointments; block full days or specific time ranges (e.g. lunch breaks)
- **Delay marking** that propagates instantly to the affected patient's dashboard
- **Booked → Confirmed workflow**, recording whether confirmation happened by email, WhatsApp or phone call
- **Patient list**, searchable by name or ID number
- **Doctor profile** management
- **Walk-in bookings**: record a phone or in-person booking for someone who doesn't have an account yet

---

## Tech Stack

| Area | Technology |
| --- | --- |
| Frontend | React, Vite |
| Routing | React Router |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Auth | Firebase Authentication |
| Database | Cloud Firestore (real-time listeners via `onSnapshot`) |
| Hosting | Firebase Hosting |
| Linting | ESLint |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm
- An internet connection. The app connects to a live Firebase project, and the Firebase config is already included, so no `.env` file or local Firebase setup is needed.

### Installation

```bash
git clone https://github.com/spacegirl298/Now_Med.git
cd Now_Med
npm install
npm run dev
```

The app will be available at **http://localhost:5173**.

---

## Testing the Application

The quickest way to see the full workflow is to create one account of each role and use them side by side.

### 1. Create a Secretary account
Go to **Sign Up**, select **Secretary** and complete the form. Secretary registration requires a valid practice code:

```
Practice code: NM001
```

### 2. Create a Patient account
Go to **Sign Up**, select **Patient** and complete the form. You will be asked for an SA ID number (13 digits) or a passport number. This links any walk-in bookings or records a secretary created for that person before they had an account.

### 3. Verify both accounts
Firebase sends a real verification email to the address used at sign-up. **Both accounts must be verified before they can log in.** If the email doesn't arrive within a minute, check your spam or junk folder. This is a known limitation of Firebase's default shared sending domain, not a bug.

### 4. Explore both roles side by side
Because sessions are tab-scoped, log in as the secretary in one tab and the patient in another. Mark a delay as the secretary and watch it appear on the patient's dashboard in real time.

---

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server with hot reload |
| `npm run build` | Create a production build in `/dist` |
| `npm run preview` | Serve the production build locally to sanity-check it |
| `npm run lint` | Run ESLint |

---

## Project Structure

```
Now_Med/
├── src/
│   ├── components/     Shared UI (Button, Card, Modal, Badge, Sidebar, BackButton, ...)
│   ├── context/        AuthContext: auth state, role and session handling
│   ├── firebase/       config.js, firestore.js (all Firestore reads, writes and transactions)
│   ├── hooks/          useAppointments, useAuth, useNotifications
│   ├── pages/
│   │   ├── auth/       Login, SignUp, ForgotPassword, EmailVerification
│   │   ├── patient/    Dashboard, Calendar (booking), Records, Profile
│   │   └── secretary/  Dashboard, Schedule, PatientList, Profile
│   └── utils/          dateHelpers, validators
├── firestore.rules     Firestore security rules (role-based access control)
├── firebase.json       Deployment config for Hosting and Firestore rules
├── index.html
├── vite.config.js
└── eslint.config.js
```

---

## Security

- **Firestore security rules** (`firestore.rules`) enforce role-based access. Patients can only ever read their own data.
- **Role-based route protection** on the client, backed by the rules on the server side.
- **Email verification** is required before login.
- **Practice code** gates secretary registration.
- **Transactional booking writes** prevent double-booking of a slot.

---

## Deployment

The project is configured for Firebase Hosting and Firestore rules via `firebase.json`.

```bash
npm run build
firebase deploy
```

To deploy only the security rules:

```bash
firebase deploy --only firestore:rules
```

---

## Known Limitations

- **Verification emails may land in spam.** Fixing this needs a custom sending domain, which is outside the current project budget.
- **Dev bypass flag.** `DEV_BYPASS_ROLE` in `App.jsx` is a hardcoded constant that skips login for development. It is set to `false` and must stay that way for any release. It is not gated by an environment variable or build mode.
- Duplicate accounts under two different ID numbers are not yet prevented.
- A full usability testing pass (Phase 4 of the PRD's testing strategy) is still outstanding.

---

## Roadmap

- Doctor / practice information page for patients
- Medical aid information capture
- Guardian bookings on behalf of a child
- Appointment duration shown on the calendar
- Additional ID-based security for medical records
- Duplicate-account prevention
- Custom email sending domain

---

## Author

**spacegirl298**
GitHub: [@spacegirl298](https://github.com/spacegirl298)
