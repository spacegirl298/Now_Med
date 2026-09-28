# Now Med

**Real-time appointment transparency for patients. One structured workspace for reception staff.**

Now Med is a web application that improves communication between patients and reception staff around medical appointments and scheduling delays. It addresses a well-documented problem in South African healthcare: long, uncommunicated waiting times. Patients see the live status of their appointment, get told when a doctor is running late, and can message the practice. Secretaries manage the schedule, patients, doctors and practice analytics from one place.

The guiding question behind the project: *what if a doctor's delay was communicated as clearly and immediately as a text message?* The interface is deliberately warm and rose-toned rather than clinical, treating appointment transparency as a form of respect for patients' and staff's time.

Built with **React**, **Vite**, **Firebase Authentication**, **Cloud Firestore** and the **Google Maps API**.

> Developed for DIGA4004A / DIGA4005A. Development decisions, testing results and deviations from the original PRD are documented in the Individual Progress Report (Beta). This README is a practical guide to running, testing and understanding the project.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Testing the Application](#testing-the-application)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Security and Access Control](#security-and-access-control)
- [Testing Summary](#testing-summary)
- [Deployment](#deployment)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Authors](#authors)

---

## Features

### Authentication and access control
- Multi-role registration (**Patient** and **Secretary**), with secretary sign-up gated by a practice code
- SA ID / passport number capture, used to automatically link walk-in bookings and records to a patient's account when they later register
- Email verification, login and password reset
- Role-based protected routes
- Tab-scoped sessions, so different roles can be logged in side by side in separate tabs

### Patient
- **Dashboard** with live appointment status and real-time delay notifications
- **Appointment booking** through a calendar, using transaction-safe writes so two people can never book the same slot
- **Cancellations and running late**: cancel your own appointment up to 3 hours beforehand, or flag that you're running late
- **Location and ETA**: Google Maps integration calculates the patient's estimated arrival time and lets them send a late-arrival message to the practice
- **Messaging**: real-time conversation with the practice
- **Doctor reviews**
  - Review prompt and notification 15 minutes after an appointment's scheduled time
  - Write a review from the dashboard or from the calendar
  - Review history on the home page, with the ability to edit past reviews
  - **Our Doctors** section showing each doctor's average rating and review count, ordered by how often the patient has visited them
- **Intake form** covering medical aid provider and dependant number, past surgeries and hospital admittance history
- **Profile**: edit some details directly, and request changes (routed to the secretary for approval) for sensitive fields such as medical aid details
- **Avatar profile pictures**: illustrated animal-in-scrubs avatars (10 available)
- **Medical records** (read-only, scoped strictly to the logged-in patient)

### Secretary
- **Dashboard** with an overview of the day's schedule
- **Schedule management**: add, edit and delete appointments; block full days or specific time ranges (e.g. lunch breaks)
- **Delay marking** that propagates instantly to the affected patient, with automatic late-appointment messages
- **Delay and cancellation rules** governing what happens to a slot when a patient is marked delayed rather than cancelled
- **Booked → Confirmed workflow**, recording whether confirmation happened by email, WhatsApp or phone call
- **Messaging** with patients, including confirmation and intake reminders, and the ability to remove inappropriate messages
- **Patient list**, searchable by name or ID number, plus approval of patient change requests
- **Doctor profiles** with contact details and collected patient reviews in one connected view
- **Review moderation**: hide reviews from patients that aren't a fair representation. Hidden reviews still count in analytics.
- **Secretary information/profile** section
- **Walk-in bookings**: record a phone or in-person booking for someone who doesn't have an account yet

### Practice analytics (admin)
A separate, read-only reporting area, kept apart from the secretary's day-to-day scheduling dashboard. It pulls live Firestore data and provides:
- Appointment volume
- Average review rating
- Late arrivals and late fees
- Per-doctor breakdown of appointments, reviews, ratings and lateness
- Monthly and weekly views for doctors, secretaries and patients

> The analytics page began as a nice-to-have and is functional, but is still undergoing acceptance testing and UI polish.

### Responsive design
Mobile layouts are substantially complete. The Patient Records view is still being refined.

---

## Tech Stack

| Area | Technology |
| --- | --- |
| Frontend | React, Vite |
| Routing | React Router |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Auth | Firebase Authentication (tab-scoped session persistence) |
| Database | Cloud Firestore (real-time listeners via `onSnapshot`, transactions for booking) |
| Backend logic | Firebase Cloud Functions |
| Location / ETA | Google Maps API |
| Hosting | Firebase Hosting |
| Linting | ESLint |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm
- An internet connection. The app connects to a live Firebase project, and the Firebase config is already included, so no local Firebase setup is needed.

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
Go to **Sign Up**, select **Patient** and complete the form. You will be asked for an SA ID number (13 digits) or a passport number, which links any walk-in bookings or records a secretary created for that person before they had an account.

### 3. Verify both accounts
Firebase sends a real verification email to the address used at sign-up. **Both accounts must be verified before they can log in.** If the email doesn't arrive within a minute, check spam or junk. This is a known limitation of Firebase's default shared sending domain, not a bug.

### 4. Explore both roles side by side
Because sessions are tab-scoped, log in as the secretary in one tab and the patient in another, then try:
- Mark a delay as the secretary and watch it appear on the patient's dashboard in real time
- Send messages between the two accounts
- Book an appointment as the patient and confirm it as the secretary
- Leave a review as the patient (available 15 minutes after an appointment's time), then hide it from the doctor's profile as the secretary and see it disappear from the patient's Our Doctors section
- Open the practice analytics page to see the review and appointment data reflected

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
│   │   ├── patient/    Dashboard, Calendar (booking and reviews), Records, Profile, Our Doctors, Messaging
│   │   └── secretary/  Dashboard, Schedule, PatientList, Doctors, Analytics, Messaging, Profile
│   └── utils/          dateHelpers, validators
├── firestore.rules     Firestore security rules (role-based access control)
├── firebase.json       Deployment config for Hosting and Firestore rules
├── index.html
├── vite.config.js
└── eslint.config.js
```

---

## Security and Access Control

Access control is enforced by Firestore security rules (`firestore.rules`), deployed to the live project.

**Role-based access**
- Secretaries can manage appointments, records, patient profiles, doctors and analytics. Patients can only read their own data.
- Walk-in data a secretary entered under an ID number is automatically readable by the matching patient once they register with that ID, and by nobody else.
- Patients can self-edit only contact and administrative profile fields. Clinical data (allergies, medications, conditions, history) is secretary-only, regardless of what the client sends.
- Sensitive changes go through **change requests**, which a patient files and only a secretary can resolve.

**Appointments**
- Patients can only touch their own appointments, and only to cancel (more than 3 hours before the appointment, checked against the server's trusted time) or to report themselves running late. Confirming, delaying, editing and rescheduling are secretary actions.
- **Double-booking protection** uses a Firestore transaction that checks and writes a slot atomically, backed by a non-sensitive `appointmentSlots` mirror so the booking calendar can show availability without exposing other patients' data.

**Messaging, reviews and notifications**
- Patients can only post messages as themselves. Sent messages can't be edited, and only a secretary can delete one for moderation.
- Reviews are one per appointment. Patients can edit only the rating and comment on their own review, and only a secretary can hide or delete one.
- Notifications can only be addressed to the sender or to a secretary, so users can't spam each other.

**Accounts**
- An `idNumberIndex` collection ensures an ID or passport number can't be registered to more than one account per role.
- **Tab-scoped session persistence** (`browserSessionPersistence`) is used instead of Firebase's default shared persistence. A secretary's workstation is a shared, always-on machine, and the default would keep any account signed in across every tab, including ones used by other staff or patients.
- Email verification is required before login, and a practice code gates secretary registration.

**Tested directly:** attempts to reach another patient's records without authenticating as that patient were blocked.

---

## Testing Summary

Beta testing verified the PRD acceptance criteria rather than just confirming features looked functional. Full results are in the project's testing report spreadsheet.

| Feature | Result | Notes |
| --- | --- | --- |
| Registration | Pass after fix | Sign-up broke after clearing Firestore due to a security rule / Cloud Function misconfiguration; fixed and retested |
| Login and redirect | Pass | |
| Appointment booking | Pass | |
| Concurrent booking | Pass | Firestore transaction allows only one booking per slot |
| Delay marking | Pass | Updated ETA on the patient card needs to be more prominent |
| Medical records access | Pass | Cross-patient access prevented |
| Password reset | Pass | Same-password reset is a design decision still to be made |
| Real-time sync | Pass | |
| Doctor reviews | Pass | |
| ETA / location | Pass after fix | Initial API integration failure resolved |
| Messaging | Pass | Language filter updated to warn rather than block |
| Practice analytics | Partial | Live data working; acceptance testing pending |

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

- **Verification emails may land in spam.** Fixing this needs a custom sending domain, which is outside the current budget.
- **Updated ETA visibility.** The updated ETA on a delayed appointment works, but could be more prominent on the patient's appointment card.
- **Practice analytics** is functional and pulls live data, but is still undergoing final acceptance testing and UI polish.
- **Dev bypass flag.** `DEV_BYPASS_ROLE` in `App.jsx` is a hardcoded constant that skips login for development. It must stay `false` for any release.

---

## Roadmap

**Next**
- Full acceptance-testing pass on the practice analytics page
- Complete the mobile responsive pass and delay-notification polish
- Revise the PRD Risk Register against actual findings

**Future improvements**
- Doctor / practice information page for patients
- Guardian bookings on behalf of a child
- Appointment duration shown on the calendar
- Additional ID-based security for medical records
- Detecting duplicate accounts registered under different ID numbers
- Multi-language messaging filter
- Custom email sending domain

**Dropped from scope:** in-waiting-room games, deprioritised in favour of messaging and analytics.

---

## Authors

- **Jordyn Van Aswegen**: [@JvTayla](https://github.com/JvTayla). Secretary-facing features (information/profile section, delay and cancellation rules, Doctor Reviews restructure and review moderation), Google Maps / ETA integration, documentation and testing.
- **Jessica Jardim**: [@spacegirl298](https://github.com/spacegirl298). Messaging, patient intake form research and rebuild, patient profiles, and bug testing and fixes.
