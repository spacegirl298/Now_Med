
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

export const CHILD_FORM_TYPE = 'child'
export const isChildForm = (answers = {}) => answers.formType === CHILD_FORM_TYPE

const fmtDate = (v) => (v ? formatDisplayDate(v) : '')
const joinParts = (parts, sep = ' · ') => parts.filter(Boolean).join(sep)

export const QUESTIONS = [
  // About you
  {
    id: 'dateOfBirth',
    adultOnly: true,
    section: 'About you',
    type: 'date',
    label: 'What is your date of birth?',
    help: 'Your doctor uses this to check doses and screening ages.',
    required: true,
    validate: validateDob,
  },
  {
    id: 'gender',
    child: {
      label: 'What is your child’s gender?',
    },
    section: 'About you',
    type: 'single',
    label: 'What is your gender?',
    options: GENDER_OPTIONS,
    required: true,
  },
  {
    id: 'sexAtBirth',
    child: {
      label: 'What sex was your child assigned at birth?',
      help: 'This can affect diagnosis and medication safety.',
    },
    section: 'About you',
    type: 'single',
    label: 'What sex were you assigned at birth?',
    help: 'This can affect screening, diagnosis, and medication safety.',
    options: opts(['Female', 'Male', 'Intersex', 'Prefer not to say']),
    required: true,
  },
  {
    id: 'preferredName',
    child: {
      label: 'What does your child like to be called?',
      placeholder: 'Nickname or preferred name',
      required: false,
    },
    section: 'About you',
    type: 'text',
    label: 'What name should our staff use when speaking with you?',
    placeholder: 'Preferred name',
    required: true,
  },
  {
    id: 'maritalStatus',
    adultOnly: true,
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
    adultOnly: true,
    section: 'About you',
    type: 'text',
    label: 'What do you do for work?',
    placeholder: 'e.g. Teacher, student, retired',
  },
  {
    id: 'homeAddress',
    child: {
      label: 'What is your child’s home address?',
    },
    section: 'About you',
    type: 'textarea',
    label: 'What is your home address?',
    placeholder: 'Street, suburb, city',
    required: true,
  },
  {
    id: 'contactNumber',
    adultOnly: true,
    section: 'About you',
    type: 'phone',
    label: 'What is the best number to reach you on?',
    required: true,
    validate: phoneRule,
  },

  {
    id: 'guardianName',
    child: {
      section: 'About you (parent or guardian)',
      label: 'What is your full name?',
      help: 'You are filling in this form for your child.',
    },
    section: 'Parent or guardian',
    type: 'text',
    label: 'What is your parent or legal guardian’s full name?',
    showIf: isMinor,
    required: true,
  },
  {
    id: 'guardianRelationship',
    child: {
      section: 'About you (parent or guardian)',
      label: 'What is your relationship to the child?',
    },
    section: 'Parent or guardian',
    type: 'single',
    label: 'What is their relationship to you?',
    options: opts(['Parent', 'Legal guardian', 'Foster parent', 'Other']),
    showIf: isMinor,
    required: true,
  },
  {
    id: 'guardianPhone',
    child: {
      section: 'About you (parent or guardian)',
      label: 'What is the best number to reach you on?',
    },
    section: 'Parent or guardian',
    type: 'phone',
    label: 'What is your parent or guardian’s phone number?',
    showIf: isMinor,
    required: true,
    validate: phoneRule,
  },
  {
    id: 'guardianEmail',
    child: {
      section: 'About you (parent or guardian)',
      label: 'What is your email address?',
    },
    section: 'Parent or guardian',
    type: 'text',
    label: 'What is your parent or guardian’s email address?',
    placeholder: 'name@example.com',
    showIf: isMinor,
    required: true,
    validate: emailRule,
  },

  // Emergency contact
  {
    id: 'emergencyContactName',
    child: {
      label: 'Who else can we contact if we cannot reach you?',
      help: 'Their full name. Leave this out if there is nobody else.',
      required: false,
    },
    section: 'Emergency contact',
    type: 'text',
    label: 'Who should we contact in an emergency?',
    help: 'Their full name.',
    required: true,
  },
  {
    id: 'emergencyContactPhone',
    child: {
      required: false,
    },
    section: 'Emergency contact',
    type: 'phone',
    label: 'What is their phone number?',
    required: true,
    validate: phoneRule,
  },
  {
    id: 'emergencyContactRelationship',
    child: {
      label: 'How are they related to your child?',
      placeholder: 'e.g. Grandparent, aunt, family friend',
      required: false,
    },
    section: 'Emergency contact',
    type: 'text',
    label: 'How are they related to you?',
    placeholder: 'e.g. Spouse, parent, friend',
    required: true,
  },

  // Medical aid
  {
    id: 'hasMedicalAid',
    child: {
      label: 'Is your child covered by medical aid?',
    },
    section: 'Medical aid',
    type: 'single',
    label: 'Do you have medical aid?',
    options: YES_NO,
    affectsFlow: true,
    required: true,
  },
  {
    id: 'medicalAidProvider',
    child: {
      label: 'Which medical aid covers your child?',
    },
    section: 'Medical aid',
    type: 'text',
    label: 'Which medical aid are you with?',
    placeholder: 'e.g. Discovery, Bonitas',
    showIf: (a) => a.hasMedicalAid === 'yes',
    required: true,
  },
  {
    id: 'medicalAidNumber',
    child: {
      label: 'What is the main member’s number?',
    },
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
    child: {
      label: 'What is the medical aid plan or option?',
    },
    section: 'Medical aid',
    type: 'text',
    label: 'What is your medical aid plan or option?',
    placeholder: 'e.g. Classic Smart, Essential Medical',
    showIf: (a) => a.hasMedicalAid === 'yes',
    required: true,
  },
  {
    id: 'medicalAidDependentCode',
    child: {
      label: 'What is your child’s dependent code?',
      help: 'Usually 01 for the first dependent, 02 for the second, and so on.',
      placeholder: 'e.g. 01',
    },
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
    child: {
      label: 'What is the main member’s full name?',
    },
    section: 'Medical aid',
    type: 'text',
    label: 'If you are not the main member, what is the main member’s full name?',
    showIf: (a) => a.hasMedicalAid === 'yes' && isMinor(a),
    required: true,
  },

  {
    id: 'birthHistory',
    section: 'Birth and development',
    type: 'single',
    childOnly: true,
    label: 'Was your child born full term?',
    help: 'Full term is 37 weeks or more.',
    options: opts(['Full term', 'Premature', 'Not sure']),
  },
  {
    id: 'birthWeight',
    section: 'Birth and development',
    type: 'text',
    childOnly: true,
    label: 'What was your child’s birth weight?',
    help: 'It is usually on the Road to Health card. Optional.',
    placeholder: 'e.g. 3.2 kg',
  },
  {
    id: 'immunisations',
    section: 'Birth and development',
    type: 'single',
    childOnly: true,
    label: 'Are your child’s vaccinations up to date?',
    help: 'Check the Road to Health card if you are not sure.',
    options: opts(['Up to date', 'Behind schedule', 'Not vaccinated', 'Not sure']),
  },
  {
    id: 'developmentConcerns',
    section: 'Birth and development',
    type: 'textarea',
    childOnly: true,
    label: 'Do you have any concerns about your child’s growth, development or behaviour?',
    help: 'For example speech, walking, hearing, sleep or school progress. Optional.',
    placeholder: 'Optional',
  },
  {
    id: 'schoolOrCreche',
    section: 'Birth and development',
    type: 'text',
    childOnly: true,
    label: 'Which school or creche does your child attend?',
    placeholder: 'Optional',
  },

  // Your health
  {
    id: 'bloodGroup',
    child: {
      label: 'What is your child’s blood group?',
    },
    section: 'Your health',
    type: 'single',
    label: 'What is your blood group?',
    help: 'Choose "I don\'t know" if you are not sure.',
    options: opts(BLOOD_GROUPS),
  },
  {
    id: 'chronicConditions',
    child: {
      label: 'Does your child have any of these ongoing conditions?',
    },
    section: 'Your health',
    type: 'multi',
    label: 'Do you have any of these ongoing conditions?',
    help: 'Select all that apply.',
    options: opts(CHRONIC_CONDITIONS),
    otherKey: 'otherConditions',
  },
  {
    id: 'allergies',
    child: {
      label: 'Does your child have any allergies?',
      fields: [
        { key: 'allergen', label: 'What are they allergic to?', placeholder: 'e.g. Penicillin, peanuts, eggs', required: true },
        { key: 'type', label: 'Type', options: ALLERGY_TYPES },
        { key: 'severity', label: 'How severe?', options: SEVERITIES },
        { key: 'reaction', label: 'Reaction (optional)', placeholder: 'e.g. Rash, swelling' },
      ],
    },
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
    child: {
      label: 'Is your child taking any medication at the moment?',
      help: 'Include prescription, over-the-counter, chronic medication, vitamins and supplements.',
    },
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
    child: {
      label: 'Has your child had any surgeries?',
    },
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
    child: {
      label: 'Has your child ever been admitted to hospital?',
    },
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
    child: {
      label: 'Does anything run in the family?',
      help: 'Close relatives such as parents, grandparents and siblings. Select all that apply.',
    },
    section: 'Your health',
    type: 'multi',
    label: 'Does anything run in your family?',
    help: 'Close relatives such as parents and siblings. Select all that apply.',
    options: opts(FAMILY_HISTORY_OPTIONS),
  },

  // Lifestyle
  {
    id: 'smoking',
    adultOnly: true,
    section: 'Lifestyle',
    type: 'single',
    label: 'Do you smoke?',
    options: opts(['Never', 'Used to', 'Yes, currently']),
  },
  {
    id: 'alcohol',
    adultOnly: true,
    section: 'Lifestyle',
    type: 'single',
    label: 'How often do you drink alcohol?',
    options: opts(['Never', 'Occasionally', 'Regularly']),
  },

  // Finishing up
  {
    id: 'reasonForJoining',
    child: {
      label: 'Is there anything you want the doctor to know about your child?',
      help: 'For example, why you are booking, or a concern you have.',
    },
    section: 'Finishing up',
    type: 'textarea',
    label: 'Is there anything you want the doctor to know?',
    help: 'For example, why you are booking, or a concern you have.',
    placeholder: 'Optional',
  },
  {
    id: 'consent',
    child: {
      consentText:
        'I confirm that I am this child’s parent or legal guardian, that the information I have given is accurate to the best of my knowledge, and that I agree to the practice storing it in my child’s medical record.',
    },
    section: 'Finishing up',
    type: 'consent',
    label: 'Confirm your answers',
    consentText:
      'I confirm that the information I have given is accurate to the best of my knowledge, and I agree to the practice storing it in my medical record.',
    required: true,
  },
]

