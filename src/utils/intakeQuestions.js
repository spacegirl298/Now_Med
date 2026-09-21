// Question definitions for the first-time digital intake form.
//
// The wizard (pages/patient/PatientIntake.jsx) shows ONE of these at a time;
// IntakeSummary renders the same list back as a read-only review, for the
// patient, and for the secretary on the patient's record.
//
// Question shape:
//   id        answer key, stored in intakeForms/{id}.answers[id]
//   section   grouping used for the progress label and the summary
//   type      'text' | 'textarea' | 'tel' | 'date' | 'single' | 'multi' | 'list' | 'consent'
//   label     the question itself
//   help      optional one-line explanation
//   required  blocks Continue until answered (everything else can be skipped)
//   validate  (value) => error string, or '' when fine
//   showIf    (answers) => boolean; hides the question entirely
//   affectsFlow  the answer changes which later questions appear
//   options   for single/multi: [{ value, label }]
//   otherKey  multi only: answer key that stores a free-text "Other"
//   fields / noneLabel / summarize   list-type config (see the list questions)
import {
  GENDER_OPTIONS,
  isValidEmail,
  isValidInternationalPhone,
  isValidMedicalAidNumber,
} from './validators'
import { formatDisplayDate } from './dateHelpers'

export const CHRONIC_CONDITIONS = [
  'Diabetes',
  'Hypertension',
  'Asthma',
  'Heart Disease',
  'Epilepsy',
  'Mental Health Conditions',
]
export const FAMILY_HISTORY_OPTIONS = [
  'Diabetes',
  'Cancer',
  'Stroke',
  'Heart Disease',
  'High Blood Pressure',
  'Mental Illness',
]
export const ALLERGY_TYPES = ['Medication', 'Food', 'Environmental']
export const SEVERITIES = ['Mild', 'Moderate', 'Severe']
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', "I don't know"]

const opts = (list) => list.map((v) => ({ value: v, label: v }))
const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
]

// The only intake answers a patient is allowed to write straight to their
// patientProfiles doc (mirrors patientEditableProfileFields() in the
// Firestore rules). Everything else stays in the intake form until a
// secretary imports it.
export const PROFILE_SYNC_FIELDS = [
  'occupation',
  'maritalStatus',
  'emergencyContactName',
  'emergencyContactPhone',
  'medicalAidProvider',
  'medicalAidNumber',
]

export const PHONE_COUNTRIES = [
  { value: '+27', label: 'South Africa (+27)' },
  { value: '+1', label: 'United States / Canada (+1)' },
  { value: '+44', label: 'United Kingdom (+44)' },
  { value: '+61', label: 'Australia (+61)' },
  { value: '+91', label: 'India (+91)' },
  { value: '+234', label: 'Nigeria (+234)' },
  { value: '+263', label: 'Zimbabwe (+263)' },
  { value: 'other', label: 'Other country' },
]

function validateDob(value) {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return 'Enter a valid date.'
  if (d > new Date()) return "Date of birth can't be in the future."
  if (d.getFullYear() < 1900) return 'Enter a valid date.'
  return ''
}

const phoneRule = (v) => (isValidInternationalPhone(v?.number || v) ? '' : 'Enter 7–15 digits.')
const emailRule = (v) => (isValidEmail(v) ? '' : 'Enter a valid email address.')
const isMinor = (answers) => {
  if (!answers.dateOfBirth) return false
  const dob = new Date(`${answers.dateOfBirth}T00:00:00`)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const beforeBirthday = today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate())
  if (beforeBirthday) age -= 1
  return age < 18
}

const fmtDate = (v) => (v ? formatDisplayDate(v) : '')
const joinParts = (parts, sep = ' · ') => parts.filter(Boolean).join(sep)

