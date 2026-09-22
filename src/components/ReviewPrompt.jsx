// Dashboard card prompting a review for a completed, unreviewed
// appointment. Surfaces the OLDEST eligible unreviewed appointment first
// (rather than the most recent) so a backlog gets worked through in order
// instead of only ever nagging about the latest visit.
//
// "Close" only hides this render - there's no persisted dismissal. Since
// eligibility is recomputed from real data every time, it reappears next
// visit if still unreviewed. That's deliberate (see the brief: "close or
// come back to it later").
import { useEffect, useMemo, useState } from "react";
import { Star, X } from "lucide-react";
import Card from "./Card";
import Button from "./Button";
import StarRating from "./StarRating";
import { isReviewEligible, formatShortDate } from "../utils/dateHelpers";
import {
  getDoctorRatingByAppointment,
  createDoctorRating,
  getDoctorById,
} from "../firebase/firestore";

export default function ReviewPrompt({
  appointments,
  patientId,
  bufferMinutes = 15,
}) {
  const [closed, setClosed] = useState(false);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [checking, setChecking] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [submittingById, setSubmittingById] = useState({});
  const [submittedIds, setSubmittedIds] = useState([]);
  const [resolvedDoctorNames, setResolvedDoctorNames] = useState({});
  const [errors, setErrors] = useState({});

  // Candidate pool: eligible appointments, oldest first. We check them one
  // at a time because getDoctorRatingByAppointment is a single getDoc and we
  // want to surface every unreviewed visit, not just the first one.
  const eligiblePool = useMemo(() => {
    return appointments
      .filter((a) => isReviewEligible(a, bufferMinutes))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [appointments, bufferMinutes]);

  useEffect(() => {
    if (pendingReviews.length > 0 && !expandedId) {
      setExpandedId(pendingReviews[0].id);
    }
  }, [pendingReviews, expandedId]);

  useEffect(() => {
    if (pendingReviews.length > 0) {
      setClosed(false);
    }
  }, [pendingReviews.length]);

  useEffect(() => {
    let cancelled = false;

    async function resolveDoctorNames() {
      const nextNames = {};

      for (const appt of eligiblePool) {
        if (appt.doctorName) {
          nextNames[appt.id] = appt.doctorName;
          continue;
        }

        if (!appt.doctorId) {
          nextNames[appt.id] = "Your doctor";
          continue;
        }

        try {
          const doctor = await getDoctorById(appt.doctorId);
          nextNames[appt.id] = doctor?.name || "Your doctor";
        } catch (err) {
          console.error("Failed to resolve doctor name for review:", err);
          nextNames[appt.id] = "Your doctor";
        }
      }

      if (!cancelled) {
        setResolvedDoctorNames(nextNames);
      }
    }

    resolveDoctorNames();

    return () => {
      cancelled = true;
    };
  }, [eligiblePool]);

  useEffect(() => {
    let cancelled = false;

    async function findPendingReviews() {
      setChecking(true);
      const nextPending = [];

      for (const appt of eligiblePool) {
        let existing;
        try {
          existing = await getDoctorRatingByAppointment(appt.id);
        } catch (err) {
          console.error("Failed to check existing review:", err);
          continue;
        }

        if (cancelled) return;
        if (!existing) {
          nextPending.push(appt);
        }
      }

      if (!cancelled) {
        setPendingReviews(nextPending);
        setChecking(false);
      }
    }

    if (eligiblePool.length > 0) {
      findPendingReviews();
    } else {
      setPendingReviews([]);
      setChecking(false);
    }

    return () => {
      cancelled = true;
    };
  }, [eligiblePool]);

  function updateDraft(appointmentId, next) {
    setDrafts((prev) => ({
      ...prev,
      [appointmentId]: { ...(prev[appointmentId] || {}), ...next },
    }));
  }

  async function handleSubmit(appointment) {
    const draft = drafts[appointment.id] || { rating: 0, comment: "" };
    if (!appointment || draft.rating === 0) {
      setErrors((prev) => ({
        ...prev,
        [appointment.id]: "Please choose a star rating.",
      }));
      return;
    }

    setSubmittingById((prev) => ({ ...prev, [appointment.id]: true }));
    setErrors((prev) => ({ ...prev, [appointment.id]: "" }));

    try {
      await createDoctorRating({
        appointmentId: appointment.id,
        doctorId: appointment.doctorId,
        patientId,
        rating: draft.rating,
        comment: (draft.comment || "").trim(),
      });

      setSubmittedIds((prev) => [...prev, appointment.id]);
      setPendingReviews((prev) =>
        prev.filter((item) => item.id !== appointment.id),
      );
    } catch (err) {
      console.error(err);
      setErrors((prev) => ({
        ...prev,
        [appointment.id]: "Could not submit your review. Please try again.",
      }));
    } finally {
      setSubmittingById((prev) => ({ ...prev, [appointment.id]: false }));
    }
  }

  if (!patientId || !appointments?.length) return null;
  if (checking) return null;
  if (closed || pendingReviews.length === 0) return null;

  return (
    <Card className="mb-6 border border-blush">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Star size={18} className="text-amber" fill="currentColor" />
          <h2 className="font-semibold text-ink">
            Past visits waiting for review
          </h2>
        </div>
        <button
          onClick={() => setClosed(true)}
          aria-label="Close"
          className="text-slate hover:text-ink shrink-0"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-3">
        {pendingReviews
          .filter((appt) => !submittedIds.includes(appt.id))
          .map((appt) => {
            const isOpen = expandedId === appt.id;
            const draft = drafts[appt.id] || { rating: 0, comment: "" };
            const isSubmitting = !!submittingById[appt.id];
            const error = errors[appt.id];

            const doctorLabel =
              resolvedDoctorNames[appt.id] || appt.doctorName || "Your doctor";

            return (
              <div
                key={appt.id}
                className="rounded-xl border border-stone bg-mist/30"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId((prev) => (prev === appt.id ? null : appt.id))
                  }
                  className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-medium text-ink">{doctorLabel}</p>
                    <p className="text-xs text-slate">
                      {formatShortDate(appt.date)} · {appt.time}
                    </p>
                  </div>
                  <span className="rounded-full bg-rose text-white px-3 py-1.5 text-xs font-medium">
                    Leave a review
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-stone px-4 py-4">
                    <div className="mb-3">
                      <p className="font-medium text-ink">
                        How was your visit with {doctorLabel}?
                      </p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <StarRating
                        value={draft.rating}
                        onChange={(rating) => updateDraft(appt.id, { rating })}
                        size={28}
                      />
                      <textarea
                        value={draft.comment}
                        onChange={(e) =>
                          updateDraft(appt.id, { comment: e.target.value })
                        }
                        rows={2}
                        placeholder="Anything you'd like to add? (optional)"
                        className="w-full border border-stone rounded-xl px-4 py-3 text-sm text-ink focus:border-rose focus:outline-none"
                      />
                      {error && <p className="text-red text-sm">{error}</p>}
                      <div className="flex gap-3">
                        <Button
                          onClick={() => handleSubmit(appt)}
                          disabled={isSubmitting}
                          size="sm"
                        >
                          {isSubmitting ? "Submitting..." : "Submit review"}
                        </Button>
                        <button
                          onClick={() => setExpandedId(null)}
                          className="text-sm text-slate underline px-2"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </Card>
  );
}
