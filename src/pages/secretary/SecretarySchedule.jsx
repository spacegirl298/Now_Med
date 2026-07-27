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
  CheckCircle2,
  BellRing,
  Undo2,
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
import { DELAY_OPTIONS, CONFIRMATION_METHODS } from "../../utils/validators";
import {
  getAllPatients,
  getUserByIdNumber,
  blockDate,
  blockTimeSlots,
  unblockSlot,
  unblockGroup,
  subscribeToBlockedSlots,
  confirmAppointment,
  unconfirmAppointment,
  sendConfirmationReminder,
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
    cancelAppointment,
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
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const [patientSearchTerm, setPatientSearchTerm] = useState("");
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockMode, setBlockMode] = useState("day"); // 'day' | 'hours'
  const [blockTitle, setBlockTitle] = useState("");
  const [blockStart, setBlockStart] = useState("08:00");
  const [blockEnd, setBlockEnd] = useState("09:00");
  const [blockError, setBlockError] = useState("");
  const [savingBlock, setSavingBlock] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState(null); // appointment being confirmed
  const [confirmMethod, setConfirmMethod] = useState("whatsapp");
  const [confirmingBusy, setConfirmingBusy] = useState(false);
  const [reminderBusyId, setReminderBusyId] = useState(null);

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

  // Titled hour-range blocks (e.g. "Lunch break" 12:00-13:00) for the
  // selected day, grouped back together by groupId so they render — and get
  // removed — as one entry instead of one row per 30-minute slot.
  const blockedHourGroupsForSelectedDay = useMemo(() => {
    const groups = {};
    blockedSlots
      .filter((b) => b.date === selectedDate && b.time !== null)
      .forEach((b) => {
        const key = b.groupId || b.id;
        if (!groups[key]) {
          groups[key] = {
            key,
            groupId: b.groupId,
            id: b.id,
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

  const filteredPatientOptions = useMemo(() => {
    const term = patientSearchTerm.trim().toLowerCase();
    if (!term) return patients.slice(0, 8);
    return patients
      .filter(
        (p) =>
          (p.name || "").toLowerCase().includes(term) ||
          (p.idNumber || "").toLowerCase().includes(term) ||
          (p.email || "").toLowerCase().includes(term),
      )
      .slice(0, 8);
  }, [patients, patientSearchTerm]);

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
    setPatientSearchTerm("");
    setShowPatientDropdown(false);
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
      patientIdNumber: appointment.patientIdNumber || "",
      time: appointment.time,
      type: appointment.type,
      notes: appointment.notes || "",
    });
    setPatientSearchTerm(appointment.patientName || "");
    setShowPatientDropdown(false);
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
    setPatientSearchTerm("");
    setShowPatientDropdown(false);
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
          status: "booked",
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
          status: "booked",
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

  // Cancelling (unlike deleting) keeps the appointment on record as
  // "cancelled" and notifies the patient if they have an account — use this
  // for a patient-initiated or practice-initiated cancellation. Delete is
  // for permanently removing a mistaken/duplicate entry.
  async function handleConfirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError("");
    try {
      await cancelAppointment(cancelTarget);
      setCancelTarget(null);
    } catch (err) {
      console.error("Failed to cancel appointment:", err);
      setCancelError("Something went wrong cancelling this appointment. Please try again.");
    }
    setCancelling(false);
  }

  // Quick toggle for the Ban icon: unblocking needs no extra info so it
  // happens instantly. Blocking needs a title (and mode) patients will see,
  // so that opens the one combined modal instead.
  async function handleBanIconClick() {
    if (isDayBlocked && blockedRecordForDay) {
      await unblockSlot(blockedRecordForDay.id);
    } else {
      openBlockModal();
    }
  }

  function openBlockModal() {
    if (isPastDate(selectedDate)) return;
    setBlockMode("day");
    setBlockTitle("");
    setBlockStart("08:00");
    setBlockEnd("09:00");
    setBlockError("");
    setShowBlockModal(true);
  }

  async function handleSaveBlock() {
    setBlockError("");
    if (!blockTitle.trim()) {
      return setBlockError(
        'Please add a title patients will see, e.g. "Public holiday" or "Lunch break".',
      );
    }

    setSavingBlock(true);
    try {
      if (blockMode === "day") {
        await blockDate(selectedDate, blockTitle.trim());
      } else {
        if (blockStart >= blockEnd) {
          setBlockError("End time must be after the start time.");
          setSavingBlock(false);
          return;
        }
        const slots = generateTimeSlots(blockStart, blockEnd);
        if (slots.length === 0) {
          setBlockError("Please choose a valid time range.");
          setSavingBlock(false);
          return;
        }
        await blockTimeSlots(selectedDate, slots, blockTitle.trim());
      }
      setShowBlockModal(false);
    } catch (err) {
      console.error(err);
      setBlockError("Could not save this block. Please try again.");
    }
    setSavingBlock(false);
  }

  async function handleRemoveHourGroup(group) {
    if (group.groupId) {
      await unblockGroup(group.groupId);
    } else {
      await unblockSlot(group.id);
    }
  }

  function openConfirmModal(appointment) {
    setConfirmTarget(appointment);
    setConfirmMethod("whatsapp");
  }

  async function handleConfirmAppointment() {
    if (!confirmTarget) return;
    setConfirmingBusy(true);
    try {
      await confirmAppointment(confirmTarget, confirmMethod);
      setConfirmTarget(null);
    } catch (err) {
      console.error(err);
    }
    setConfirmingBusy(false);
  }

  async function handleUnconfirm(appointment) {
    try {
      await unconfirmAppointment(appointment.id);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSendReminder(appointment) {
    setReminderBusyId(appointment.id);
    try {
      await sendConfirmationReminder(appointment);
    } catch (err) {
      console.error(err);
    }
    setReminderBusyId(null);
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
              <div className="flex items-center gap-1">
                <button
                  onClick={handleBanIconClick}
                  disabled={selectedDateIsPast}
                  title={
                    isDayBlocked
                      ? "Make day available again"
                      : "Mark day unavailable"
                  }
                  className={`p-2 rounded-lg disabled:opacity-40 ${isDayBlocked ? "bg-pastel-red text-red" : "text-slate hover:bg-mist"}`}
                >
                  <Ban size={18} />
                </button>
              </div>
            </div>

            {isDayBlocked && !selectedDateIsPast && (
              <p className="px-5 py-2 text-xs text-red bg-pastel-red">
                This day is marked unavailable
                {blockedRecordForDay?.title && (
                  <> — "{blockedRecordForDay.title}"</>
                )}
                . Patients see this instead of open slots.
              </p>
            )}

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
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveHourGroup(g)}
                      className="text-xs font-medium text-red hover:underline shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
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
                        {a.status === "confirmed" && a.confirmedVia && (
                          <p className="text-xs text-green mt-1 capitalize">
                            Confirmed via{" "}
                            {a.confirmedVia === "call"
                              ? "phone call"
                              : a.confirmedVia}
                          </p>
                        )}
                        {a.status === "booked" && a.reminderSentAt && (
                          <p className="text-xs text-slate mt-1">
                            Reminder sent
                          </p>
                        )}
                      </div>
                      <Badge status={a.status} />
                    </div>
                    <div className="flex flex-wrap gap-3 mt-3">
                      {a.status === "booked" && (
                        <>
                          <button
                            onClick={() => openConfirmModal(a)}
                            className="text-xs font-medium text-green hover:underline flex items-center gap-1"
                          >
                            <CheckCircle2 size={13} /> Confirm
                          </button>
                          <button
                            onClick={() => handleSendReminder(a)}
                            disabled={reminderBusyId === a.id}
                            className="text-xs font-medium text-blue hover:underline flex items-center gap-1 disabled:opacity-50"
                          >
                            <BellRing size={13} />
                            {reminderBusyId === a.id
                              ? "Sending..."
                              : "Send reminder"}
                          </button>
                        </>
                      )}
                      {a.status === "confirmed" && (
                        <button
                          onClick={() => handleUnconfirm(a)}
                          className="text-xs font-medium text-slate hover:underline flex items-center gap-1"
                        >
                          <Undo2 size={13} /> Mark as booked
                        </button>
                      )}
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
                      {a.status !== "cancelled" && (
                        <button
                          onClick={() => setCancelTarget(a)}
                          className="text-xs font-medium text-red hover:underline flex items-center gap-1"
                        >
                          <Ban size={13} /> Cancel
                        </button>
                      )}
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
                onClick={() => {
                  setForm({ ...EMPTY_FORM, bookingMode: "existing", time: form.time })
                  setPatientSearchTerm("")
                  setShowPatientDropdown(false)
                }}
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
                onClick={() => {
                  setForm({ ...EMPTY_FORM, bookingMode: "new", time: form.time })
                  setPatientSearchTerm("")
                  setShowPatientDropdown(false)
                }}
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

          {editingAppointment ? (
            <div>
              <label className="text-xs text-slate mb-1 block">Patient</label>
              <div className="w-full border border-stone rounded-xl px-4 py-3 text-ink bg-sand">
                {form.patientName || "Unnamed patient"}
                {!form.patientId && form.patientIdNumber && (
                  <span className="text-slate"> (ID: {form.patientIdNumber})</span>
                )}
              </div>
            </div>
          ) : form.bookingMode === "existing" ? (
            <div className="relative">
              <label className="text-xs text-slate mb-1 block">Patient</label>
              <input
                value={patientSearchTerm}
                onChange={(e) => {
                  setPatientSearchTerm(e.target.value);
                  setForm({ ...form, patientId: "", patientName: e.target.value });
                  setShowPatientDropdown(true);
                }}
                onFocus={() => setShowPatientDropdown(true)}
                onBlur={() => setTimeout(() => setShowPatientDropdown(false), 150)}
                placeholder="Search patients by name, email, or ID..."
                autoComplete="off"
                className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
              />
              {showPatientDropdown && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-stone rounded-xl max-h-48 overflow-y-auto shadow-lg">
                  {filteredPatientOptions.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate">No patients match that search.</p>
                  ) : (
                    filteredPatientOptions.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onMouseDown={() => {
                          setForm({ ...form, patientId: p.id, patientName: p.name });
                          setPatientSearchTerm(p.name);
                          setShowPatientDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-ink hover:bg-mist transition-colors"
                      >
                        {p.name} {p.idNumber ? `· ID: ${p.idNumber}` : `(${p.email})`}
                      </button>
                    ))
                  )}
                </div>
              )}
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

      {/* Cancel confirmation modal */}
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
        confirmDisabled={cancelling}
        cancelLabel="Keep it"
      >
        <p className="text-sm text-slate">
          This will mark {cancelTarget?.patientName}'s{" "}
          {cancelTarget && formatTime(cancelTarget.time)} appointment as
          cancelled{cancelTarget?.patientId ? " and notify them in-app" : ""}.
          It stays on record — use Delete instead if you want to remove it
          entirely.
        </p>
        {cancelError && <p className="text-xs text-red mt-3">{cancelError}</p>}
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

      {/* Block availability modal — one entry point (the Ban icon) for
          blocking either the whole day or specific hours, with a title
          patients see instead of open slots on their calendar. */}
      <Modal
        isOpen={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        title="Block availability"
        confirmLabel={savingBlock ? "Saving..." : "Block"}
        onConfirm={handleSaveBlock}
        confirmDisabled={savingBlock}
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate -mt-2">
            {formatDisplayDate(selectedDate)}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBlockMode("day")}
              className={`flex-1 rounded-xl py-2.5 text-sm font-medium border transition-colors ${
                blockMode === "day"
                  ? "bg-rose text-white border-rose"
                  : "border-stone text-ink hover:border-rose"
              }`}
            >
              Whole day
            </button>
            <button
              type="button"
              onClick={() => setBlockMode("hours")}
              className={`flex-1 rounded-xl py-2.5 text-sm font-medium border transition-colors ${
                blockMode === "hours"
                  ? "bg-rose text-white border-rose"
                  : "border-stone text-ink hover:border-rose"
              }`}
            >
              Specific hours
            </button>
          </div>

          {blockMode === "hours" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate mb-1 block">From</label>
                <select
                  value={blockStart}
                  onChange={(e) => setBlockStart(e.target.value)}
                  className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
                >
                  {generateTimeSlots().map((t) => (
                    <option key={t} value={t}>
                      {formatTime(t)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate mb-1 block">To</label>
                <select
                  value={blockEnd}
                  onChange={(e) => setBlockEnd(e.target.value)}
                  className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
                >
                  {generateTimeSlots("08:30", "17:30").map((t) => (
                    <option key={t} value={t}>
                      {formatTime(t)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-slate mb-1 block">
              Title patients will see
            </label>
            <input
              value={blockTitle}
              onChange={(e) => setBlockTitle(e.target.value)}
              placeholder='e.g. "Public holiday" or "Lunch break"'
              className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
            />
          </div>

          {blockError && <p className="text-red text-sm">{blockError}</p>}
        </div>
      </Modal>

      {/* Confirm appointment modal — records how the confirmation happened */}
      <Modal
        isOpen={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        title={
          confirmTarget
            ? `Confirm ${confirmTarget.patientName}'s appointment`
            : ""
        }
        confirmLabel={confirmingBusy ? "Confirming..." : "Confirm appointment"}
        onConfirm={handleConfirmAppointment}
        confirmDisabled={confirmingBusy}
      >
        <div className="flex flex-col gap-4">
          {confirmTarget && (
            <p className="text-sm text-slate">
              {formatDisplayDate(confirmTarget.date)} ·{" "}
              {formatTime(confirmTarget.time)}
            </p>
          )}
          <div>
            <label className="text-xs text-slate mb-1 block">
              How was this confirmed?
            </label>
            <select
              value={confirmMethod}
              onChange={(e) => setConfirmMethod(e.target.value)}
              className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
            >
              {CONFIRMATION_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </SecretaryLayout>
  );
}