export const QUESTIONS = [
  // ---- About you ----
  {
    id: 'dateOfBirth',
    section: 'About you',
    type: 'date',
    label: 'What is your date of birth?',
    help: 'Your doctor uses this to check doses and screening ages.',
    required: true,
    validate: validateDob,
  },
  {
    id: 'gender',
    section: 'About you',
    type: 'single',
    label: 'What is your gender?',
    options: GENDER_OPTIONS,
    required: true,
  },
  {
    id: 'sexAtBirth',
    section: 'About you',
    type: 'single',
    label: 'What sex were you assigned at birth?',
    help: 'This can affect screening, diagnosis, and medication safety.',
    options: opts(['Female', 'Male', 'Intersex', 'Prefer not to say']),
    required: true,
  },
  {
    id: 'preferredName',
    section: 'About you',
    type: 'text',
    label: 'What name should our staff use when speaking with you?',
    placeholder: 'Preferred name',
    required: true,
  },
  {
    id: 'maritalStatus',
    section: 'About you',
    type: 'single',
    label: 'What is your marital status?',
    options: opts([
      'Single',
      'Married',
      'Living with partner',
      'Divorced',
      'Widowed',
      'Prefer not to say',
    ]),
  },
  {
    id: 'occupation',
    section: 'About you',
    type: 'text',
    label: 'What do you do for work?',
    placeholder: 'e.g. Teacher, student, retired',
  },
  {
    id: 'homeAddress',
    section: 'About you',
    type: 'textarea',
    label: 'What is your home address?',
    placeholder: 'Street, suburb, city',
    required: true,
  },
  {
    id: 'contactNumber',
    section: 'About you',
    type: 'phone',
    label: 'What is the best number to reach you on?',
    required: true,
    validate: phoneRule,
  },

  {
    id: 'guardianName',
    section: 'Parent or guardian',
    type: 'text',
    label: 'What is your parent or legal guardian’s full name?',
    showIf: isMinor,
    required: true,
  },
  {
    id: 'guardianRelationship',
    section: 'Parent or guardian',
    type: 'single',
    label: 'What is their relationship to you?',
    options: opts(['Parent', 'Legal guardian', 'Foster parent', 'Other']),
    showIf: isMinor,
    required: true,
  },
  {
    id: 'guardianPhone',
    section: 'Parent or guardian',
    type: 'phone',
    label: 'What is your parent or guardian’s phone number?',
    showIf: isMinor,
    required: true,
    validate: phoneRule,
  },
  {
    id: 'guardianEmail',
    section: 'Parent or guardian',
    type: 'text',
    label: 'What is your parent or guardian’s email address?',
    placeholder: 'name@example.com',
    showIf: isMinor,
    required: true,
    validate: emailRule,
  },

  // ---- Emergency contact ----
  {
    id: 'emergencyContactName',
    section: 'Emergency contact',
    type: 'text',
    label: 'Who should we contact in an emergency?',
    help: 'Their full name.',
    required: true,
  },
  {
    id: 'emergencyContactPhone',
    section: 'Emergency contact',
    type: 'phone',
    label: 'What is their phone number?',
    required: true,
    validate: phoneRule,
  },
  {
    id: 'emergencyContactRelationship',
    section: 'Emergency contact',
    type: 'text',
    label: 'How are they related to you?',
    placeholder: 'e.g. Spouse, parent, friend',
    required: true,
  },

  // ---- Medical aid ----
  {
    id: 'hasMedicalAid',
    section: 'Medical aid',
    type: 'single',
    label: 'Do you have medical aid?',
    options: YES_NO,
    affectsFlow: true,
    required: true,
  },
  {
    id: 'medicalAidProvider',
    section: 'Medical aid',
    type: 'text',
    label: 'Which medical aid are you with?',
    placeholder: 'e.g. Discovery, Bonitas',
    showIf: (a) => a.hasMedicalAid === 'yes',
    required: true,
  },
  {
    id: 'medicalAidNumber',
    section: 'Medical aid',
    type: 'text',
    label: 'What is your member number?',
    help: 'Numbers only.',
    showIf: (a) => a.hasMedicalAid === 'yes',
    validate: (v) => (isValidMedicalAidNumber(v) ? '' : 'Numbers only.'),
    required: true,
  },
  {
    id: 'medicalAidPlan',
    section: 'Medical aid',
    type: 'text',
    label: 'What is your medical aid plan or option?',
    placeholder: 'e.g. Classic Smart, Essential Medical',
    showIf: (a) => a.hasMedicalAid === 'yes',
    required: true,
  },
  {
    id: 'medicalAidDependentCode',
    section: 'Medical aid',
    type: 'text',
    label: 'What is your dependent code?',
    help: 'Usually 00 for the main member, 01 for the first dependent, and so on.',
    placeholder: 'e.g. 00',
    showIf: (a) => a.hasMedicalAid === 'yes',
    required: true,
  },
  {
    id: 'medicalAidPrincipalName',
    section: 'Medical aid',
    type: 'text',
    label: 'If you are not the main member, what is the main member’s full name?',
    showIf: (a) => a.hasMedicalAid === 'yes' && isMinor(a),
    required: true,
  },

  // ---- Your health ----
  {
    id: 'bloodGroup',
    section: 'Your health',
    type: 'single',
    label: 'What is your blood group?',
    help: 'Choose "I don\'t know" if you are not sure.',
    options: opts(BLOOD_GROUPS),
  },
  {
    id: 'chronicConditions',
    section: 'Your health',
    type: 'multi',
    label: 'Do you have any of these ongoing conditions?',
    help: 'Select all that apply.',
    options: opts(CHRONIC_CONDITIONS),
    otherKey: 'otherConditions',
  },
  {
    id: 'allergies',
    section: 'Your health',
    type: 'list',
    label: 'Do you have any allergies?',
    noneLabel: 'No known allergies',
    addLabel: 'Add allergy',
    fields: [
      { key: 'allergen', label: 'What are you allergic to?', placeholder: 'e.g. Penicillin, peanuts', required: true },
      { key: 'type', label: 'Type', options: ALLERGY_TYPES },
      { key: 'severity', label: 'How severe?', options: SEVERITIES },
      { key: 'reaction', label: 'Reaction (optional)', placeholder: 'e.g. Rash, swelling' },
    ],
    summarize: (a) =>
      joinParts([a.allergen, joinParts([a.severity, a.reaction], ', ')], ' – '),
  },
  {
    id: 'currentMedications',
    section: 'Your health',
    type: 'list',
    label: 'Are you taking any medication at the moment?',
    help: 'Include prescription, over-the-counter and chronic medication.',
    noneLabel: 'No current medication',
    addLabel: 'Add medication',
    fields: [
      { key: 'name', label: 'Medication', placeholder: 'e.g. Metformin', required: true },
      { key: 'dosage', label: 'Dosage (optional)', placeholder: 'e.g. 500mg' },
      { key: 'frequency', label: 'How often (optional)', placeholder: 'e.g. Twice a day' },
    ],
    summarize: (m) => joinParts([m.name, m.dosage, m.frequency]),
  },
  {
    id: 'previousSurgeries',
    section: 'Your health',
    type: 'list',
    label: 'Have you had any surgeries?',
    noneLabel: 'No previous surgeries',
    addLabel: 'Add surgery',
    fields: [
      { key: 'procedure', label: 'Procedure', placeholder: 'e.g. Appendectomy', required: true },
      { key: 'hospital', label: 'Hospital (optional)' },
      { key: 'date', label: 'Date (optional)', type: 'date' },
    ],
    summarize: (s) => joinParts([s.procedure, s.hospital, fmtDate(s.date)]),
  },
  {
    id: 'hospitalAdmissions',
    section: 'Your health',
    type: 'list',
    label: 'Have you ever been admitted to hospital?',
    help: 'Not counting surgeries you already listed.',
    noneLabel: 'No hospital admissions',
    addLabel: 'Add admission',
    fields: [
      { key: 'hospital', label: 'Hospital', required: true },
      { key: 'admissionDate', label: 'Admitted on (optional)', type: 'date' },
      { key: 'reason', label: 'Reason (optional)' },
    ],
    summarize: (a) => joinParts([a.hospital, fmtDate(a.admissionDate), a.reason]),
  },
  {
    id: 'familyHistory',
    section: 'Your health',
    type: 'multi',
    label: 'Does anything run in your family?',
    help: 'Close relatives such as parents and siblings. Select all that apply.',
    options: opts(FAMILY_HISTORY_OPTIONS),
  },

  // ---- Lifestyle ----
  {
    id: 'smoking',
    section: 'Lifestyle',
    type: 'single',
    label: 'Do you smoke?',
    options: opts(['Never', 'Used to', 'Yes, currently']),
  },
  {
    id: 'alcohol',
    section: 'Lifestyle',
    type: 'single',
    label: 'How often do you drink alcohol?',
    options: opts(['Never', 'Occasionally', 'Regularly']),
  },

  // ---- Finishing up ----
  {
    id: 'reasonForJoining',
    section: 'Finishing up',
    type: 'textarea',
    label: 'Is there anything you want the doctor to know?',
    help: 'For example, why you are booking, or a concern you have.',
    placeholder: 'Optional',
  },
  {
    id: 'consent',
    section: 'Finishing up',
    type: 'consent',
    label: 'Confirm your answers',
    consentText:
      'I confirm that the information I have given is accurate to the best of my knowledge, and I agree to the practice storing it in my medical record.',
    required: true,
  },
]

