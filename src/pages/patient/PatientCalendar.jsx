// Patient's view of the doctor's calendar (PRD: Booking - must-have).
// Mirrors the secretary's Schedule screen (same shell, same calendar grid,
// same day-detail panel pattern, double-click-to-book) so the two dashboards
// feel like one product. Booking itself is a 3-step flow - pick a time,
// confirm the summary, see the confirmation - matching the approved design.
// Patients can see THAT a slot is taken, never who it belongs to; they can
// only ever add/cancel their own appointments, which is enforced by
// useAppointments scoping the Firestore query to the current patient.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Ban,
  CheckCircle2,
  Plus,
  Clock,
  XCircle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useAppointments } from "../../hooks/useAppointments";
import PatientLayout from "./PatientLayout";
import BackButton from "../../components/BackButton";
import Card from "../../components/Card";
import Badge from "../../components/Badge";
import Modal from "../../components/Modal";
import EmptyState from "../../components/EmptyState";
import {
  getMonthGrid,
  getMonthLabel,
  formatTime,
  formatShortDate,
  formatDisplayDate,
  getTodayString,
  generateTimeSlots,
  addMinutesToTime,
  isToday,
  isPastDate,
  parseDate,
  DAY_NAMES,
  MONTH_NAMES,
} from "../../utils/dateHelpers";
import {
  getDoctors,
  subscribeToBookedSlots,
  subscribeToBlockedSlots,
} from "../../firebase/firestore";

const EMPTY_FORM = { type: "in-person", doctorId: "" };

// A booking made 3+ days out needs the practice to call and confirm it with
// the patient before it's locked in; anything sooner is confirmed instantly.
const CONFIRMATION_WINDOW_DAYS = 3;

function daysFromToday(dateStr) {
  const diffMs = parseDate(dateStr) - parseDate(getTodayString());
  return Math.round(diffMs / 86400000);
}

function computeBookingStatus(dateStr) {
  return daysFromToday(dateStr) >= CONFIRMATION_WINDOW_DAYS
    ? "booked"
    : "confirmed";
}

