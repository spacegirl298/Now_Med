// Secretary's operational hub: month calendar, day detail panel, appointment
// CRUD, delay marking, and marking dates unavailable. (PRD: Calendar Management
// — must-have.)
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Ban,
  Pencil,
  Trash2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useAppointments } from "../../hooks/useAppointments";
import SecretaryLayout from "./SecretaryLayout";
import BackButton from "../../components/BackButton";
import Card from "../../components/Card";
import Badge from "../../components/Badge";
import Modal from "../../components/Modal";
import EmptyState from "../../components/EmptyState";
import {
  getMonthGrid,
  getMonthLabel,
  formatTime,
  formatDisplayDate,
  getTodayString,
  generateTimeSlots,
  addMinutesToTime,
  isToday,
  isPastDate,
} from "../../utils/dateHelpers";
import { DELAY_OPTIONS } from "../../utils/validators";
import {
  getAllPatients,
  getUserByIdNumber,
  blockDate,
  unblockSlot,
  subscribeToBlockedSlots,
} from "../../firebase/firestore";

const EMPTY_FORM = {
  bookingMode: "existing", // 'existing' patient on file, or a 'new' walk-in/phone/email patient
  patientId: "",
  patientName: "",
  patientIdNumber: "",
  patientIdType: "sa_id",
  patientPhone: "",
  contactMethod: "in-person",
  time: "08:00",
  type: "in-person",
  notes: "",
};

