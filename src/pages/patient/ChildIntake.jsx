// /patient/family/:childId/intake
// A parent filling in their child's intake form. It is the same wizard an
// adult uses for their own form (components/IntakeWizard.jsx), run on the
// child version of the questions (utils/intakeQuestions.js, formType 'child').
//
// The form is saved to `intakeForms` with the CHILD's id as patientId - like
// everything else about a child - so it shows on the child's record for the
// practice, and moves to the child's own account at hand-over.
//
// Unlike an adult, the parent cannot write the child's clinical profile, so
// nothing is copied across here: staff review the form and import it from the
// child's record (PatientRecordModal > Intake form > Import into profile).
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  subscribeToChild,
  markChildIntakeCompleted,
} from "../../firebase/family";
import { getIntakeForm, saveIntakeForm } from "../../firebase/firestore";
import { isManageable } from "../../utils/childAge";
import { CHILD_FORM_TYPE } from "../../utils/intakeQuestions";
import PatientLayout from "./PatientLayout";
import IntakeWizard from "../../components/IntakeWizard";
import EmptyState from "../../components/EmptyState";

// The family page says mother / father / ...; the intake form's own list is
// Parent / Legal guardian / Foster parent / Other.
const RELATIONSHIP_TO_INTAKE = {
  mother: "Parent",
  father: "Parent",
  legal_guardian: "Legal guardian",
  other: "Other",
};

export default function ChildIntake() {
  const { childId } = useParams();
  const { currentUser, userName } = useAuth();
  const navigate = useNavigate();
  const [child, setChild] = useState(undefined); // undefined = loading, null = unavailable
  const [existing, setExisting] = useState(undefined); // undefined = checking, null = none yet

  useEffect(() => {
    const unsub = subscribeToChild(childId, setChild, (err) => {
      console.error("Could not load child profile:", err);
      setChild(null);
    });
    return () => unsub && unsub();
  }, [childId]);

  const allowed =
    !!child &&
    child.guardianIds?.includes(currentUser?.uid) &&
    isManageable(child) &&
    child.verificationStatus !== "rejected";

  // One-time check: a submitted form is immutable, so don't take a second one.
  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    getIntakeForm(childId)
      .then((form) => !cancelled && setExisting(form))
      .catch((err) => {
        console.error("Could not check for an existing intake form:", err);
        if (!cancelled) setExisting(null);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, childId]);

  const childPage = `/patient/family/${childId}`;

  // Prefill what we already know about the parent so they are not asked twice.
  const initialAnswers = useMemo(() => {
    if (!child) return {};
    const me = child.guardians?.[currentUser?.uid];
    return {
      preferredName: child.firstName || "",
      guardianName: me?.name || userName || currentUser?.displayName || "",
      guardianRelationship: RELATIONSHIP_TO_INTAKE[me?.relationship] || "",
      guardianEmail: currentUser?.email || "",
    };
  }, [child, currentUser, userName]);

  const childDob = child?.dateOfBirth || "";

  const lockedAnswers = useMemo(
    () => ({ formType: CHILD_FORM_TYPE, dateOfBirth: childDob }),
    [childDob],
  );

  async function handleSubmit(clean) {
    // Re-check right before saving in case it was submitted from another tab.
    const already = await getIntakeForm(child.id).catch(() => null);
    if (!already) {
      await saveIntakeForm({
        patientId: child.id,
        patientIdNumber: child.idNumber || "",
        answers: clean,
        submittedBy: "guardian",
      });
    }
    markChildIntakeCompleted(child.id).catch((err) =>
      console.error(
        "Intake saved, but the child profile could not be flagged:",
        err,
      ),
    );
    navigate(childPage, { replace: true, state: { tab: "records" } });
  }

  if (child === undefined || (allowed && existing === undefined)) {
    return (
      <PatientLayout>
        <p className="text-sm text-slate text-center py-16">Loading...</p>
      </PatientLayout>
    );
  }

  if (!allowed) {
    return (
      <PatientLayout>
        <div className="p-4 sm:p-6 md:p-8 max-w-3xl mx-auto">
          <EmptyState
            icon={ShieldAlert}
            title="We can't open this form"
            message="This profile may not exist, or you may no longer have access to it."
            actionLabel="Back to family"
            onAction={() => navigate("/patient/family")}
          />
        </div>
      </PatientLayout>
    );
  }

  if (existing) {
    return (
      <PatientLayout>
        <div className="p-4 sm:p-6 md:p-8 max-w-3xl mx-auto">
          <EmptyState
            icon={CheckCircle2}
            title={`${child.firstName}'s intake form is already in`}
            message="The practice has it. If something needs correcting, message the practice from their page."
            actionLabel={`Back to ${child.firstName}`}
            onAction={() => navigate(childPage)}
          />
        </div>
      </PatientLayout>
    );
  }

  return (
    <IntakeWizard
      initialAnswers={initialAnswers}
      lockedAnswers={lockedAnswers}
      intro={{
        eyebrow: "Intake form",
        title: `${child.firstName}'s health history`,
        lead: `Let's give the practice a clear picture of ${child.firstName}'s health before their visit.`,
        body: `You'll answer one focused question at a time, as ${child.firstName}'s parent or guardian. Required questions are marked with an asterisk; optional questions can be skipped. Have their Road to Health card and medical aid card to hand if you can.`,
        privacy: "Only you and the practice",
        startLabel: "Start intake form",
        laterLabel: "Do this later",
      }}
      onLater={() => navigate(childPage)}
      onSubmit={handleSubmit}
    />
  );
}
