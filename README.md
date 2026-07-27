# Now Med

**Now Med** is a web application designed to improve communication and transparency between patients and reception staff regarding medical appointments and scheduling delays. It addresses a documented problem in South African healthcare — long, uncommunicated waiting times — by giving patients real-time visibility into their appointment status and giving reception staff a single, structured place to manage the practice's schedule.

This repository contains the **Alpha (first iteration)** of the application, built with **React**, **Vite**, **Firebase Authentication**, and **Cloud Firestore**, submitted for DIGA4004A / DIGA4005A, Assignment 2 (Project Check-In).

A full account of the development process, technical decisions, deviations from the original PRD, and known limitations is in the accompanying **Individual Progress Report**. This README is a practical guide to running and testing the build.

---

## Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- npm
- An internet connection (the app connects to a live Firebase project — no local setup or `.env` file is required, the config is already included)

### Installation

Extract the submitted zip file, then open a terminal in the project directory.

```bash
cd Now_Med
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Testing the Application

The fastest way to see the full workflow is to create one account of each role and test them side by side.

### 1. Create a Secretary account

Go to **Sign Up** → select **Secretary** → complete the form. Secretary registration requires a valid practice code:

```
Practice code: NM001
```

### 2. Create a Patient account

Go to **Sign Up** → select **Patient** → complete the form. Registration also asks for an SA ID number (13 digits) or a passport number — this is used to automatically link any walk-in bookings or records a secretary may have created for that person by ID number before they had an account (see the Progress Report, Section 3.2, for why this exists).

### 3. Verify both accounts

Firebase sends a real verification email to the address used at sign-up. **Both accounts must be verified via that email link before they can log in.** If it doesn't arrive within a minute, check spam/junk — this is a known limitation of Firebase's default shared sending domain (documented in the Progress Report) and doesn't indicate a bug.

### 4. Log in and explore both roles

Because the app uses tab-scoped session storage rather than a shared browser session, you can be logged in as the secretary in one browser tab and the patient in another simultaneously — useful for seeing real-time updates (e.g. marking a delay as the secretary and watching it appear on the patient's dashboard) without logging in and out repeatedly.

---

## Building for Production

```bash
npm run build      # generates the production build in /dist
npm run preview    # serves that build locally to sanity-check it
```

---

## Technologies

- React + Vite
- Firebase Authentication
- Cloud Firestore (real-time listeners via `onSnapshot`)
- React Router
- Tailwind CSS
- Lucide React (icons)

---

## Project Structure

```
src/
├── components/     Shared UI (Button, Card, Modal, Badge, Sidebar, BackButton, ...)
├── context/        AuthContext — auth state, role, and session handling
├── firebase/       config.js, firestore.js (all Firestore reads/writes/transactions)
├── hooks/          useAppointments, useAuth, useNotifications
├── pages/
│   ├── auth/       Login, SignUp, ForgotPassword, EmailVerification
│   ├── patient/    Dashboard, Calendar (booking), Records, Profile
│   └── secretary/  Dashboard, Schedule, PatientList, Profile
└── utils/          dateHelpers, validators

firestore.rules      Firestore security rules (role-based access control)
firebase.json        Deployment config for Hosting + Firestore rules
```

---

## Alpha Feature Status

All nine must-have features from the PRD are implemented against live Firestore data. See the Progress Report for the detailed status table and evaluation.

**Authentication & Security**

- Multi-role registration (patient/secretary) with practice-code validation
- SA ID/passport capture for walk-in patient linking
- Email verification, login, password reset
- Role-based protected routes
- Firestore security rules enforcing that patients can only ever read their own data

**Patient features**

- Dashboard with live appointment status and real-time delay notifications
- Appointment booking, with a transaction-safe booking write to prevent two people booking the same slot
- Medical records (read-only, scoped to the logged-in patient)
- Profile editing

**Secretary features**

- Dashboard with daily schedule overview
- Schedule management: add/edit/delete appointments, block full days or specific time ranges (e.g. lunch breaks)
- Delay marking, with real-time propagation to the affected patient
- Booked → Confirmed appointment workflow, tracking whether confirmation happened by email, WhatsApp, or phone call
- Patient list, searchable by name or ID number
- Doctor profile management
- Ability to record a walk-in booking (phone/in-person) for someone without an account yet

---

## Current Status & Known Limitations

The Alpha successfully implements all core functionality defined in the PRD's must-have scope, and the primary workflow is navigable end-to-end for both roles. Remaining work before final submission is focused on deployment, verification, and polish rather than new features:

- Firestore security rules are written and tested locally but still need to be deployed to the live project.
- A temporary login bypass exists for local development only (active only in `npm run dev`, never in a production build) — it is not relevant to testing this build via the instructions above, which use real accounts.
- Verification emails may land in spam by default; this requires a custom sending domain to resolve, which is out of scope for this iteration's budget.

## Future Improvements

- A doctor/practice information page for patients
- Medical aid information capture
- Guardian bookings on behalf of a child
- Appointment duration shown on the calendar
- Additional ID-based security for medical records
- Prevention of duplicate accounts under two different ID numbers
- Full usability testing pass (Phase 4 of the PRD's testing strategy)