export default function SecretarySchedule() {
  const { currentUser } = useAuth();
  const {
    appointments,
    loading,
    error,
    createAppointment,
    updateAppointment,
    deleteAppointment,
    markAppointmentDelay,
  } = useAppointments();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(getTodayString());

  const [patients, setPatients] = useState([]);
  const [blockedSlots, setBlockedSlots] = useState([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const [delayTarget, setDelayTarget] = useState(null);
  const [delayMinutes, setDelayMinutes] = useState(DELAY_OPTIONS[0]);
  const [delayNote, setDelayNote] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    getAllPatients()
      .then(setPatients)
      .catch(() => setPatients([]));
    const unsub = subscribeToBlockedSlots(setBlockedSlots);
    return () => unsub && unsub();
  }, []);

  const grid = useMemo(
    () => getMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const appointmentsByDate = useMemo(() => {
    const map = {};
    appointments.forEach((a) => {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    });
    Object.values(map).forEach((list) =>
      list.sort((a, b) => a.time.localeCompare(b.time)),
    );
    return map;
  }, [appointments]);

  const selectedDayAppointments = appointmentsByDate[selectedDate] || [];
  const isDayBlocked = blockedSlots.some(
    (b) => b.date === selectedDate && b.time === null,
  );
  const blockedRecordForDay = blockedSlots.find(
    (b) => b.date === selectedDate && b.time === null,
  );

  const bookedTimesForSelectedDay = new Set(
    selectedDayAppointments
      .filter(
        (a) =>
          a.status !== "cancelled" &&
          (!editingAppointment || a.id !== editingAppointment.id),
      )
      .map((a) => a.time),
  );
  const availableTimeOptions = generateTimeSlots().filter(
    (t) => !bookedTimesForSelectedDay.has(t),
  );

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

  const selectedDateIsPast = isPastDate(selectedDate);

  function openAddModal() {
    if (isPastDate(selectedDate)) return;
    setEditingAppointment(null);
    setForm({ ...EMPTY_FORM, time: availableTimeOptions[0] || "08:00" });
    setFormError("");
    setShowAddModal(true);
  }

  function openEditModal(appointment) {
    setEditingAppointment(appointment);
    setForm({
      ...EMPTY_FORM,
      bookingMode: "existing",
      patientId: appointment.patientId || "",
      patientName: appointment.patientName,
      time: appointment.time,
      type: appointment.type,
      notes: appointment.notes || "",
    });
    setFormError("");
    setShowAddModal(true);
  }

  // Double-clicking a day on the calendar jumps straight to booking on that
  // day, skipping the extra step of selecting it first.
  function handleDayDoubleClick(dateStr) {
    if (isPastDate(dateStr)) return;
    setSelectedDate(dateStr);
    setEditingAppointment(null);
    setForm({ ...EMPTY_FORM });
    setFormError("");
    setShowAddModal(true);
  }

  async function handleSaveAppointment() {
    if (isPastDate(selectedDate)) {
      return setFormError(
        "This date has already passed — appointments can't be booked in the past.",
      );
    }
    if (!form.time) return setFormError("Please select a time.");

    if (form.bookingMode === "existing" && !editingAppointment) {
      if (!form.patientId) return setFormError("Please select a patient.");
    }
    if (form.bookingMode === "new") {
      if (!form.patientName.trim())
        return setFormError("Please enter the patient's name.");
      if (!form.patientIdNumber.trim())
        return setFormError("Please enter the patient's ID or passport number.");
    }

    try {
      if (editingAppointment) {
        await updateAppointment(editingAppointment.id, {
          time: form.time,
          type: form.type,
          notes: form.notes,
        });
      } else if (form.bookingMode === "existing") {
        await createAppointment({
          patientId: form.patientId,
          patientName: form.patientName,
          secretaryId: currentUser?.uid,
          date: selectedDate,
          time: form.time,
          type: form.type,
          notes: form.notes,
          status: "confirmed",
        });
      } else {
        // New / walk-in patient booked by phone, email, or in person. If
        // this ID number already belongs to a registered account, attach
        // the appointment straight to that account instead of leaving it
        // unlinked.
        const idNumber = form.patientIdNumber.trim();
        const existingUser = await getUserByIdNumber(idNumber);

        await createAppointment({
          patientId: existingUser?.id || null,
          patientName: existingUser?.name || form.patientName.trim(),
          patientIdNumber: idNumber,
          patientPhone: form.patientPhone.trim(),
          contactMethod: form.contactMethod,
          secretaryId: currentUser?.uid,
          date: selectedDate,
          time: form.time,
          type: form.type,
          notes: form.notes,
          status: "confirmed",
        });
      }
      setShowAddModal(false);
    } catch (err) {
      console.error(err);
      setFormError(
        "Something went wrong saving this appointment. Please try again.",
      );
    }
  }

  async function handleConfirmDelay() {
    if (!delayTarget) return;
    const newTime = addMinutesToTime(delayTarget.time, delayMinutes);
    await markAppointmentDelay(delayTarget, delayMinutes, delayNote, newTime);
    setDelayTarget(null);
    setDelayMinutes(DELAY_OPTIONS[0]);
    setDelayNote("");
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    await deleteAppointment(deleteTarget.id);
    setDeleteTarget(null);
  }

  async function toggleDayBlocked() {
    if (isDayBlocked && blockedRecordForDay) {
      await unblockSlot(blockedRecordForDay.id);
    } else {
      await blockDate(selectedDate, "Marked unavailable by secretary");
    }
  }

  return (
    <SecretaryLayout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        <BackButton />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Schedule</h1>
            <p className="text-slate text-sm">
              Manage appointments and availability
            </p>
          </div>
          <button
            onClick={openAddModal}
            disabled={selectedDateIsPast}
            title={
              selectedDateIsPast
                ? "Can't add appointments to a date that has passed"
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
                const dayAppts = appointmentsByDate[cell.dateStr] || [];
                const blocked = blockedSlots.some(
                  (b) => b.date === cell.dateStr && b.time === null,
                );
                const isSelected = cell.dateStr === selectedDate;
                const isPast = isPastDate(cell.dateStr);
                return (
                  <button
                    key={cell.dateStr}
                    onClick={() => setSelectedDate(cell.dateStr)}
                    onDoubleClick={() => handleDayDoubleClick(cell.dateStr)}
                    title={isPast ? "Past date — view only" : "Double-click to book"}
                    className={`aspect-square rounded-lg text-sm flex flex-col items-center justify-center gap-0.5 transition-colors
                      ${!cell.inMonth ? "text-stone" : isPast ? "text-slate" : "text-ink"}
                      ${isSelected ? "bg-rose text-white" : isToday(cell.dateStr) ? "bg-blush" : "hover:bg-mist"}`}
                  >
                    <span>{cell.day}</span>
                    {blocked && (
                      <span className="w-1 h-1 rounded-full bg-red" />
                    )}
                    {!blocked && dayAppts.length > 0 && (
                      <span
                        className={`w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-rose"}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Day detail panel */}
          <Card padded={false} className="h-fit">
            <div className="px-5 py-4 border-b border-sand flex items-center justify-between">
              <div>
                <p className="text-sm text-slate">Selected day</p>
                <p className="font-semibold text-ink text-sm">
                  {formatDisplayDate(selectedDate)}
                </p>
              </div>
              <button
                onClick={toggleDayBlocked}
                title={
                  isDayBlocked
                    ? "Make day available again"
                    : "Mark day unavailable"
                }
                className={`p-2 rounded-lg ${isDayBlocked ? "bg-pastel-red text-red" : "text-slate hover:bg-mist"}`}
              >
                <Ban size={18} />
              </button>
            </div>

            {isDayBlocked && !selectedDateIsPast && (
              <p className="px-5 py-2 text-xs text-red bg-pastel-red">
                This day is marked unavailable for bookings.
              </p>
            )}

            {selectedDateIsPast && (
              <p className="px-5 py-2 text-xs text-slate bg-mist">
                This date has passed. View passed appointments.
              </p>
            )}

            <button
              onClick={openAddModal}
              disabled={selectedDateIsPast}
              className="md:hidden w-full flex items-center justify-center gap-2 bg-rose text-white py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={18} /> Add appointment
            </button>

            {loading ? (
              <p className="text-slate text-sm px-5 py-8 text-center">
                Loading...
              </p>
            ) : selectedDayAppointments.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No appointments"
                message="Nothing booked for this day yet."
              />
            ) : (
              <div className="divide-y divide-sand">
                {selectedDayAppointments.map((a) => (
                  <div key={a.id} className="px-5 py-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {formatTime(a.time)} · {a.patientName}
                          {!a.patientId && a.patientIdNumber && (
                            <span className="text-slate font-normal">
                              {" "}(ID: {a.patientIdNumber})
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate capitalize">
                          {a.type} consult
                          {!a.patientId && " · not yet registered"}
                        </p>
                        {a.status === "delayed" && a.delayedTime && (
                          <p className="text-xs text-amber mt-1">
                            Running {a.delayMinutes} min late → now{" "}
                            {formatTime(a.delayedTime)}
                          </p>
                        )}
                      </div>
                      <Badge status={a.status} />
                    </div>
                    <div className="flex gap-3 mt-3">
                      <button
                        onClick={() => setDelayTarget(a)}
                        className="text-xs font-medium text-amber hover:underline flex items-center gap-1"
                      >
                        <Clock size={13} /> Mark delay
                      </button>
                      <button
                        onClick={() => openEditModal(a)}
                        className="text-xs font-medium text-slate hover:underline flex items-center gap-1"
                      >
                        <Pencil size={13} /> Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(a)}
                        className="text-xs font-medium text-red hover:underline flex items-center gap-1"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Add / Edit appointment modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={editingAppointment ? "Edit appointment" : "Add appointment"}
        confirmLabel={
          editingAppointment ? "Save changes" : "Confirm appointment"
        }
        onConfirm={handleSaveAppointment}
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate -mt-2">
            {formatDisplayDate(selectedDate)}
          </p>

          {!editingAppointment && (
            <div className="flex gap-2 -mt-1">
              <button
                type="button"
                onClick={() => setForm({ ...EMPTY_FORM, bookingMode: "existing", time: form.time })}
                className={`flex-1 rounded-xl py-2.5 text-sm font-medium border transition-colors ${
                  form.bookingMode === "existing"
                    ? "bg-rose text-white border-rose"
                    : "border-stone text-ink hover:border-rose"
                }`}
              >
                Existing patient
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...EMPTY_FORM, bookingMode: "new", time: form.time })}
                className={`flex-1 rounded-xl py-2.5 text-sm font-medium border transition-colors ${
                  form.bookingMode === "new"
                    ? "bg-rose text-white border-rose"
                    : "border-stone text-ink hover:border-rose"
                }`}
              >
                New / walk-in patient
              </button>
            </div>
          )}

          {form.bookingMode === "existing" || editingAppointment ? (
            <div>
              <label className="text-xs text-slate mb-1 block">Patient</label>
              <select
                value={form.patientId}
                disabled={!!editingAppointment}
                onChange={(e) => {
                  const p = patients.find((p) => p.id === e.target.value);
                  setForm({
                    ...form,
                    patientId: e.target.value,
                    patientName: p?.name || "",
                  });
                }}
                className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none disabled:bg-sand"
              >
                <option value="">Select a patient...</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.idNumber ? `· ID: ${p.idNumber}` : `(${p.email})`}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-slate mb-1 block">Patient's full name</label>
                <input
                  value={form.patientName}
                  onChange={(e) => setForm({ ...form, patientName: e.target.value })}
                  placeholder="e.g. Thandiwe Nkosi"
                  className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate mb-1 block">ID type</label>
                  <select
                    value={form.patientIdType}
                    onChange={(e) => setForm({ ...form, patientIdType: e.target.value })}
                    className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
                  >
                    <option value="sa_id">SA ID</option>
                    <option value="passport">Passport</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate mb-1 block">ID / passport number</label>
                  <input
                    value={form.patientIdNumber}
                    onChange={(e) => setForm({ ...form, patientIdNumber: e.target.value })}
                    placeholder="e.g. 9001015800086"
                    className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate mb-1 block">Phone number</label>
                <input
                  value={form.patientPhone}
                  onChange={(e) => setForm({ ...form, patientPhone: e.target.value })}
                  placeholder="e.g. 082 123 4567"
                  className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate mb-1 block">How were they contacted?</label>
                <select
                  value={form.contactMethod}
                  onChange={(e) => setForm({ ...form, contactMethod: e.target.value })}
                  className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
                >
                  <option value="in-person">In person</option>
                  <option value="phone">Phone call</option>
                  <option value="email">Email</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-slate mb-1 block">Time slot</label>
            <select
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
            >
              {(editingAppointment
                ? [editingAppointment.time, ...availableTimeOptions]
                : availableTimeOptions
              )
                .filter((t, i, arr) => arr.indexOf(t) === i)
                .map((t) => (
                  <option key={t} value={t}>
                    {formatTime(t)}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate mb-1 block">
              Appointment type
            </label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
            >
              <option value="in-person">In-person</option>
              <option value="virtual">Virtual</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate mb-1 block">
              Notes (optional)
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
            />
          </div>

          {formError && <p className="text-red text-sm">{formError}</p>}
        </div>
      </Modal>

      {/* Mark delay modal */}
      <Modal
        isOpen={!!delayTarget}
        onClose={() => setDelayTarget(null)}
        title={
          delayTarget
            ? `${delayTarget.patientName} · ${formatTime(delayTarget.time)}`
            : ""
        }
        confirmLabel="Confirm delay — notify patient"
        confirmVariant="primary"
        onConfirm={handleConfirmDelay}
      >
        <p className="text-sm text-slate mb-3">
          How long is the doctor running late?
        </p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {DELAY_OPTIONS.map((mins) => (
            <button
              key={mins}
              onClick={() => setDelayMinutes(mins)}
              className={`rounded-xl py-3 text-sm font-medium border transition-colors ${
                delayMinutes === mins
                  ? "bg-rose text-white border-rose"
                  : "border-stone text-ink hover:border-rose"
              }`}
            >
              {mins} min{mins === 45 ? "+" : ""}
            </button>
          ))}
        </div>
        <label className="text-xs text-slate mb-1 block">Note (optional)</label>
        <textarea
          value={delayNote}
          onChange={(e) => setDelayNote(e.target.value)}
          rows={2}
          placeholder="e.g. Running behind from previous consult"
          className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
        />
        {delayTarget && (
          <p className="text-xs text-slate mt-3">
            Patient will be notified their {formatTime(delayTarget.time)}{" "}
            appointment is now expected at{" "}
            {formatTime(addMinutesToTime(delayTarget.time, delayMinutes))}.
          </p>
        )}
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete appointment?"
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleConfirmDelete}
      >
        <p className="text-sm text-slate">
          This will permanently remove {deleteTarget?.patientName}'s{" "}
          {deleteTarget && formatTime(deleteTarget.time)} appointment. This
          cannot be undone.
        </p>
      </Modal>
    </SecretaryLayout>
  );
}