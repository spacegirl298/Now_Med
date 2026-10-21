# Now Med

**Real-time appointment transparency for patients, and one structured workspace for reception staff.**

Long, uncommunicated waiting times are a daily frustration in South African healthcare. Now Med lets patients see the live status of their appointment, get told when a doctor is running late, and message the practice. Secretaries run the schedule, patients, doctors and practice analytics from one place.

Built with React, Vite, Firebase and the Google Maps API for DIGA4004A / DIGA4005A. Design decisions, testing results and changes from the original PRD are in the Individual Progress Report.

## Run it

You need [Node.js](https://nodejs.org/) 22.12 or later and an internet connection.

```bash
git clone https://github.com/spacegirl298/Now_Med.git
cd Now_Med
npm install
npm run dev
```

Then open **http://localhost:5173**.

## Logging in

- **Patient:** choose **Sign Up**, pick *Patient*, register and verify your email from the link, then log in.
- **Secretary:** staff accounts are invite-only. Test secretary and patient accounts are supplied with the submission.

## ETA feature (needs a Maps key)

The arrival-time estimate uses Google Maps. No key is included in this repository. Copy `.env.example` to `.env.local` and paste in the key supplied with the submission:

```
VITE_GOOGLE_MAPS_API_KEY=your-key-here
```

Restart `npm run dev` afterwards. Without a key everything else works and the ETA card is simply not shown.

## What it does

**Patients**
- Live dashboard with appointment status and real-time delay notifications
- Calendar booking that prevents double-booking
- Cancel up to 3 hours before an appointment, or flag that you are running late
- ETA to the practice, with a button to send a late-arrival message
- Messaging with the practice
- Doctor reviews, with average ratings per doctor
- Intake form (one question at a time) including medical aid details
- Profile with illustrated avatars, and change requests for sensitive details
- Read-only medical records

**Secretaries**
- Daily dashboard and schedule management, including blocking time and booking walk-ins
- Delay marking that reaches the patient immediately
- Booked to Confirmed workflow
- Messaging, reminders and message moderation
- Patient list, change request approval, doctor profiles and review moderation
- Practice analytics: appointment volume, ratings, late arrivals and per-doctor breakdowns

## Tests

The security rules (`firestore.rules`) have automated tests that run on a local emulator and never touch live data:

```bash
npm run test:rules
```

This needs [Java](https://adoptium.net/) 21 or later. Manual testing results are in the project's testing report.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build into `dist/` |
| `npm run lint` | Run ESLint |
| `npm run test:rules` | Run the security rules tests |

## Project structure

```
src/
  components/   Shared UI
  context/      Authentication
  firebase/     Firebase setup and data access
  hooks/        Appointments, notifications, geolocation
  pages/        auth, patient and secretary screens
  utils/        Date, Maps and validation helpers
tests/          Security rules tests
firestore.rules Security rules
firebase.json   Firebase configuration
```

## Known limitations

- Verification emails may land in spam (a custom sending domain is outside the current budget).
- The ETA needs a Google Maps key.
- Analytics is functional but has had limited acceptance testing.
- Notifications appear inside the app only; there are no push notifications.

## Authors

- **Jordyn Van Aswegen** ([@JvTayla](https://github.com/JvTayla))
- **Jessica Jardim** ([@spacegirl298](https://github.com/spacegirl298))

See the Individual Progress Reports for who built what.
