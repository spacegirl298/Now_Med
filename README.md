# Now Med

**Now Med** is a web application designed to improve communication and transparency between patients and reception staff regarding medical appointments and scheduling delays. The project is being developed using **React**, **Vite**, **Firebase Authentication**, and **Cloud Firestore** as part of the Interactive Media course.

This repository contains the current Alpha iteration of the application.

---

# Getting Started

## Prerequisites

Before running the project, ensure you have:

- Node.js (v18 or later recommended)
- npm
- Internet connection (required for Firebase Authentication and Firestore)

## Installation

Clone or extract the project, then open a terminal in the project directory.

Install the required dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The application will usually be available at:

```text
http://localhost:5173
```

---

# Creating Test Accounts

To explore the application's functionality, two accounts should be created:

1. **Secretary Account**
2. **Patient Account**

Both accounts can be created through the Sign Up page by selecting the appropriate role during registration.

After registering, Firebase will automatically send an **email verification** message to the email address used during sign-up.

NB\* **Accounts must be verified via the email link before they can log in.** Please check your spam or junk folder if the verification email does not appear in your inbox.

Once both accounts have been verified, log in to each role separately to explore the different interfaces and functionality available to patients and secretaries.

---

# Building the Project

To generate the production build:

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

---

# Technologies

- React
- Vite
- Firebase Authentication
- Cloud Firestore
- React Router
- Tailwind CSS
- Lucide React

# Alpha Progress

## Our Core Features Are Completed

### Authentication & Security

- User registration with role selection
- Firebase Authentication
- Email verification
- Login and password reset
- Protected routes
- Role-based access control
- POPIA-conscious access restrictions

### Patient Features

- Dashboard
- Appointment booking
- Live appointment status
- Medical records
- Profile management

### Secretary Features

- Dashboard
- Schedule management
- Appointment management
- Delay marking
- Patient list
- Patient record access
- Doctor profile management

### Real-Time Functionality

- Live Firestore integration
- Real-time delay updates
- Appointment confirmation workflow
- Calendar management
- Schedule blocking (including lunch breaks)

---

# Current Status

The Alpha build successfully implements all core functionality defined in the project requirements. Current development is focused on polishing the user experience, testing, deployment, and refining existing functionality rather than adding major new features.

---

# Future Improvements

- Additional patient information pages
- Medical aid support
- Guardian bookings
- Appointment duration display
- Additional security improvements
- Accessibility refinements
- Comprehensive testing before final release
