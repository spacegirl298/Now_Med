// Secretary landing screen: today's stats, today's schedule, and a live
// patient search bar (must-have - see PRD section "Home Dashboard").
import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Clock, MessageSquare, ClipboardList } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useAppointments } from "../../hooks/useAppointments";
import { useUnreadMessages } from "../../hooks/useUnreadMessages";
import SecretaryLayout from "./SecretaryLayout";
import Card from "../../components/Card";
import Badge from "../../components/Badge";
import Avatar from "../../components/Avatar";
import EmptyState from "../../components/EmptyState";
import {
  getTodayString,
  formatTime,
  formatDisplayDate,
  greetingForNow,
} from "../../utils/dateHelpers";
import {
  getAllPatients,
  subscribeToPendingChangeRequests,
} from "../../firebase/firestore";

export default function SecretaryDashboard() {
  const { currentUser, userName } = useAuth();
  const { appointments, loading, error } = useAppointments();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [patients, setPatients] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const unreadMessages = useUnreadMessages();

  useEffect(() => {
    getAllPatients()
      .then(setPatients)
      .catch(() => setPatients([]));
  }, []);

  // Patient requests to change details they can't edit themselves.
  useEffect(() => {
    const unsub = subscribeToPendingChangeRequests(
      setPendingRequests,
      (err) => console.error(err),
    );
    return () => unsub && unsub();
  }, []);

  const today = getTodayString();

  const todaysAppointments = useMemo(() => {
    return appointments
      .filter((a) => a.date === today)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, today]);

  const delayedCount = todaysAppointments.filter(
    (a) => a.status === "delayed",
  ).length;
  const confirmedCount = todaysAppointments.filter(
    (a) => a.status === "confirmed",
  ).length;

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.trim().toLowerCase();
    return patients
      .filter((p) => (p.name || "").toLowerCase().includes(term))
      .slice(0, 6);
  }, [searchTerm, patients]);

  const displayName =
    userName || currentUser?.email?.split("@")[0] || "there";

  return (
    <SecretaryLayout>
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

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
          <Card className="text-center md:text-left">
            <p className="text-2xl md:text-3xl font-semibold text-ink">
              {todaysAppointments.length}
            </p>
            <p className="text-xs md:text-sm text-slate">
              Today's appointments
            </p>
          </Card>
          <Card className="text-center md:text-left">
            <p className="text-2xl md:text-3xl font-semibold text-amber">
              {delayedCount}
            </p>
            <p className="text-xs md:text-sm text-slate">Delayed</p>
          </Card>
          <Card className="text-center md:text-left">
            <p className="text-2xl md:text-3xl font-semibold text-green">
              {confirmedCount}
            </p>
            <p className="text-xs md:text-sm text-slate">Confirmed</p>
          </Card>
        </div>

        {/* Patient search */}
        <Card className="mb-6">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate"
            />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search patients by name..."
              className="w-full border border-stone rounded-xl pl-10 pr-4 py-3 text-ink focus:border-rose focus:outline-none"
            />
          </div>

          {searchResults.length > 0 && (
            <div className="mt-3 flex flex-col divide-y divide-sand">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() =>
                    navigate("/secretary/patients", {
                      state: { openPatientId: p.id },
                    })
                  }
                  className="flex items-center gap-3 py-3 text-left hover:bg-mist rounded-lg px-2 -mx-2"
                >
                  <Avatar name={p.name} size={36} />
                  <div>
                    <p className="text-sm font-medium text-ink">{p.name}</p>
                    <p className="text-xs text-slate">{p.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Needs attention: unread chat + pending record-change requests */}
        {(unreadMessages > 0 || pendingRequests.length > 0) && (
          <Card padded={false} className="mb-6">
            <div className="px-5 py-4 border-b border-sand">
              <h2 className="font-semibold text-ink">Needs your attention</h2>
            </div>
            <div className="divide-y divide-sand">
              {unreadMessages > 0 && (
                <button
                  onClick={() => navigate("/secretary/messages")}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-mist transition-colors"
                >
                  <MessageSquare size={18} className="text-rose shrink-0" />
                  <p className="text-sm text-ink">
                    {unreadMessages} unread message
                    {unreadMessages === 1 ? "" : "s"} from patients
                  </p>
                </button>
              )}
              {pendingRequests.slice(0, 5).map((r) => (
                <button
                  key={r.id}
                  onClick={() =>
                    navigate("/secretary/patients", {
                      state: { openPatientId: r.patientId, openTab: "requests" },
                    })
                  }
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-mist transition-colors"
                >
                  <ClipboardList size={18} className="text-amber shrink-0" />
                  <div>
                    <p className="text-sm text-ink">
                      {r.patientName || "A patient"} asked to change their{" "}
                      {(r.section || "details").toLowerCase()}
                    </p>
                    <p className="text-xs text-slate truncate">
                      {r.requestedChange}
                    </p>
                  </div>
                </button>
              ))}
              {pendingRequests.length > 5 && (
                <p className="px-5 py-3 text-xs text-slate">
                  + {pendingRequests.length - 5} more pending requests
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Today's schedule */}
        <Card padded={false}>
          <div className="px-5 py-4 border-b border-sand">
            <h2 className="font-semibold text-ink">Today's schedule</h2>
          </div>

          {loading ? (
            <p className="text-slate text-sm px-5 py-8 text-center">
              Loading appointments...
            </p>
          ) : todaysAppointments.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No appointments today"
              message="Nothing scheduled for today yet. Add one from the Schedule page."
              actionLabel="Go to schedule"
              onAction={() => navigate("/secretary/schedule")}
            />
          ) : (
            <div className="divide-y divide-sand">
              {todaysAppointments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between px-5 py-4"
                >
                  <div className="flex items-center gap-4">
                    <p className="text-sm font-medium text-ink w-16">
                      {formatTime(a.time)}
                    </p>
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {a.patientName}
                      </p>
                      <p className="text-xs text-slate capitalize">
                        {a.type} consult
                      </p>
                    </div>
                  </div>
                  <Badge status={a.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </SecretaryLayout>
  );
}