// 'Monday, 30 March' - used in the modal header, deliberately without the
// year to match the design (the year still shows in the booking summary).
function formatModalHeaderDate(dateStr) {
  const d = parseDate(dateStr);
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

function downloadAppointmentICS(booking, doctorName) {
  const start = parseDate(booking.date);
  const [h, m] = booking.time.split(":").map(Number);
  start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + 30 * 60000);
  const stamp = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const summary = `${booking.type === "virtual" ? "Virtual" : "In-person"} consult${
    doctorName ? ` with ${doctorName}` : ""
  }`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${summary}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `appointment-${booking.date}-${booking.time}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PatientCalendar() {
  const { currentUser, userName } = useAuth();
  const { appointments, loading, error, createAppointment, cancelAppointment } =
    useAppointments();
  const navigate = useNavigate();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(getTodayString());

  const [bookedSlots, setBookedSlots] = useState([]);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [doctors, setDoctors] = useState([]);

  // Booking flow: null | 'time' | 'confirm' | 'confirmed'
  const [bookingStep, setBookingStep] = useState(null);
  const [bookingTime, setBookingTime] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  useEffect(() => {
    const unsubBooked = subscribeToBookedSlots(setBookedSlots);
    const unsubBlocked = subscribeToBlockedSlots(setBlockedSlots);
    return () => {
      unsubBooked && unsubBooked();
      unsubBlocked && unsubBlocked();
    };
  }, []);

  useEffect(() => {
    getDoctors()
      .then(setDoctors)
      .catch(() => setDoctors([]));
  }, []);

  // The doctor currently selected in the booking form, if any.
  const selectedDoctor = doctors.find((d) => d.id === form.doctorId) || null;

  const grid = useMemo(
    () => getMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  // Belt-and-suspenders: useAppointments already scopes the Firestore query
  // to this patient's uid (subscribeToPatientAppointments), but we filter
  // again here so this screen can never render another patient's booking -
  // even if that hook's scoping were ever changed or misconfigured. This is
  // a client-side guard only; the Firestore security rules are what
  // actually enforce this at the database level and should mirror it.
  const myAppointments = useMemo(
    () => appointments.filter((a) => a.patientId === currentUser?.uid),
    [appointments, currentUser],
  );

  const ownAppointmentsByDate = useMemo(() => {
    const map = {};
    myAppointments
      .filter((a) => a.status !== "cancelled")
      .forEach((a) => {
        if (!map[a.date]) map[a.date] = [];
        map[a.date].push(a);
      });
    Object.values(map).forEach((list) =>
      list.sort((a, b) => a.time.localeCompare(b.time)),
    );
    return map;
  }, [myAppointments]);

  const selectedDayAppointments = ownAppointmentsByDate[selectedDate] || [];

  const activeBookedSlots = useMemo(
    () => bookedSlots.filter((b) => b.status !== "cancelled"),
    [bookedSlots],
  );

  const isDayBlocked = blockedSlots.some(
    (b) => b.date === selectedDate && b.time === null,
  );
  const blockedRecordForDay = blockedSlots.find(
    (b) => b.date === selectedDate && b.time === null,
  );

  // Titled hour-range blocks (e.g. "Lunch break" 12:00-13:00) for the
  // selected day - read-only here, patients just see why those times are
  // unavailable. Blocking a few hours never blocks the rest of the day.
  const blockedHourGroupsForSelectedDay = useMemo(() => {
    const groups = {};
    blockedSlots
      .filter((b) => b.date === selectedDate && b.time !== null)
      .forEach((b) => {
        const key = b.groupId || b.id;
        if (!groups[key]) {
          groups[key] = {
            key,
            title: b.title || b.reason || "Unavailable",
            times: [],
          };
        }
        groups[key].times.push(b.time);
      });
    return Object.values(groups)
      .map((g) => ({ ...g, times: g.times.sort() }))
      .sort((a, b) => a.times[0].localeCompare(b.times[0]));
  }, [blockedSlots, selectedDate]);

  const allTimeSlots = useMemo(() => generateTimeSlots(), []);
  const morningSlots = useMemo(
    () => allTimeSlots.filter((t) => t < "12:00"),
    [allTimeSlots],
  );
  const afternoonSlots = useMemo(
    () => allTimeSlots.filter((t) => t >= "12:00"),
    [allTimeSlots],
  );

  const takenTimesForSelectedDay = useMemo(
    () =>
      new Set(
        activeBookedSlots
          .filter((b) => b.date === selectedDate)
          .map((b) => b.time),
      ),
    [activeBookedSlots, selectedDate],
  );

  const blockedTimesForSelectedDay = useMemo(
    () =>
      new Set(
        blockedSlots
          .filter((b) => b.date === selectedDate && b.time !== null)
          .map((b) => b.time),
      ),
    [blockedSlots, selectedDate],
  );

  const hasUnavailableSlot =
    takenTimesForSelectedDay.size > 0 || blockedTimesForSelectedDay.size > 0;

  const selectedDateIsPast = isPastDate(selectedDate);

  function goToPrevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }
  function goToNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function openBookingFlow(dateStr = selectedDate) {
    if (isPastDate(dateStr) || isDayBlocked) return;
    setSelectedDate(dateStr);
    setBookingTime(null);
    // Pre-select the doctor when there's only one, so the flow isn't slowed
    // down for the common single-doctor practice; with several, the patient
    // picks explicitly.
    setForm({
      ...EMPTY_FORM,
      doctorId: doctors.length === 1 ? doctors[0].id : "",
    });
    setFormError("");
    setBookingStep("time");
  }

  // Double-clicking a day jumps straight into booking on that day, mirroring
  // the secretary's Schedule screen.
  function handleDayDoubleClick(dateStr) {
    openBookingFlow(dateStr);
  }

  function closeBookingFlow() {
    setBookingStep(null);
    setBookingTime(null);
    setFormError("");
  }

  function selectTime(t) {
    if (takenTimesForSelectedDay.has(t) || blockedTimesForSelectedDay.has(t))
      return;
    setBookingTime(t);
  }

  function goToConfirmStep() {
    if (!bookingTime) return;
    if (doctors.length > 0 && !form.doctorId) {
      setFormError("Please choose a doctor to continue.");
      return;
    }
    setFormError("");
    setBookingStep("confirm");
  }

  async function handleConfirmBooking() {
    // Guard against a double-booking race: re-check the slot is still open
    if (
      isDayBlocked ||
      takenTimesForSelectedDay.has(bookingTime) ||
      blockedTimesForSelectedDay.has(bookingTime)
    ) {
      setFormError(
        "Sorry, that slot was just taken. Please pick another time.",
      );
      setBookingStep("time");
      setBookingTime(null);
      return;
    }

    const status = computeBookingStatus(selectedDate);

    setSaving(true);
    try {
      await createAppointment({
        patientId: currentUser.uid,
        patientName: userName || currentUser?.email,
        secretaryId: null,
        doctorId: selectedDoctor?.id || null,
        doctorName: selectedDoctor?.name || "",
        date: selectedDate,
        time: bookingTime,
        type: form.type,
        status,
      });
      setConfirmedBooking({
        date: selectedDate,
        time: bookingTime,
        type: form.type,
        status,
        doctorName: selectedDoctor?.name || "",
      });
      setBookingStep("confirmed");
    } catch (err) {
      console.error(err);
      setFormError("Something went wrong booking this slot. Please try again.");
    }
    setSaving(false);
  }

  function handleBackToDashboard() {
    closeBookingFlow();
    setConfirmedBooking(null);
    navigate("/patient/dashboard");
  }

  function getHoursUntilAppointment(appointment) {
    if (!appointment) return null;
    const appointmentDate = appointment.appointmentAt?.toDate
      ? appointment.appointmentAt.toDate()
      : new Date(`${appointment.date}T${appointment.time}:00`);
    const hours = (appointmentDate.getTime() - Date.now()) / (1000 * 60 * 60);
    return Number.isFinite(hours) ? hours : null;
  }

  const cancelHoursRemaining = getHoursUntilAppointment(cancelTarget);
  const cancelIsTooLate =
    cancelHoursRemaining !== null && cancelHoursRemaining <= 3;
  const cancelIsVeryLate =
    cancelHoursRemaining !== null && cancelHoursRemaining <= 2;

  async function handleConfirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError("");
    try {
      await cancelAppointment(cancelTarget, currentUser?.uid);
      setCancelTarget(null);
    } catch (err) {
      console.error("Failed to cancel appointment:", err);
      if (err?.code === "late-cancellation") {
        setCancelError(err.message);
      } else if (err?.code === "permission-denied") {
        setCancelError(
          "This appointment cannot be cancelled online. Please contact the practice.",
        );
      } else {
        setCancelError(
          "Something went wrong cancelling this appointment. Please try again.",
        );
      }
    }
    setCancelling(false);
  }

  return (
    <PatientLayout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        <BackButton />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-ink">
              Book an appointment
            </h1>
            <p className="text-slate text-sm"></p>
          </div>
          <button
            onClick={() => openBookingFlow()}
            disabled={selectedDateIsPast || isDayBlocked}
            title={
              selectedDateIsPast
                ? "Can't book a date that has passed"
                : isDayBlocked
                  ? "The practice isn't taking bookings on this day"
                  : undefined
            }
            className="hidden md:flex items-center gap-2 bg-rose text-white rounded-xl px-5 py-3 font-medium hover:bg-plum transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-rose"
          >
            <Plus size={18} /> Add appointment
          </button>
        </div>

        {error && (
          <div className="bg-pastel-red text-red text-sm rounded-xl px-4 py-3 mb-6">
            {error} Check the browser console for the full Firestore error.
          </div>
        )}

        <div className="grid md:grid-cols-[1fr_360px] gap-6">
          {/* Calendar */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-ink">
                {getMonthLabel(viewYear, viewMonth)}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={goToPrevMonth}
                  className="p-2 rounded-lg hover:bg-mist text-slate"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={goToNextMonth}
                  className="p-2 rounded-lg hover:bg-mist text-slate"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate mb-2">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <div key={i}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {grid.map((cell) => {
                const dayBlockRecord = blockedSlots.find(
                  (b) => b.date === cell.dateStr && b.time === null,
                );
                const fullyBlocked = !!dayBlockRecord;
                const partiallyBlocked =
                  !fullyBlocked &&
                  blockedSlots.some(
                    (b) => b.date === cell.dateStr && b.time !== null,
                  );
                const hasOwnAppt =
                  (ownAppointmentsByDate[cell.dateStr] || []).length > 0;
                const isSelected = cell.dateStr === selectedDate;
                const isPast = isPastDate(cell.dateStr);
                return (
                  <button
                    key={cell.dateStr}
                    onClick={() => setSelectedDate(cell.dateStr)}
                    onDoubleClick={() => handleDayDoubleClick(cell.dateStr)}
                    title={
                      fullyBlocked
                        ? dayBlockRecord.title || "Not available"
                        : isPast
                          ? "Past date - view only"
                          : "Double-click to book"
                    }
                    className={`aspect-square rounded-lg text-sm flex flex-col items-center justify-center gap-0.5 transition-colors
                      ${!cell.inMonth ? "text-stone" : isPast ? "text-slate" : "text-ink"}
                      ${isSelected ? "bg-rose text-white" : isToday(cell.dateStr) ? "bg-blush" : "hover:bg-mist"}`}
                  >
                    <span
                      className={
                        fullyBlocked ? "line-through decoration-2" : ""
                      }
                    >
                      {cell.day}
                    </span>
                    {fullyBlocked && (
                      <span className="w-1 h-1 rounded-full bg-red" />
                    )}
                    {partiallyBlocked && (
                      <span className="w-1 h-1 rounded-full bg-amber" />
                    )}
                    {!fullyBlocked && !partiallyBlocked && hasOwnAppt && (
                      <span
                        className={`w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-rose"}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Day detail panel - same pattern as the secretary's Schedule screen */}
          <Card padded={false} className="h-fit">
            <div className="px-5 py-4 border-b border-sand flex items-center justify-between">
              <div>
                <p className="text-sm text-slate">Selected day</p>
                <p className="font-semibold text-ink text-sm">
                  {formatDisplayDate(selectedDate)}
                </p>
              </div>
              <button
                onClick={() => openBookingFlow()}
                disabled={selectedDateIsPast || isDayBlocked}
                title="Add appointment"
                className="p-2 rounded-lg text-slate hover:bg-mist disabled:opacity-40"
              >
                <Plus size={18} />
              </button>
            </div>

            {isDayBlocked ? (
              <EmptyState
                icon={Ban}
                title={blockedRecordForDay?.title || "Not available"}
                message="The practice isn't taking bookings on this day. Please choose another date."
              />
            ) : (
              <>
                {blockedHourGroupsForSelectedDay.length > 0 && (
                  <div className="px-5 py-3 bg-mist flex flex-col gap-2">
                    {blockedHourGroupsForSelectedDay.map((g) => (
                      <div
                        key={g.key}
                        className="flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-xs font-medium text-ink">
                            {g.title}
                          </p>
                          <p className="text-xs text-slate">
                            {formatTime(g.times[0])} –{" "}
                            {formatTime(
                              addMinutesToTime(g.times[g.times.length - 1], 30),
                            )}{" "}
                            unavailable
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => openBookingFlow()}
                  disabled={selectedDateIsPast}
                  className="md:hidden w-full flex items-center justify-center gap-2 bg-rose text-white py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={18} /> Add appointment
                </button>

                {loading ? (
                  <p className="text-slate text-sm px-5 py-8 text-center">
                    Loading appointments...
                  </p>
                ) : selectedDayAppointments.length === 0 ? (
                  <EmptyState
                    icon={Clock}
                    title="No appointments"
                    message="You don't have anything booked on this day yet."
                    actionLabel={
                      selectedDateIsPast ? undefined : "Add appointment"
                    }
                    onAction={
                      selectedDateIsPast ? undefined : () => openBookingFlow()
                    }
                  />
                ) : (
                  <div className="divide-y divide-sand">
                    {selectedDayAppointments.map((a) => (
                      <div key={a.id} className="px-5 py-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-ink">
                              {formatTime(a.time)}
                            </p>
                            <p className="text-xs text-slate capitalize">
                              {a.type} consult
                            </p>
                            {a.status === "delayed" && a.delayedTime && (
                              <p className="text-xs text-amber mt-1">
                                Running {a.delayMinutes} min late → now{" "}
                                {formatTime(a.delayedTime)}
                              </p>
                            )}
                            {typeof a.patientLateMinutes === "number" && (
                              <p className="text-xs text-slate mt-1">
                                Recorded as arriving late for this appointment
                              </p>
                            )}
                          </div>
                          <Badge status={a.status} />
                        </div>
                        {a.status !== "cancelled" && !isPastDate(a.date) && (
                          <button
                            onClick={() => setCancelTarget(a)}
                            className="mt-3 text-xs font-medium text-red hover:underline flex items-center gap-1"
                          >
                            <XCircle size={13} /> Cancel appointment
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      </div>

      {/* Step 1 - select a time slot */}
      <Modal
        isOpen={bookingStep === "time"}
        onClose={closeBookingFlow}
        title={formatModalHeaderDate(selectedDate)}
        headerVariant="dark"
        hideFooter
      >
        <div className="flex flex-col gap-4">
          {doctors.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-ink mb-2">
                Who would you like to see?
              </p>
              <div className="flex flex-col gap-2">
                {doctors.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setForm({ ...form, doctorId: doc.id })}
                    className={`text-left rounded-xl border px-4 py-3 transition-colors ${
                      form.doctorId === doc.id
                        ? "bg-rose text-white border-rose"
                        : "border-stone text-ink hover:border-rose"
                    }`}
                  >
                    <p className="text-sm font-medium">{doc.name}</p>
                    {doc.specialty && (
                      <p
                        className={`text-xs ${
                          form.doctorId === doc.id
                            ? "text-white/80"
                            : "text-slate"
                        }`}
                      >
                        {doc.specialty}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, type: "in-person" })}
              className={`rounded-xl py-2.5 text-sm font-medium border transition-colors ${
                form.type === "in-person"
                  ? "bg-rose text-white border-rose"
                  : "border-stone text-ink hover:border-rose"
              }`}
            >
              In-person
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, type: "virtual" })}
              className={`rounded-xl py-2.5 text-sm font-medium border transition-colors ${
                form.type === "virtual"
                  ? "bg-rose text-white border-rose"
                  : "border-stone text-ink hover:border-rose"
              }`}
            >
              Virtual
            </button>
          </div>

          <div className="border border-blush rounded-2xl p-4">
            <p className="text-sm font-semibold text-ink mb-3">
              Select a time slot
            </p>

            <p className="text-xs text-slate uppercase tracking-wide mb-2">
              Morning
            </p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {morningSlots.map((t) => (
                <TimeSlotButton
                  key={t}
                  time={t}
                  selected={bookingTime === t}
                  taken={
                    takenTimesForSelectedDay.has(t) ||
                    blockedTimesForSelectedDay.has(t)
                  }
                  onClick={() => selectTime(t)}
                />
              ))}
            </div>

            <p className="text-xs text-slate uppercase tracking-wide mb-2">
              Afternoon
            </p>
            <div className="grid grid-cols-3 gap-2">
              {afternoonSlots.map((t) => (
                <TimeSlotButton
                  key={t}
                  time={t}
                  selected={bookingTime === t}
                  taken={
                    takenTimesForSelectedDay.has(t) ||
                    blockedTimesForSelectedDay.has(t)
                  }
                  onClick={() => selectTime(t)}
                />
              ))}
            </div>

            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-sand text-xs text-slate">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-rose inline-block" />
                Selected
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded border border-rose inline-block" />
                Open
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-mist inline-block" />
                Taken
              </span>
            </div>
          </div>

          {hasUnavailableSlot && (
            <p className="text-xs text-rose bg-blush rounded-xl px-4 py-2 text-center">
              Taken slots are visible but not selectable
            </p>
          )}

          {formError && <p className="text-red text-sm">{formError}</p>}

          <button
            onClick={goToConfirmStep}
            disabled={!bookingTime || (doctors.length > 0 && !form.doctorId)}
            className="w-full bg-rose text-white rounded-xl py-3 font-medium hover:bg-plum transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            Review booking <ArrowRight size={16} />
          </button>
        </div>
      </Modal>

      {/* Step 2 - confirm booking */}
      <Modal
        isOpen={bookingStep === "confirm"}
        onClose={closeBookingFlow}
        onBack={() => setBookingStep("time")}
        title="Confirm booking"
        headerVariant="dark"
        hideFooter
      >
        <div className="flex flex-col gap-4">
          <div className="border border-blush rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-sand">
              <p className="text-sm font-semibold text-ink">Booking summary</p>
            </div>
            <div className="divide-y divide-sand">
              <SummaryRow
                label="Doctor"
                value={selectedDoctor?.name || "The practice's doctor"}
              />
              <SummaryRow
                label="Date"
                value={`${formatShortDate(selectedDate)} ${parseDate(selectedDate).getFullYear()}`}
              />
              <SummaryRow label="Time" value={formatTime(bookingTime)} />
              <SummaryRow
                label="Type"
                value={
                  form.type === "virtual"
                    ? "Virtual consult"
                    : "In-person consult"
                }
              />
            </div>
          </div>

          <p className="text-xs text-rose bg-blush rounded-xl px-4 py-3">
            {computeBookingStatus(selectedDate) === "booked"
              ? "We will call you a few days before your appointment to confirm your appointment."
              : "By confirming, you agree to arrive 5 minutes before your appointment time and 15 minutes for first time patients."}
          </p>

          {formError && <p className="text-red text-sm">{formError}</p>}

          <div className="flex flex-col gap-2">
            <button
              onClick={handleConfirmBooking}
              disabled={saving}
              className="w-full bg-rose text-white rounded-xl py-3 font-medium hover:bg-plum transition-colors disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : computeBookingStatus(selectedDate) === "booked"
                  ? "Book appointment"
                  : "Confirm appointment"}
            </button>
            <button
              onClick={() => setBookingStep("time")}
              className="w-full border border-stone text-ink rounded-xl py-3 font-medium hover:border-rose transition-colors"
            >
              Go back
            </button>
          </div>
        </div>
      </Modal>

      {/* Step 3 - booking confirmed */}
      <Modal
        isOpen={bookingStep === "confirmed"}
        onClose={handleBackToDashboard}
        title={
          confirmedBooking?.status === "booked"
            ? "Appointment requested"
            : "Booking confirmed"
        }
        headerVariant="dark"
        hideClose
        hideFooter
      >
        {confirmedBooking && (
          <div className="flex flex-col items-center text-center gap-3 py-2">
            {confirmedBooking.status === "booked" ? (
              <div className="w-16 h-16 rounded-full bg-pastel-amber flex items-center justify-center">
                <Clock size={32} className="text-amber" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-pastel-green flex items-center justify-center">
                <CheckCircle2 size={32} className="text-green" />
              </div>
            )}
            <div>
              <p
                className={`font-semibold text-lg mb-1 ${
                  confirmedBooking.status === "booked"
                    ? "text-amber"
                    : "text-green"
                }`}
              >
                {confirmedBooking.status === "booked"
                  ? "You're on the books!"
                  : "You're booked!"}
              </p>
              <p className="text-sm text-ink">
                {confirmedBooking.doctorName || "The practice's doctor"}
              </p>
              <p className="text-sm text-slate">
                {formatShortDate(confirmedBooking.date)}{" "}
                {parseDate(confirmedBooking.date).getFullYear()} ·{" "}
                {formatTime(confirmedBooking.time)}
              </p>
            </div>
            <Badge status={confirmedBooking.status} />
            <div className="flex flex-col gap-2 w-full mt-2">
              <button
                onClick={handleBackToDashboard}
                className="w-full bg-rose text-white rounded-xl py-3 font-medium hover:bg-plum transition-colors"
              >
                Back to dashboard
              </button>
              <button
                onClick={() =>
                  downloadAppointmentICS(
                    confirmedBooking,
                    confirmedBooking.doctorName,
                  )
                }
                className="w-full border border-stone text-ink rounded-xl py-3 font-medium hover:border-rose transition-colors"
              >
                Add to calendar
              </button>
            </div>
            <p className="text-xs text-slate mt-1">
              {confirmedBooking.status === "booked"
                ? "The practice will contact you shortly to confirm this appointment."
                : "Your appointment is now visible to the practice."}
            </p>
          </div>
        )}
      </Modal>

      {/* Cancel appointment confirmation */}
      <Modal
        isOpen={!!cancelTarget}
        onClose={() => {
          setCancelTarget(null);
          setCancelError("");
        }}
        title="Cancel appointment?"
        confirmLabel={cancelling ? "Cancelling..." : "Cancel appointment"}
        confirmVariant="danger"
        onConfirm={handleConfirmCancel}
        confirmDisabled={cancelling || cancelIsTooLate}
        cancelLabel="Keep it"
      >
        <p className="text-sm text-slate">
          This will cancel your {cancelTarget && formatTime(cancelTarget.time)}{" "}
          appointment on {cancelTarget && formatShortDate(cancelTarget.date)}.
        </p>

        {cancelIsTooLate ? (
          <div className="mt-3 rounded-xl bg-pastel-red px-4 py-3">
            <p className="text-sm font-medium text-red">
              {cancelIsVeryLate
                ? "Late cancellation"
                : "Cancellation window closed"}
            </p>
            <p className="text-xs text-red mt-1">
              {cancelIsVeryLate
                ? "This appointment is within 2 hours. You cannot cancel online. Please contact the practice to cancel or reschedule. A late-cancellation warning or fee may apply."
                : "This appointment is less than 3 hours away. You cannot cancel online. Please contact the practice to cancel or reschedule."}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate mt-3">
            You can cancel online up to 3 hours before your appointment.
          </p>
        )}

        {cancelError && <p className="text-xs text-red mt-3">{cancelError}</p>}
      </Modal>
    </PatientLayout>
  );
}

function TimeSlotButton({ time, selected, taken, onClick }) {
  const base = "rounded-xl py-2.5 text-sm font-medium border transition-colors";
  if (selected) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} bg-rose text-white border-rose`}
      >
        {formatTime(time)}
      </button>
    );
  }
  if (taken) {
    return (
      <button
        type="button"
        disabled
        title="Taken"
        className={`${base} bg-mist text-stone border-mist cursor-not-allowed`}
      >
        {formatTime(time)}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} border-rose text-rose hover:bg-blush`}
    >
      {formatTime(time)}
    </button>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <p className="text-sm text-slate">{label}</p>
      <p className="text-sm font-medium text-ink text-right">{value}</p>
    </div>
  );
}