export function getVisibleQuestions(answers = {}) {
  return QUESTIONS.filter((q) => !q.showIf || q.showIf(answers))
}

// Turns one answer into display lines. Returns null when unanswered, so the
// summary can show "Not answered" instead of an empty row.
export function formatAnswer(q, answers = {}) {
  const v = answers[q.id]
  switch (q.type) {
    case 'date':
      return v ? [formatDisplayDate(v)] : null
    case 'phone':
      if (typeof v === 'string') return v.trim() ? [v.trim()] : null
      return v?.number?.trim() ? [`${v.country || ''} ${v.number.trim()}`.trim()] : null
    case 'single': {
      if (!v) return null
      return [q.options.find((o) => o.value === v)?.label || v]
    }
    case 'multi': {
      if (v === undefined) return null
      const other = q.otherKey ? (answers[q.otherKey] || '').trim() : ''
      const lines = [...v, ...(other ? [other] : [])]
      return lines.length ? lines : ['None']
    }
    case 'list': {
      if (!Array.isArray(v)) return null
      return v.length ? v.map(q.summarize) : [q.noneLabel]
    }
    case 'consent':
      return v ? ['Confirmed'] : null
    default:
      return v && String(v).trim() ? [String(v).trim()] : null
  }
}

// Maps patient-reported intake answers onto the verified patientProfiles
// shape used by the secretary's record. It only FILLS EMPTY fields - anything
// the practice already entered is never overwritten. Returns just the fields
// that would change (empty object = nothing to import).
export function intakeToProfileUpdates(answers = {}, profile = {}) {
  const updates = {}
  const p = profile || {}
  const isEmptyList = (v) => !Array.isArray(v) || v.length === 0
  const note = 'Patient-reported (intake form)'

  ;['dateOfBirth', 'gender', 'bloodGroup'].forEach((f) => {
    if (!p[f] && answers[f] && answers[f] !== "I don't know") updates[f] = answers[f]
  })

  if (isEmptyList(p.chronicConditions) && answers.chronicConditions?.length) {
    updates.chronicConditions = answers.chronicConditions
  }
  if (!p.otherConditions && answers.otherConditions?.trim()) {
    updates.otherConditions = answers.otherConditions.trim()
  }
  if (isEmptyList(p.familyHistory) && answers.familyHistory?.length) {
    updates.familyHistory = answers.familyHistory
  }
  if (isEmptyList(p.allergies) && answers.allergies?.length) {
    updates.allergies = answers.allergies.map((a) => ({
      allergen: a.allergen,
      type: a.type || 'Medication',
      severity: a.severity || 'Mild',
      reaction: a.reaction || '',
      notes: note,
    }))
  }
  if (isEmptyList(p.currentMedications) && answers.currentMedications?.length) {
    updates.currentMedications = answers.currentMedications.map((m) => ({
      name: m.name,
      dosage: m.dosage || '',
      frequency: m.frequency || '',
      startDate: '',
      endDate: '',
      prescribingDoctor: '',
      notes: note,
    }))
  }
  if (isEmptyList(p.previousSurgeries) && answers.previousSurgeries?.length) {
    updates.previousSurgeries = answers.previousSurgeries.map((s) => ({
      procedure: s.procedure,
      hospital: s.hospital || '',
      date: s.date || '',
      notes: note,
    }))
  }
  if (isEmptyList(p.hospitalAdmissions) && answers.hospitalAdmissions?.length) {
    updates.hospitalAdmissions = answers.hospitalAdmissions.map((a) => ({
      hospital: a.hospital,
      admissionDate: a.admissionDate || '',
      dischargeDate: '',
      reason: a.reason || '',
    }))
  }
  return updates
}