export function getVisibleQuestions(answers = {}) {
  const child = isChildForm(answers)
  return QUESTIONS.filter((q) => (child ? !q.adultOnly : !q.childOnly))
    .filter((q) => !q.showIf || q.showIf(answers))
    .map((q) => (child && q.child ? { ...q, ...q.child } : q))
}

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

export function intakeToProfileUpdates(answers = {}, profile = {}) {
  const updates = {}
  const p = profile || {}
  const isEmptyList = (v) => !Array.isArray(v) || v.length === 0
  const note = 'Patient-reported (intake form)'

  ;['dateOfBirth', 'gender', 'bloodGroup'].forEach((f) => {
    if (!p[f] && answers[f] && answers[f] !== "I don't know") updates[f] = answers[f]
  })

  const child = isChildForm(answers)
  const contactName = answers.emergencyContactName || (child ? answers.guardianName : '')
  const contactPhone = answers.emergencyContactPhone || (child ? answers.guardianPhone : '')
  const phoneText = (v) =>
    typeof v === 'string' ? v.trim() : v?.number ? `${v.country || ''} ${v.number}`.trim() : ''
  if (!p.emergencyContactName && contactName) updates.emergencyContactName = contactName
  if (!p.emergencyContactPhone && phoneText(contactPhone)) {
    updates.emergencyContactPhone = phoneText(contactPhone)
  }
  ;['medicalAidProvider', 'medicalAidNumber'].forEach((f) => {
    if (!p[f] && answers[f]) updates[f] = answers[f]
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