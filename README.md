# Now Med

**Real-time appointment transparency for patients, and one structured workspace for reception staff.**

Long, uncommunicated waits are a daily frustration in South African healthcare. Now Med lets patients see the live status of their appointment, get told when the doctor is running late, and message the practice. Secretaries run the schedule, patients, doctors and practice analytics from one place.

Built with React, Vite, Firebase (Firestore, Hosting, Cloud Functions and Cloud Messaging) and the Google Maps API for DIGA4004A / DIGA4005A. Design decisions, testing results and every change from the original PRD are in the project report.

**Live site:** https://now-med-edebf.web.app
**Repository:** https://github.com/spacegirl298/Now_Med

## Run it locally

You need [Node.js](https://nodejs.org/) 22.12 or later and an internet connection.

```bash
npm install
npm run dev
```

Then open **http://localhost:5173**.

If you cloned the repository instead of unzipping the submission, run `git clone https://github.com/spacegirl298/Now_Med.git` and `cd Now_Med` first.

The app talks to our live Firebase project, so no database setup is needed. The Firebase web config in `src/firebase/config.js` is public by design. Access is controlled by the security rules in `firestore.rules`.

## Environment variables

Secrets are not committed to the repository. Copy `.env.example` to `.env.local`, fill in the values, then restart `npm run dev`.

- **Submission zip:** `.env.local` is already included. Nothing to do.
- **Cloned from GitHub:** copy `.env.example` to `.env.local` and paste in the keys supplied with the submission.

```
VITE_GOOGLE_MAPS_API_KEY=your-key-here
```

`.env.example` lists every variable the app reads, including the web push key used for phone and browser alerts.

Without a Maps key everything else works. The ETA card shows a friendly message and the directions link still opens. ETA and the map only appear for in-person visits. Without the push key the app still shows in-app notifications, but closed-app alerts are disabled.

## Logging in

Test accounts are supplied with the submission, separate from this file.

- **Patient:** tap **Get started** on the welcome screen, register, and verify your email using the link we send. Then tap **Log in**. Check spam if the email does not arrive.
- **Secretary:** staff accounts are invite only. Add the staff member's lower-case email as a document ID in the `staffInvites` collection in the Firebase console (any field will do). They then sign up as _Medical Secretary_ with that email.

## What it does

**Patients**

- Live dashboard with appointment status and real-time delay notifications
- Calendar booking that prevents double booking, even when two people tap the same slot together
- Cancel up to 3 hours before an appointment, or flag that you are running late
- ETA to the practice, with a button to send a late-arrival message
- Virtual consultations with their own meeting link (Jitsi Meet, nothing to install)
- In-app notifications, plus push alerts to your phone or browser, even when Now Med is closed
- Messaging with the practice
- Doctor reviews with average ratings
- Intake form, one question at a time, including medical aid details
- Profile with illustrated avatars, and change requests for sensitive details
- Read-only medical records
- Family dashboard for parents and guardians to manage children's profiles, intake forms and bookings

**Secretaries**

- Daily dashboard and schedule management, including blocking time and booking walk-ins
- Delay marking that reaches the patient immediately
- Booked to Confirmed workflow
- Messaging, reminders and message moderation
- Patient list, change request approval, doctor profiles and review moderation
- Practice analytics: appointment volume, ratings, late arrivals and per-doctor breakdowns

## Push notifications

Notifications are saved to Firestore as before. A Cloud Function in `functions/index.js` sends each new notification to the patient's registered devices through Firebase Cloud Messaging, so it arrives even when the app is closed.

- The browser registers for push in `src/firebase/push.js`, and `public/sw.js` (the service worker) shows the alert.
- `src/hooks/useNotificationAlerts.js` handles alerts while the app is open.
- Patients must allow notifications when prompted. On iPhone, add Now Med to the Home Screen first.
- Cloud Functions needs the Firebase **Blaze** (pay-as-you-go) plan. Usage at this scale stays within the free allowance.

## Tests

The security rules have automated tests that run against a local emulator and never touch live data.

```bash
npm run test:rules
```

This needs [Java](https://adoptium.net/) 21 or later. Manual testing results are in the project report.

## Scripts

| Command              | What it does                  |
| -------------------- | ----------------------------- |
| `npm run dev`        | Start the dev server          |
| `npm run build`      | Production build into `dist/` |
| `npm run lint`       | Run ESLint                    |
| `npm run test:rules` | Run the security rules tests  |

## Deploying

The Firebase CLI is a dev dependency, so use `npx` and there is nothing to install globally. The Cloud Function has its own `package.json` and needs its packages installed once.

```bash
npm install
npm run build
cd functions && npm install && cd ..
npx firebase login
npx firebase deploy --only functions,firestore:rules,hosting
```

To redeploy only the site and rules (for example after a UI change):

```bash
npm run build
npx firebase deploy --only hosting,firestore:rules
```

Notes:

- The account running the first functions deploy must be a project **Owner**. Firebase needs to grant a few roles to its service agents, and the deploy fails with an IAM error otherwise.
- The project must be on the **Blaze** plan to deploy functions.
- Functions run on Node 22. A newer local Node version only produces a warning.
- If the project lives in OneDrive, pause sync before `npm install`. OneDrive can lock files in `node_modules` and cause `EPERM` errors.

`firebase.json` points the rules at `firestore.rules` and the named Firestore database `jj04`.

## Project structure

```
src/
  components/   Shared UI (including skeleton loaders and family components)
  context/      Authentication
  firebase/     Firebase setup, data access and push registration
  hooks/        Appointments, notifications, geolocation, family
  pages/        auth, patient and secretary screens
  utils/        Date, Maps and validation helpers
functions/      Cloud Function that sends push notifications (own package.json)
public/         Static files, including the push service worker (sw.js)
tests/          Security rules tests
firestore.rules Security rules
firebase.json   Firebase configuration
```

## Known limitations

- Push alerts depend on the device and browser. They need notification permission, and iPhone only supports them once the app is added to the Home Screen.
- Virtual consults use a Jitsi Meet room per appointment. The join link is shown to patients in the app. Jitsi only needs one person in the room to be signed in with a Google, GitHub or Facebook account. Once they have joined, the meeting works and everyone else can join. Doctors have no accounts in this prototype, so for testing, whoever opens the room first signs in.
- Verification emails can land in spam, because a custom sending domain is outside the project budget.
- The ETA feature needs a Google Maps key.
- Analytics works but has had limited acceptance testing.
- There is no late-cancellation fee. Patients simply cannot cancel online inside 3 hours.
- The production build is a single large bundle. Route-level code splitting is a planned improvement.

## Authors

- **Jordyn Van Aswegen** ([@JvTayla](https://github.com/JvTayla))
- **Jessica Jardim** ([@spacegirl298](https://github.com/spacegirl298))
