// Patient's view of the doctor's calendar (PRD: Booking — must-have).
// Shows availability at a glance, lets the patient pick an open slot, and
// confirms the booking. Read-only for anything the patient doesn't own —
// patients can see THAT a slot is taken, never who it belongs to.
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Ban,
  CheckCircle2,
  CalendarClock,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useAppointments } from "../../hooks/useAppointments";
import PatientLayout from "./PatientLayout";
import Card from "../../components/Card";
import Badge from "../../components/Badge";
import Modal from "../../components/Modal";
import Button from "../../components/Button";
import EmptyState from "../../components/EmptyState";
import {
  getMonthGrid,
  getMonthLabel,
  formatTime,
  formatDisplayDate,
  getTodayString,
  generateTimeSlots,
  isToday,
} from "../../utils/dateHelpers";
import {
  getUserById,
  subscribeToBookedSlots,
  subscribeToBlockedSlots,
} from "../../firebase/firestore";

const EMPTY_FORM = { practice: "", type: "in-person" };

export default function PatientCalendar() {
  const { currentUser, userName } = useAuth();
  const { appointments, createAppointment } = useAppointments();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(getTodayString());

  const [bookedSlots, setBookedSlots] = useState([]);
  const [blockedSlots, setBlockedSlots] = useState([]);

  const [bookingTime, setBookingTime] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  useEffect(() => {
    const unsubBooked = subscribeToBookedSlots(setBookedSlots);
    const unsubBlocked = subscribeToBlockedSlots(setBlockedSlots);
    return () => {
      unsubBooked && unsubBooked();
      unsubBlocked && unsubBlocked();
    };
  }, []);

  // Pre-fill the practice field from the patient's own record, if they have one on file
  useEffect(() => {
    if (!currentUser) return;
    getUserById(currentUser.uid)
      .then((u) => {
        if (u?.practiceCode) {
          setForm((f) => ({ ...f, practice: f.practice || u.practiceCode }));
        }
      })
      .catch(() => {});
  }, [currentUser]);

  const grid = useMemo(
    () => getMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const ownAppointmentsByDate = useMemo(() => {
    const map = {};
    appointments
      .filter((a) => a.status !== "cancelled")
      .forEach((a) => {
        if (!map[a.date]) map[a.date] = [];
        map[a.date].push(a);
      });
    return map;
  }, [appointments]);

  const activeBookedSlots = useMemo(
    () => bookedSlots.filter((b) => b.status !== "cancelled"),
    [bookedSlots],
  );

  const isDayBlocked = blockedSlots.some(
    (b) => b.date === selectedDate && b.time === null,
  );

  const allTimeSlots = useMemo(() => generateTimeSlots(), []);

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

  const ownAppointmentByTime = useMemo(() => {
    const map = {};
    (ownAppointmentsByDate[selectedDate] || []).forEach((a) => {
      map[a.time] = a;
    });
    return map;
  }, [ownAppointmentsByDate, selectedDate]);

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

  function openBooking(time) {
    if (isDayBlocked) return;
    if (takenTimesForSelectedDay.has(time)) return;
    if (blockedTimesForSelectedDay.has(time)) return;
    setFormError("");
    setBookingTime(time);
  }

  async function handleConfirmBooking() {
    if (!form.practice.trim()) return setFormError("Please enter the practice.");
    if (!form.type) return setFormError("Please choose an appointment type.");

    // Guard against a double-booking race: re-check the slot is still open
    if (
      isDayBlocked ||
      takenTimesForSelectedDay.has(bookingTime) ||
      blockedTimesForSelectedDay.has(bookingTime)
    ) {
      setFormError("Sorry, that slot was just taken. Please pick another time.");
      setBookingTime(null);
      return;
    }

    setSaving(true);
    try {
      await createAppointment({
        patientId: currentUser.uid,
        patientName: userName || currentUser?.email,
        secretaryId: null,
        date: selectedDate,
        time: bookingTime,
        type: form.type,
        practice: form.practice.trim(),
        status: "confirmed",
      });
      setConfirmedBooking({
        date: selectedDate,
        time: bookingTime,
        type: form.type,
        practice: form.practice.trim(),
      });
      setBookingTime(null);
    } catch (err) {
      console.error(err);
      setFormError("Something went wrong booking this slot. Please try again.");
    }
    setSaving(false);
  }

  return (
    <PatientLayout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-ink">Book an appointment</h1>
          <p className="text-slate text-sm">
            Pick an open slot on the doctor's calendar
          </p>
        </div>

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
                const blocked = blockedSlots.some(
                  (b) => b.date === cell.dateStr && b.time === null,
                );
                const hasOwnAppt = (ownAppointmentsByDate[cell.dateStr] || [])
                  .length > 0;
                const isSelected = cell.dateStr === selectedDate;
                return (
                  <button
                    key={cell.dateStr}
                    onClick={() => setSelectedDate(cell.dateStr)}
                    className={`aspect-square rounded-lg text-sm flex flex-col items-center justify-center gap-0.5 transition-colors
                      ${!cell.inMonth ? "text-stone" : "text-ink"}
                      ${isSelected ? "bg-rose text-white" : isToday(cell.dateStr) ? "bg-blush" : "hover:bg-mist"}`}
                  >
                    <span>{cell.day}</span>
                    {blocked && (
                      <span className="w-1 h-1 rounded-full bg-red" />
                    )}
                    {!blocked && hasOwnAppt && (
                      <span
                        className={`w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-rose"}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-sand text-xs text-slate">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose inline-block" />
                Your appointment
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red inline-block" />
                Unavailable
              </span>
            </div>
          </Card>

          {/* Day detail panel */}
          <Card padded={false} className="h-fit">
            <div className="px-5 py-4 border-b border-sand">
              <p className="text-sm text-slate">Selected day</p>
              <p className="font-semibold text-ink text-sm">
                {formatDisplayDate(selectedDate)}
              </p>
            </div>

            {isDayBlocked ? (
              <EmptyState
                icon={Ban}
                title={
                  blockedSlots.find(
                    (b) => b.date === selectedDate && b.time === null,
                  )?.title || "Not available"
                }
                message="The practice isn't taking bookings on this day. Please choose another date."
              />
            ) : (
              <div className="divide-y divide-sand">
                {allTimeSlots.map((t) => {
                  const ownAppt = ownAppointmentByTime[t];
                  const isTaken = takenTimesForSelectedDay.has(t);
                  const isBlockedTime = blockedTimesForSelectedDay.has(t);

                  if (ownAppt) {
                    return (
                      <div
                        key={t}
                        className="flex items-center justify-between px-5 py-3 bg-mist"
                      >
                        <div>
                          <p className="text-sm font-medium text-ink">
                            {formatTime(t)}
                          </p>
                          <p className="text-xs text-slate">Your appointment</p>
                        </div>
                        <Badge status={ownAppt.status} />
                      </div>
                    );
                  }

                  if (isTaken || isBlockedTime) {
                    const blockTitle = isBlockedTime
                      ? blockedSlots.find(
                          (b) => b.date === selectedDate && b.time === t,
                        )?.title
                      : null;
                    return (
                      <div
                        key={t}
                        className="flex items-center justify-between px-5 py-3 opacity-50"
                      >
                        <p className="text-sm text-ink">{formatTime(t)}</p>
                        <span className="text-xs text-slate">
                          {blockTitle || "Booked"}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={t}
                      onClick={() => openBooking(t)}
                      className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-mist transition-colors"
                    >
                      <p className="text-sm text-ink">{formatTime(t)}</p>
                      <span className="text-xs font-medium text-rose">
                        Book
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Booking form modal */}
      <Modal
        isOpen={!!bookingTime}
        onClose={() => setBookingTime(null)}
        title="Confirm booking"
        confirmLabel={saving ? "Booking..." : "Confirm appointment"}
        onConfirm={handleConfirmBooking}
        confirmDisabled={saving}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm text-ink bg-mist rounded-xl px-4 py-3">
            <CalendarClock size={16} className="text-rose" />
            {formatDisplayDate(selectedDate)} · {formatTime(bookingTime)}
          </div>

          <div>
            <label className="text-xs text-slate mb-1 block">Practice</label>
            <input
              value={form.practice}
              onChange={(e) => setForm({ ...form, practice: e.target.value })}
              placeholder="e.g. Now Med Practice"
              className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs text-slate mb-1 block">
              Appointment type
            </label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full border border-stone rounded-xl px-4 py-3 text-ink bg-mist focus:border-rose focus:outline-none"
            >
              <option value="in-person">In-person</option>
              <option value="virtual">Virtual</option>
            </select>
          </div>

          {formError && <p className="text-red text-sm">{formError}</p>}
        </div>
      </Modal>

      {/* Booking confirmed screen */}
      <Modal
        isOpen={!!confirmedBooking}
        onClose={() => setConfirmedBooking(null)}
        title="Booking confirmed"
        hideFooter
      >
        {confirmedBooking && (
          <div className="flex flex-col items-center text-center gap-4 py-2">
            <div className="w-14 h-14 rounded-full bg-pastel-green flex items-center justify-center">
              <CheckCircle2 size={28} className="text-green" />
            </div>
            <div>
              <p className="font-semibold text-ink mb-1">You're all set</p>
              <p className="text-sm text-slate">
                {formatDisplayDate(confirmedBooking.date)} at{" "}
                {formatTime(confirmedBooking.time)}
              </p>
              <p className="text-sm text-slate capitalize">
                {confirmedBooking.type} consult · {confirmedBooking.practice}
              </p>
            </div>
            <Button
              onClick={() => setConfirmedBooking(null)}
              fullWidth
            >
              Done
            </Button>
          </div>
        )}
      </Modal>
    </PatientLayout>
  );
}