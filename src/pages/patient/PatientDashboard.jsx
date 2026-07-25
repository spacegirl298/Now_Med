// Patient landing screen: today's greeting, a snapshot of the patient's own
// appointments and records, a delay banner if the next visit is running late,
// and quick access into the booking calendar. Patients only ever see their
// own data here — never other patients' appointments (see useAppointments,
// which scopes the Firestore query by role).
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarPlus, Clock, FileText, CalendarCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useAppointments } from "../../hooks/useAppointments";
import PatientLayout from "./PatientLayout";
import Card from "../../components/Card";
import Badge from "../../components/Badge";
import EmptyState from "../../components/EmptyState";
import {
  getTodayString,
  formatTime,
  formatShortDate,
  formatDisplayDate,
  greetingForNow,
} from "../../utils/dateHelpers";
import { getPatientRecords } from "../../firebase/firestore";

export default function PatientDashboard() {
  const { currentUser, userName } = useAuth();
  const { appointments, loading, error } = useAppointments();
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    getPatientRecords(currentUser.uid)
      .then(setRecords)
      .catch(() => setRecords([]));
  }, [currentUser]);

  const today = getTodayString();
  const displayName = userName || currentUser?.email?.split("@")[0] || "there";

  const upcomingAppointments = useMemo(() => {
    return appointments
      .filter((a) => a.date >= today && a.status !== "cancelled")
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [appointments, today]);

  const nextAppointment = upcomingAppointments[0] || null;
  const isNextDelayed = nextAppointment?.status === "delayed";

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

        {isNextDelayed && (
          <div className="bg-pastel-amber text-amber text-sm rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
            <Clock size={16} />
            Your {formatTime(nextAppointment.time)} appointment on{" "}
            {formatShortDate(nextAppointment.date)} is running{" "}
            {nextAppointment.delayMinutes} min late
            {nextAppointment.delayedTime
              ? ` — now expected at ${formatTime(nextAppointment.delayedTime)}.`
              : "."}
          </div>
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

        {/* Book an appointment CTA */}
        <Card className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-ink mb-1">Need to see the doctor?</p>
            <p className="text-sm text-slate">
              Check the calendar for open slots and confirm a booking in a few taps.
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