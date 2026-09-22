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
} from "../firebase/firestore";

export default function ReviewPrompt({ appointments, patientId }) {
  const [closed, setClosed] = useState(false);
  const [candidate, setCandidate] = useState(null); // appointment awaiting review
  const [checking, setChecking] = useState(true);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  // Candidate pool: eligible appointments, oldest first. We check them one
  // at a time (rather than fetching all ratings at once) since this is a
  // handful of appointments at most and getDoctorRatingByAppointment is a
  // single cheap getDoc.
  const eligiblePool = useMemo(() => {
    return appointments
      .filter((a) => isReviewEligible(a))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [appointments]);

  useEffect(() => {
    let cancelled = false;

    async function findCandidate() {
      setChecking(true);
      for (const appt of eligiblePool) {
        // eslint-disable-next-line no-await-in-loop -- intentionally
        // sequential: stop at the first unreviewed one instead of
        // firing every lookup at once.
        const existing = await getDoctorRatingByAppointment(appt.id);
        if (cancelled) return;
        if (!existing) {
          setCandidate(appt);
          setChecking(false);
          return;
        }
      }
      if (!cancelled) {
        setCandidate(null);
        setChecking(false);
      }
    }

    if (eligiblePool.length > 0) {
      findCandidate();
    } else {
      setCandidate(null);
      setChecking(false);
    }

    return () => {
      cancelled = true;
    };
  }, [eligiblePool]);

  async function handleSubmit() {
    if (!candidate || rating === 0) {
      setError("Please choose a star rating.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await createDoctorRating({
        appointmentId: candidate.id,
        doctorId: candidate.doctorId,
        patientId,
        rating,
        comment: comment.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError("Could not submit your review. Please try again.");
    }
    setSubmitting(false);
  }

  if (closed || checking || !candidate) return null;

  return (
    <Card className="mb-6 border border-blush">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Star size={18} className="text-amber" fill="currentColor" />
          <h2 className="font-semibold text-ink">
            How was your visit with {candidate.doctorName || "the doctor"}?
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

      {submitted ? (
        <p className="text-sm text-green mt-3">
          Thanks for your feedback!
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-xs text-slate">
            Appointment on {formatShortDate(candidate.date)}
          </p>
          <StarRating value={rating} onChange={setRating} size={28} />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Anything you'd like to add? (optional)"
            className="w-full border border-stone rounded-xl px-4 py-3 text-sm text-ink focus:border-rose focus:outline-none"
          />
          {error && <p className="text-red text-sm">{error}</p>}
          <div className="flex gap-3">
            <Button onClick={handleSubmit} disabled={submitting} size="sm">
              {submitting ? "Submitting..." : "Submit review"}
            </Button>
            <button
              onClick={() => setClosed(true)}
              className="text-sm text-slate underline px-2"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
