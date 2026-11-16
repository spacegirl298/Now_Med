
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

export function isValidPassword(password) {
  return String(password || "").length >= 6;
}

export function isValidName(name) {
  return String(name || "").trim().length >= 2;
}

export function isValidPhone(phone) {
  if (!phone) return true;
  return /^[0-9+\s()-]{7,15}$/.test(phone);
}

export function isValidInternationalPhone(phone) {
  const value = String(phone || "").trim();
  if (!/^[0-9\s().-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function isValidMedicalAidNumber(value) {
  if (!value) return true;
  return /^[0-9\s-]{4,20}$/.test(value);
}

export function isNumeric(value) {
  if (value === "" || value === null || value === undefined) return true;
  return /^[0-9]+$/.test(String(value));
}

export function isNotEmpty(value) {
  return String(value || "").trim().length > 0;
}

export const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non-binary", label: "Non-binary" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];

export const DELAY_OPTIONS = [10, 20, 30, 45];

export const DELAY_REASONS = [
  { value: "previous_overran", label: "Previous consultation ran over" },
  { value: "emergency", label: "Emergency / urgent case" },
  { value: "procedure", label: "Procedure took longer than planned" },
  { value: "doctor_late", label: "Doctor arrived late" },
  { value: "admin_system", label: "Admin or system issue" },
  { value: "other", label: "Other" },
];

export const APPOINTMENT_TYPES = ["in-person", "virtual"];

export const APPOINTMENT_STATUSES = [
  "booked",
  "confirmed",
  "scheduled",
  "cancelled",
  "delayed",
  "no-show",
];

export const CONFIRMATION_METHODS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "call", label: "Phone call" },
  { value: "email", label: "Email" },
];
