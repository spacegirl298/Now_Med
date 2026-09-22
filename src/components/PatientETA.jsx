// Patient's own ETA to the practice for a specific upcoming appointment -
// NOT a doctor's location/travel (the doctor is already at the practice).
// Sits on the "next appointment" card in PatientDashboard.
//
// Arrival buffer policy: new patients (no prior completed visit) are asked
// to arrive 15 minutes early (paperwork/intake); returning patients, 5
// minutes. isNewPatient is passed in - computed by the caller from the
// patient's own appointment history, since that's already loaded there via
// useAppointments and needs no extra query.
import { useState } from "react";
import {
  Navigation,
  ExternalLink,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  MapPin,
} from "lucide-react";
import { getDrivingETA } from "../utils/googleMaps";
import { reportPatientRunningLate, sendMessage } from "../firebase/firestore";
import { useAuth } from "../context/AuthContext";
import PracticeMap from "./PracticeMap";
import Modal from "./Modal";

const NEW_PATIENT_BUFFER_MINUTES = 15;
const RETURNING_PATIENT_BUFFER_MINUTES = 5;

function formatClockTime(date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function PatientETA({ appointment, doctor, isNewPatient }) {
  const { currentUser, userName } = useAuth();
  const [state, setState] = useState("idle"); // idle | locating | loading | done | error
  const [eta, setEta] = useState(null);
  const [error, setError] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);

  if (doctor?.lat == null || doctor?.lng == null) return null;
  if (!appointment) return null;

  const appointmentDate = appointment.appointmentAt?.toDate
    ? appointment.appointmentAt.toDate()
    : new Date(`${appointment.date}T${appointment.time}:00`);

  const bufferMinutes = isNewPatient
    ? NEW_PATIENT_BUFFER_MINUTES
    : RETURNING_PATIENT_BUFFER_MINUTES;

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${doctor.lat},${doctor.lng}`;

  // Once we have a driving duration, work out whether leaving right now
  // gets them there inside the recommended buffer, still on time for the
  // appointment itself, or actually late.
  let assessment = null;
  if (eta) {
    const estimatedArrival = new Date(Date.now() + eta.durationMinutes * 60000);
    const recommendedArrivalBy = new Date(
      appointmentDate.getTime() - bufferMinutes * 60000,
    );
    const leaveBy = new Date(
      recommendedArrivalBy.getTime() - eta.durationMinutes * 60000,
    );

    if (estimatedArrival <= recommendedArrivalBy) {
      assessment = {
        level: "ontrack",
        message: `Leave by ${formatClockTime(leaveBy)} to arrive ${bufferMinutes} min early, as recommended for ${isNewPatient ? "new" : "returning"} patients.`,
      };
    } else if (estimatedArrival <= appointmentDate) {
      assessment = {
        level: "tight",
        message: `Leaving now gets you there around ${formatClockTime(estimatedArrival)} - later than the ${bufferMinutes}-min-early window the practice recommends, but still before your appointment time.`,
      };
    } else {
      const minutesLate = Math.round(
        (estimatedArrival.getTime() - appointmentDate.getTime()) / 60000,
      );
      assessment = {
        level: "late",
        message: `Leaving now, you'd likely arrive around ${formatClockTime(estimatedArrival)} - about ${minutesLate} min after your appointment time.`,
        minutesLate,
      };
    }
  }

  async function handleGetEta() {
    setShowLocationPrompt(false);
    setError("");
    setEta(null);

    if (!navigator.geolocation) {
      setError("Your browser doesn't support location lookup.");
      setState("error");
      return;
    }

    setState("locating");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setState("loading");
        try {
          const result = await getDrivingETA({
            originLat: position.coords.latitude,
            originLng: position.coords.longitude,
            destLat: doctor.lat,
            destLng: doctor.lng,
          });
          setEta(result);
          setState("done");
        } catch (err) {
          setError(err.message || "Could not calculate a route.");
          setState("error");
        }
      },
      (geoError) => {
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Location access was denied. You can still open directions below."
            : "Couldn't get your location. You can still open directions below.",
        );
        setState("error");
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  async function handleReportLate() {
    setReporting(true);
    try {
      await reportPatientRunningLate(
        appointment.id,
        assessment?.minutesLate ?? null,
      );
      setReported(true);
    } catch (err) {
      console.error("Could not notify the practice:", err);
      setReporting(false);
      return;
    }

    // Best-effort: the flag above is what actually drives the secretary's
    // UI, so a chat message failing shouldn't undo "reported" or block the
    // patient from seeing the flag went through.
    try {
      const minutesLate = assessment?.minutesLate;
      await sendMessage({
        patientId: appointment.patientId,
        patientName: userName || "",
        senderRole: "patient",
        senderName: userName || currentUser?.email?.split("@")[0] || "Patient",
        appointmentId: appointment.id,
        text:
          minutesLate != null
            ? `Running about ${minutesLate} min late for my appointment today.`
            : "Running late for my appointment today.",
      });
    } catch (err) {
      console.error(
        "Running-late flag saved, but the chat message failed:",
        err,
      );
    }

    setReporting(false);
  }

  return (
    <div className="mt-3 pt-3 border-t border-sand">
      {state === "done" && eta ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-sm text-ink">
            <Navigation size={14} className="text-rose shrink-0" />
            <span>
              <span className="font-medium">{eta.durationText}</span> drive
              {" · "}
              {eta.distanceText}
            </span>
          </div>
          {assessment && (
            <div className="flex items-stretch gap-2">
              <div
                className={`flex-1 min-w-0 flex items-start gap-1.5 text-xs rounded-lg px-2.5 py-2 ${
                  assessment.level === "ontrack"
                    ? "bg-pastel-green text-green"
                    : assessment.level === "tight"
                      ? "bg-pastel-amber text-amber"
                      : "bg-pastel-red text-red"
                }`}
              >
                {assessment.level === "ontrack" ? (
                  <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                )}
                <span>{assessment.message}</span>
              </div>
              {assessment.level === "late" && (
                <button
                  onClick={handleReportLate}
                  disabled={reporting || reported}
                  className="shrink-0 self-center text-xs font-medium rounded-lg px-3 py-2 leading-tight text-center max-w-[110px] transition-colors disabled:opacity-50 bg-rose text-white hover:bg-plum disabled:hover:bg-rose"
                >
                  {reported
                    ? "Practice notified"
                    : reporting
                      ? "Notifying..."
                      : "Let the practice know you're running late"}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setShowLocationPrompt(true)}
          disabled={state === "locating" || state === "loading"}
          className="flex items-center gap-1.5 text-xs font-medium text-rose disabled:opacity-50"
        >
          {state === "locating" || state === "loading" ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {state === "locating"
                ? "Finding your location..."
                : "Calculating..."}
            </>
          ) : (
            <>
              <Navigation size={14} />
              Check my travel time to the practice
            </>
          )}
        </button>
      )}

      <Modal
        isOpen={showLocationPrompt}
        onClose={() => setShowLocationPrompt(false)}
        title="Share your location?"
        confirmLabel="Allow"
        cancelLabel="Not now"
        onConfirm={handleGetEta}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blush flex items-center justify-center shrink-0">
            <MapPin size={18} className="text-rose" />
          </div>
          <p className="text-sm text-slate">
            Now Med uses your current location just once, to work out your
            driving time to{" "}
            {doctor.name ? `${doctor.name}'s practice` : "the practice"} and
            suggest when to leave. Your browser will then ask you to confirm -
            we never store your location or share it with the practice.
          </p>
        </div>
      </Modal>

      {error && <p className="text-xs text-slate mt-1.5">{error}</p>}

      <PracticeMap lat={doctor.lat} lng={doctor.lng} label={doctor.name} />

      <a
        href={directionsUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1.5 text-xs text-slate hover:text-ink mt-2"
      >
        <ExternalLink size={12} />
        Open directions in Google Maps
        {doctor.address ? ` (${doctor.address})` : ""}
      </a>
    </div>
  );
}
