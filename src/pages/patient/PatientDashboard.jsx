// Patient landing screen: today's greeting, a snapshot of the patient's own
// appointments and records, a delay banner if the next visit is running late,
// and quick access into the booking calendar. Patients only ever see their
// own data here - never other patients' appointments (see useAppointments,
// which scopes the Firestore query by role).
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarPlus,
  Clock,
  FileText,
  CalendarCheck,
  CalendarClock,
  Stethoscope,
  Phone,
  ClipboardList,
  MessageSquare,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useAppointments } from "../../hooks/useAppointments";
import PatientLayout from "./PatientLayout";
import Card from "../../components/Card";
import Badge from "../../components/Badge";
import EmptyState from "../../components/EmptyState";
import StarRating from "../../components/StarRating";
import ReviewPrompt from "../../components/ReviewPrompt";
import PatientETA from "../../components/PatientETA";
import {
  getTodayString,
  formatTime,
  formatShortDate,
  formatDisplayDate,
  greetingForNow,
} from "../../utils/dateHelpers";
import {
  subscribeToPatientRecords,
  subscribeToDoctorRatings,
  subscribeToPatientReviews,
  getDoctors,
  updateDoctorRating,
} from "../../firebase/firestore";

export default function PatientDashboard() {
  const { currentUser, userName, intakeCompleted } = useAuth();
  const { appointments, loading, error } = useAppointments();
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [myReviews, setMyReviews] = useState([]);
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [savingReviewId, setSavingReviewId] = useState(null);
  const [reviewErrors, setReviewErrors] = useState({});
  const [now] = useState(() => Date.now());
  const [ratingsByDoctor, setRatingsByDoctor] = useState({}); // doctorId -> reviews[]
  const [expandedReviews, setExpandedReviews] = useState(null); // doctorId or null

  useEffect(() => {
    if (!currentUser) return;
    // Live subscription (rather than a one-time fetch) so a record the
    // secretary adds or edits appears here within moments. Staff-only
    // entries are never shown on the patient side.
    const unsub = subscribeToPatientRecords(currentUser.uid, (list) =>
      setRecords(list.filter((r) => !r.internalOnly)),
    );
    return () => unsub && unsub();
  }, [currentUser]);

  useEffect(() => {
    // One-time fetch is enough here - the doctor list changes rarely, unlike
    // appointments and records which need live updates.
    getDoctors()
      .then(setDoctors)
      .catch(() => setDoctors([]));
  }, []);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribeToPatientReviews(currentUser.uid, setMyReviews);
    return () => unsub && unsub();
  }, [currentUser?.uid]);

  useEffect(() => {
    if (doctors.length === 0) return;
    const unsubs = doctors.map((d) =>
      subscribeToDoctorRatings(d.id, (reviews) => {
        setRatingsByDoctor((prev) => ({ ...prev, [d.id]: reviews }));
      }),
    );
    return () => unsubs.forEach((unsub) => unsub && unsub());
  }, [doctors]);

  const today = getTodayString();
  const displayName = userName || currentUser?.email?.split("@")[0] || "there";

  const upcomingAppointments = useMemo(() => {
    const nowMs = Date.now();
    return appointments
      .filter((a) => {
        if (a.status === "cancelled") return false;
        const start = a.appointmentAt?.toDate
          ? a.appointmentAt.toDate()
          : new Date(`${a.date}T${a.time}:00`);
        return start.getTime() >= nowMs;
      })
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [appointments]);

  const nextAppointment = upcomingAppointments[0] || null;
  const isNextDelayed = nextAppointment?.status === "delayed";

  // New vs returning patient, for the arrival-buffer recommendation in
  // PatientETA: "new" means no prior non-cancelled appointment before this
  // one. Derived from data we already have (useAppointments), no extra
  // query needed. Same-day earlier visits aren't accounted for - an edge
  // case rare enough not to be worth the extra complexity here.
  const isNewPatient = useMemo(() => {
    if (!nextAppointment) return true;
    return !appointments.some(
      (a) =>
        a.id !== nextAppointment.id &&
        a.status !== "cancelled" &&
        a.date < nextAppointment.date,
    );
  }, [appointments, nextAppointment]);

  const nextAppointmentDoctor = nextAppointment
    ? doctors.find((d) => d.id === nextAppointment.doctorId)
    : null;

  const doctorVisitCounts = useMemo(() => {
    const counts = {};
    appointments.forEach((appointment) => {
      if (!appointment.doctorId || appointment.status === "cancelled") return;
      counts[appointment.doctorId] = (counts[appointment.doctorId] || 0) + 1;
    });
    return counts;
  }, [appointments]);

  const orderedDoctors = useMemo(
    () =>
      [...doctors].sort((a, b) => {
        const diff =
          (doctorVisitCounts[b.id] || 0) - (doctorVisitCounts[a.id] || 0);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      }),
    [doctors, doctorVisitCounts],
  );

  const startReviewEdit = (review) => {
    setEditingReviewId(review.id);
    setReviewDrafts((prev) => ({
      ...prev,
      [review.id]: {
        rating: review.rating || 0,
        comment: review.comment || "",
      },
    }));
    setReviewErrors((prev) => ({ ...prev, [review.id]: "" }));
  };

  const saveReviewEdit = async (review) => {
    const draft = reviewDrafts[review.id] || {
      rating: review.rating || 0,
      comment: review.comment || "",
    };

    if (!draft.rating || draft.rating === 0) {
      setReviewErrors((prev) => ({
        ...prev,
        [review.id]: "Please choose a star rating.",
      }));
      return;
    }

    setSavingReviewId(review.id);
    setReviewErrors((prev) => ({ ...prev, [review.id]: "" }));

    try {
      await updateDoctorRating(review.appointmentId, {
        rating: draft.rating,
        comment: (draft.comment || "").trim(),
      });
      setEditingReviewId(null);
      setReviewDrafts((prev) => ({ ...prev, [review.id]: undefined }));
    } catch (err) {
      console.error("Failed to update review:", err);
      setReviewErrors((prev) => ({
        ...prev,
        [review.id]: "Could not save your review. Please try again.",
      }));
    } finally {
      setSavingReviewId(null);
    }
  };

  // Nudge them if their very next visit is within 24 hours and they still
  // haven't done their first-time intake form. There's no server-side
  // scheduler in this app to fire this the day before on its own, so it
  // shows every time they open the dashboard in that window instead - the
  // floating clipboard button (IntakeFormButton) covers the rest of the
  // time before that.
  const hoursUntilNext = nextAppointment
    ? (new Date(
        nextAppointment.appointmentAt?.toDate
          ? nextAppointment.appointmentAt.toDate()
          : `${nextAppointment.date}T${nextAppointment.time}:00`,
      ).getTime() -
        now) /
      (1000 * 60 * 60)
    : null;
  const needsIntakeReminder =
    intakeCompleted === false &&
    hoursUntilNext !== null &&
    hoursUntilNext > 0 &&
    hoursUntilNext <= 24;

  return (
    <PatientLayout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold text-ink">
          {greetingForNow()}, {displayName}
        </h1>
        <p className="text-slate text-sm mb-6">{formatDisplayDate(today)}</p>

        {error && (
          <div className="bg-pastel-red text-red text-sm rounded-xl px-4 py-3 mb-6">
            {error} Check the browser console for the full Firestore error.
          </div>
        )}

        <ReviewPrompt
          appointments={appointments}
          patientId={currentUser?.uid}
          bufferMinutes={15}
        />

        {isNextDelayed && (
          <div className="bg-pastel-amber text-amber text-sm rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
            <Clock size={16} />
            Your {formatTime(nextAppointment.time)} appointment on{" "}
            {formatShortDate(nextAppointment.date)} is running{" "}
            {nextAppointment.delayMinutes} min late
            {nextAppointment.delayedTime
              ? ` - now expected at ${formatTime(nextAppointment.delayedTime)}.`
              : "."}
          </div>
        )}

        {needsIntakeReminder && (
          <button
            onClick={() => navigate("/patient/intake")}
            className="w-full text-left bg-pastel-amber text-amber text-sm rounded-xl px-4 py-3 mb-6 flex items-center gap-3 hover:brightness-95 transition-[filter]"
          >
            <ClipboardList size={16} className="shrink-0" />
            <span>
              Your appointment is coming up and you haven't finished your intake
              form yet - tap here to complete it now.
            </span>
          </button>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6">
          <Card className="text-center md:text-left">
            <p className="text-2xl md:text-3xl font-semibold text-ink">
              {upcomingAppointments.length}
            </p>
            <p className="text-xs md:text-sm text-slate">
              Upcoming appointments
            </p>
          </Card>
          <Card className="text-center md:text-left">
            <p className="text-2xl md:text-3xl font-semibold text-ink">
              {records.length}
            </p>
            <p className="text-xs md:text-sm text-slate">Medical records</p>
          </Card>
        </div>

        {/* Next appointment highlight */}
        {!loading && nextAppointment && (
          <Card className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-ink flex items-center gap-2">
                <CalendarClock size={18} className="text-rose" />
                Your next appointment
              </h2>
              <Badge status={nextAppointment.status} />
            </div>

            <div className="flex items-center gap-4">
              <div className="text-center w-16 shrink-0">
                <p className="text-xs text-slate uppercase">
                  {formatShortDate(nextAppointment.date)}
                </p>
                <p className="text-lg font-semibold text-ink">
                  {formatTime(nextAppointment.time)}
                </p>
              </div>

              <div className="flex-1">
                <p className="text-sm font-medium text-ink capitalize">
                  {nextAppointment.type} consult
                </p>
                {nextAppointment.practice && (
                  <p className="text-xs text-slate">
                    {nextAppointment.practice}
                  </p>
                )}

                {nextAppointment.status === "delayed" && (
                  <p className="text-xs text-amber mt-1 flex items-center gap-1">
                    <Clock size={12} />
                    Running {nextAppointment.delayMinutes} min late
                    {nextAppointment.delayedTime && (
                      <>
                        {" "}
                        - now expected at{" "}
                        {formatTime(nextAppointment.delayedTime)}
                      </>
                    )}
                  </p>
                )}

                {nextAppointment.status === "booked" && (
                  <p className="text-xs text-slate mt-1">
                    Awaiting confirmation from the practice.
                  </p>
                )}

                {nextAppointment.status === "confirmed" && (
                  <p className="text-xs text-green mt-1">
                    Confirmed - see you then!
                  </p>
                )}
              </div>
            </div>

            <PatientETA
              appointment={nextAppointment}
              doctor={nextAppointmentDoctor}
              isNewPatient={isNewPatient}
            />
          </Card>
        )}

        {/* Book an appointment CTA */}
        <Card className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-ink mb-1">
              Need to see the doctor?
            </p>
            <p className="text-sm text-slate">
              Check the calendar for open slots and confirm a booking in a few
              taps.
            </p>
          </div>
          <button
            onClick={() => navigate("/patient/calendar")}
            className="shrink-0 flex items-center gap-2 bg-rose text-white rounded-xl px-4 py-3 text-sm font-medium hover:bg-plum transition-colors"
          >
            <CalendarPlus size={18} />
            Book
          </button>
        </Card>

        {myReviews.length > 0 && (
          <div className="mb-6">
            <div className="rounded-xl border border-sand bg-white overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  setExpandedReviews((prev) =>
                    prev === "my-reviews" ? null : "my-reviews",
                  )
                }
                className="w-full flex items-center justify-between px-4 py-3 text-left bg-white"
              >
                <span className="font-semibold text-ink">Your reviews</span>
                <ChevronDown
                  size={16}
                  className={
                    expandedReviews === "my-reviews" ? "rotate-180" : ""
                  }
                />
              </button>

              {expandedReviews === "my-reviews" && (
                <div className="border-t border-sand bg-white p-3 space-y-3">
                  {myReviews.map((review) => {
                    const doctor = doctors.find(
                      (d) => d.id === review.doctorId,
                    );
                    const isEditing = editingReviewId === review.id;
                    const draft = reviewDrafts[review.id] || {
                      rating: review.rating || 0,
                      comment: review.comment || "",
                    };
                    const error = reviewErrors[review.id];

                    return (
                      <div
                        key={review.id}
                        className="bg-white rounded-xl px-3 py-3 border border-sand"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-ink text-sm">
                              {doctor?.name || "Doctor"}
                            </p>
                            <p className="text-[11px] text-slate">
                              {review.appointmentId
                                ? "Your visit"
                                : "Your review"}
                            </p>
                          </div>
                          {!isEditing && (
                            <button
                              type="button"
                              onClick={() => startReviewEdit(review)}
                              className="text-[11px] font-medium text-rose hover:underline"
                            >
                              Edit
                            </button>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="mt-3 space-y-3">
                            <StarRating
                              value={draft.rating}
                              onChange={(rating) =>
                                setReviewDrafts((prev) => ({
                                  ...prev,
                                  [review.id]: { ...draft, rating },
                                }))
                              }
                              size={18}
                            />
                            <textarea
                              value={draft.comment}
                              onChange={(e) =>
                                setReviewDrafts((prev) => ({
                                  ...prev,
                                  [review.id]: {
                                    ...draft,
                                    comment: e.target.value,
                                  },
                                }))
                              }
                              rows={2}
                              placeholder="Update your review"
                              className="w-full border border-stone rounded-xl px-3 py-2 text-sm text-ink focus:border-rose focus:outline-none"
                            />
                            {error && (
                              <p className="text-red text-[11px]">{error}</p>
                            )}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => saveReviewEdit(review)}
                                disabled={savingReviewId === review.id}
                                className="bg-rose text-white rounded-xl px-3 py-2 text-[11px] font-medium disabled:opacity-60"
                              >
                                {savingReviewId === review.id
                                  ? "Saving..."
                                  : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingReviewId(null)}
                                className="border border-stone rounded-xl px-3 py-2 text-[11px] font-medium text-ink"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="mt-2">
                              <StarRating value={review.rating} size={12} />
                            </div>
                            {review.comment && (
                              <p className="text-sm text-slate mt-2 leading-relaxed">
                                {review.comment}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Our doctors */}
        {orderedDoctors.length > 0 && (
          <div className="mb-6">
            <h2 className="font-semibold text-ink mb-3">Our doctors</h2>
            <div className="flex flex-col gap-3">
              {orderedDoctors.map((doctor) => {
                const reviews = ratingsByDoctor[doctor.id] || [];
                const avgRating =
                  reviews.length > 0
                    ? reviews.reduce((sum, r) => sum + r.rating, 0) /
                      reviews.length
                    : 0;
                const visitCount = doctorVisitCounts[doctor.id] || 0;
                const isExpanded = expandedReviews === doctor.id;

                return (
                  <div
                    key={doctor.id}
                    className="rounded-xl border border-sand bg-white overflow-hidden"
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setExpandedReviews(isExpanded ? null : doctor.id)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setExpandedReviews(isExpanded ? null : doctor.id);
                        }
                      }}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-mist flex items-center justify-center shrink-0">
                          <Stethoscope size={18} className="text-rose" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-ink text-sm">
                              {doctor.name}
                            </p>
                            {visitCount > 0 && (
                              <span className="text-[10px] text-rose bg-white px-2 py-0.5 rounded-full border border-rose/20">
                                {visitCount} visit{visitCount > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                          {doctor.specialty && (
                            <p className="text-[11px] text-slate">
                              {doctor.specialty}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <StarRating
                          value={avgRating}
                          size={12}
                          showValue
                          count={reviews.length}
                        />
                        <ChevronDown
                          size={14}
                          className={isExpanded ? "rotate-180" : ""}
                        />
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-sand bg-white px-4 py-3">
                        {doctor.certifications && (
                          <p className="text-xs text-slate mb-2">
                            {doctor.certifications}
                          </p>
                        )}

                        {doctor.bio && (
                          <p className="text-sm text-slate leading-relaxed mb-3">
                            {doctor.bio}
                          </p>
                        )}

                        {doctor.contact && (
                          <div className="flex items-center gap-2 pb-3 border-b border-sand mb-3">
                            <Phone size={14} className="text-slate shrink-0" />
                            <p className="text-xs text-slate">
                              {doctor.contact}
                            </p>
                          </div>
                        )}

                        {reviews.length > 0 ? (
                          <div className="space-y-2">
                            {reviews.map((r) => (
                              <div
                                key={r.id}
                                className="bg-white rounded-xl px-3 py-2 border border-sand"
                              >
                                <StarRating value={r.rating} size={11} />
                                {r.comment && (
                                  <p className="text-xs text-ink mt-1.5">
                                    {r.comment}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate">
                            No reviews yet for this doctor.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upcoming appointments */}
        <Card padded={false}>
          <div className="px-5 py-4 border-b border-sand">
            <h2 className="font-semibold text-ink">Upcoming appointments</h2>
          </div>

          {loading ? (
            <p className="text-slate text-sm px-5 py-8 text-center">
              Loading appointments...
            </p>
          ) : upcomingAppointments.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="No upcoming appointments"
              message="You don't have anything booked yet. Find a time that works for you."
              actionLabel="Book an appointment"
              onAction={() => navigate("/patient/calendar")}
            />
          ) : (
            <div className="divide-y divide-sand">
              {upcomingAppointments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between px-5 py-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center w-14">
                      <p className="text-xs text-slate uppercase">
                        {formatShortDate(a.date)}
                      </p>
                      <p className="text-sm font-medium text-ink">
                        {formatTime(a.time)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink capitalize">
                        {a.type} consult
                      </p>
                      {a.practice && (
                        <p className="text-xs text-slate">{a.practice}</p>
                      )}
                    </div>
                  </div>
                  <Badge status={a.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent records */}
        <Card padded={false} className="mt-6">
          <div className="px-5 py-4 border-b border-sand flex items-center justify-between">
            <h2 className="font-semibold text-ink">Recent records</h2>
            <button
              onClick={() => navigate("/patient/records")}
              className="text-xs font-medium text-rose hover:underline"
            >
              View all
            </button>
          </div>

          {records.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No records yet"
              message="Records added by the practice will show up here."
            />
          ) : (
            <div className="divide-y divide-sand">
              {records.slice(0, 3).map((r) => (
                <div key={r.id} className="px-5 py-4">
                  <p className="text-sm text-ink">{r.title}</p>
                  <p className="text-xs text-slate">{r.date}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PatientLayout>
  );
}
