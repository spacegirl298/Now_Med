import { useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  Clock,
  Download,
  FileText,
  Star,
  Users,
  XCircle,
  CheckCircle2,
  FlaskConical,
} from "lucide-react";
import SecretaryLayout from "./SecretaryLayout";
import Card from "../../components/Card";
import {
  ColumnChart,
  HBarChart,
  LineChart,
  PeriodStackChart,
} from "../../components/charts/Charts";
import {
  subscribeToAllAppointments,
  subscribeToDoctors,
  subscribeToAllDoctorRatings,
} from "../../firebase/firestore";
import {
  REASON_LABELS,
  buildReport,
  formatRange,
  rangePresets,
  rowsToCsv,
  round1,
} from "../../utils/analyticsHelpers";
import { generateMockAnalyticsData } from "../../utils/mockAnalyticsData";

const ROW_LIMIT = 300; // visits shown on screen / in the PDF; the CSV has all
const minutes = (n) => `${Math.round(n)} min`;
const percent = (n) => `${Math.round(n)}%`;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// One plain-language sentence per doctor, e.g. "Ran late on 4 of 22
// appointments (18%), averaging 17 min. Most common reason: ..."
function describeDoctor(d) {
  if (!d.booked) return "No appointments this month.";
  if (!d.delayedCount) {
    return `On time for all ${plural(d.booked, "appointment")}.`;
  }
  const reason =
    d.topReason && d.topReason !== "not_recorded"
      ? ` Most common reason: ${REASON_LABELS[d.topReason] || d.topReason}.`
      : "";
  return `Ran late on ${d.delayedCount} of ${d.booked} appointments (${percent(
    d.delayRate,
  )}), averaging ${minutes(d.avgDelay)}.${reason}`;
}

function Stat({ icon: Icon, tone, value, label, sub }) {
  return (
    <Card className="print-avoid-break">
      <div className="flex items-start gap-3">
        <span className={`p-2 rounded-lg ${tone}`}>
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-semibold text-ink leading-tight">{value}</p>
          <p className="text-xs text-slate">{label}</p>
          {sub && <p className="text-xs text-slate mt-0.5">{sub}</p>}
        </div>
      </div>
    </Card>
  );
}

function Section({ title, children, className = "" }) {
  return (
    <Card className={`print-avoid-break ${className}`}>
      <h2 className="font-semibold text-ink mb-4">{title}</h2>
      {children}
    </Card>
  );
}

function downloadFile(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function SecretaryAnalytics() {
  const [appointments, setAppointments] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState("");
  const presets = useMemo(() => rangePresets(new Date()), []);
  const [preset, setPreset] = useState("this_month");
  const [range, setRange] = useState(() => ({
    start: presets.this_month.start,
    end: presets.this_month.end,
  }));
  const [doctorId, setDoctorId] = useState("all");
  // Demo mode swaps in generated sample data. Nothing is written to Firestore.
  const [demo, setDemo] = useState(false);
  const mock = useMemo(() => (demo ? generateMockAnalyticsData() : null), [demo]);

  useEffect(() => {
    const onErr = (err) => {
      console.error("Analytics subscription error:", err);
      setError("Could not load analytics data right now.");
    };
    const unsubs = [
      subscribeToAllAppointments(setAppointments, onErr),
      subscribeToDoctors(setDoctors, onErr),
      subscribeToAllDoctorRatings(setReviews, onErr),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, []);

  const source = mock || { appointments: appointments || [], doctors, reviews };
  const report = useMemo(
    () =>
      buildReport({
        appointments: source.appointments,
        doctors: source.doctors,
        reviews: source.reviews,
        range,
        doctorId,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mock, appointments, doctors, reviews, range, doctorId],
  );

  const { overall, perDoctor, perPeriod, granularity, perWeekday, reasons, rows } =
    report;
  const label = formatRange(range.start, range.end);
  const shownRows = rows.slice(0, ROW_LIMIT);

  function choosePreset(key) {
    setPreset(key);
    if (key !== "custom") {
      setRange({ start: presets[key].start, end: presets[key].end });
    }
  }

  // Editing a date makes it a custom range. Keep start <= end by moving the
  // other date along if the person crosses them over.
  function changeDate(field, value) {
    if (!value) return;
    setPreset("custom");
    setRange((r) => {
      const next = { ...r, [field]: value };
      if (next.start > next.end) {
        if (field === "start") next.end = value;
        else next.start = value;
      }
      return next;
    });
  }
  const scopeName =
    doctorId === "all"
      ? "All doctors"
      : source.doctors.find((d) => d.id === doctorId)?.name ||
        perDoctor.find((d) => d.id === doctorId)?.name ||
        "Doctor";

  // Doctors for the dropdown: everyone on file plus anyone who only appears
  // on appointments.
  const doctorOptions = useMemo(() => {
    const map = new Map(source.doctors.map((d) => [d.id, d.name || "Doctor"]));
    for (const d of perDoctor) if (!map.has(d.id)) map.set(d.id, d.name);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mock, doctors, perDoctor]);

  function handleCsv() {
    const slug = scopeName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadFile(
      `now-med-${demo ? "demo-" : ""}${range.start}_to_${range.end}-${slug}.csv`,
      rowsToCsv(rows),
      "text/csv;charset=utf-8",
    );
  }

  function handlePdf() {
    // Uses the browser's print dialog - choose "Save as PDF" as the printer.
    // The file name suggested by the browser comes from the page title.
    const previous = document.title;
    document.title = `Now Med analytics ${demo ? "DEMO " : ""}${range.start} to ${range.end} ${scopeName}`;
    const restore = () => {
      document.title = previous;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  }

  const loading = !demo && appointments === null && !error;
  const hasRealData = (appointments || []).length > 0;

  function toggleDemo() {
    setDemo((on) => !on);
    setDoctorId("all"); // doctor ids differ between real and demo data
  }

  return (
    <SecretaryLayout>
      <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto md:pr-24">
        {/* Controls (hidden when printing) */}
        <div className="no-print flex flex-wrap items-end justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-ink">
              Practice analytics
            </h1>
            <p className="text-sm text-slate">
              Summary of doctors, clients and delays for any date range
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={preset}
              onChange={(e) => choosePreset(e.target.value)}
              aria-label="Date range"
              className="rounded-xl bg-white shadow-sm px-3 py-2.5 text-base md:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-rose"
            >
              {Object.entries(presets).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Custom range</option>
            </select>

            <div className="flex items-center gap-2 rounded-xl bg-white shadow-sm px-3 py-1.5 text-sm text-slate">
              <label htmlFor="range-from" className="sr-only">
                From
              </label>
              <input
                id="range-from"
                type="date"
                value={range.start}
                min="2000-01-01"
                max="2100-12-31"
                onChange={(e) => changeDate("start", e.target.value)}
                className="py-1 text-ink bg-transparent focus:outline-none focus:ring-2 focus:ring-rose rounded"
              />
              <span aria-hidden="true">to</span>
              <label htmlFor="range-to" className="sr-only">
                To
              </label>
              <input
                id="range-to"
                type="date"
                value={range.end}
                min="2000-01-01"
                max="2100-12-31"
                onChange={(e) => changeDate("end", e.target.value)}
                className="py-1 text-ink bg-transparent focus:outline-none focus:ring-2 focus:ring-rose rounded"
              />
            </div>

            <button
              type="button"
              onClick={toggleDemo}
              aria-pressed={demo}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium border transition-colors ${
                demo
                  ? "bg-pastel-amber text-amber border-amber"
                  : "bg-white text-slate border-transparent shadow-sm hover:text-rose"
              }`}
            >
              <FlaskConical size={16} /> Demo data {demo ? "on" : "off"}
            </button>

            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              aria-label="Doctor"
              className="rounded-xl bg-white shadow-sm px-3 py-2.5 text-base md:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-rose"
            >
              <option value="all">All doctors</option>
              {doctorOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleCsv}
              disabled={!rows.length}
              className="inline-flex items-center gap-2 rounded-xl border border-rose text-rose px-3.5 py-2.5 text-sm font-medium hover:bg-mist disabled:opacity-40"
            >
              <Download size={16} /> CSV
            </button>
            <button
              type="button"
              onClick={handlePdf}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-rose text-white px-3.5 py-2.5 text-sm font-medium hover:bg-plum disabled:opacity-40"
            >
              <FileText size={16} /> Save as PDF
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-pastel-red text-red px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {demo && (
          <div className="mb-4 rounded-xl bg-pastel-amber text-amber px-4 py-3 text-sm">
            Showing generated demo data. Nothing is saved, and your real
            appointments are not affected. Switch demo data off to see the
            practice's real numbers.
          </div>
        )}
        {!demo && appointments !== null && !hasRealData && !error && (
          <div className="no-print mb-4 rounded-xl bg-pastel-blue text-blue px-4 py-3 text-sm">
            There are no appointments yet. Turn on <strong>Demo data</strong> to
            preview what this page looks like with a busy practice.
          </div>
        )}

        {loading ? (
          <Card>
            <p className="text-sm text-slate">Loading analytics…</p>
          </Card>
        ) : (
          <div id="analytics-report" className="space-y-6">
            {/* Report heading - shown on screen as context, and is the title
                block of the PDF. */}
            <div>
              <p className="text-xl font-semibold text-plum">
                {scopeName} · {label}
                {demo ? " · DEMO DATA" : ""}
              </p>
              <p className="text-xs text-slate">
                Now Med practice report · generated{" "}
                {new Date().toLocaleDateString("en-ZA", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <Stat
                icon={CalendarRange}
                tone="bg-blush text-rose"
                value={overall.booked}
                label="Appointments"
                sub={
                  overall.cancelled
                    ? `${overall.cancelled} cancelled not counted`
                    : undefined
                }
              />
              <Stat
                icon={Users}
                tone="bg-mist text-plum"
                value={overall.uniqueClients}
                label="Clients seen"
                sub={`${overall.newClients} new · ${overall.returningClients} returning`}
              />
              <Stat
                icon={Clock}
                tone="bg-pastel-amber text-amber"
                value={overall.delayedCount ? minutes(overall.avgDelay) : "None"}
                label="Average doctor delay"
                sub={
                  overall.delayedCount
                    ? `${percent(overall.delayRate)} of appointments delayed · longest ${minutes(overall.maxDelay)}`
                    : "No delays recorded"
                }
              />
              <Stat
                icon={XCircle}
                tone="bg-pastel-red text-red"
                value={percent(overall.cancellationRate)}
                label="Cancellation rate"
                sub={`${plural(overall.cancelled, "cancellation")}`}
              />
              <Stat
                icon={CheckCircle2}
                tone="bg-pastel-green text-green"
                value={percent(overall.confirmationRate)}
                label="Confirmed with patient"
                sub={`${overall.confirmed} of ${overall.booked}`}
              />
              <Stat
                icon={Star}
                tone="bg-pastel-amber text-amber"
                value={overall.reviewCount ? round1(overall.avgRating).toFixed(1) : "–"}
                label="Average review"
                sub={plural(overall.reviewCount, "review")}
              />
            </div>

            {/* Doctor performance summary */}
            <Section title="Doctor summary">
              {perDoctor.length === 0 ? (
                <p className="text-sm text-slate">
                  No appointments for {label}.
                </p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {perDoctor.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDoctorId(d.id === doctorId ? "all" : d.id)}
                      className={`print-avoid-break text-left rounded-xl border p-4 transition-colors ${
                        d.id === doctorId
                          ? "border-rose bg-mist"
                          : "border-sand hover:border-rose"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-ink">{d.name}</p>
                        <p className="text-xs text-slate shrink-0">
                          {d.reviewCount
                            ? `★ ${round1(d.avgRating).toFixed(1)} (${d.reviewCount})`
                            : "No reviews"}
                        </p>
                      </div>
                      <p className="text-sm text-slate mt-1">{describeDoctor(d)}</p>
                      <dl className="grid grid-cols-2 min-[420px]:grid-cols-4 gap-2 mt-3 text-center">
                        {[
                          [d.booked, "Appts"],
                          [d.uniqueClients, "Clients"],
                          [d.delayedCount ? minutes(d.avgDelay) : "–", "Avg delay"],
                          [percent(d.cancellationRate), "Cancelled"],
                        ].map(([v, l]) => (
                          <div key={l} className="rounded-lg bg-sand/60 py-2">
                            <dt className="text-[11px] text-slate">{l}</dt>
                            <dd className="text-sm font-semibold text-ink">{v}</dd>
                          </div>
                        ))}
                      </dl>
                      {d.patientLateCount > 0 && (
                        <p className="text-xs text-slate mt-2">
                          {plural(d.patientLateCount, "client")} arrived late (avg{" "}
                          {minutes(d.avgPatientLate)}).
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </Section>

            {/* Charts */}
            <Section title={`Appointments per ${granularity}`}>
              <PeriodStackChart data={perPeriod} unit={granularity} />
            </Section>

            <div className="grid lg:grid-cols-2 gap-6">
              <Section title="Why the doctor ran late">
                <HBarChart
                  empty="No delays recorded in this period."
                  items={reasons.map((r) => ({
                    label: r.label,
                    value: r.count,
                    valueLabel: `${plural(r.count, "time")}`,
                    sub: `${minutes(r.minutes)} lost in total`,
                  }))}
                />
                {overall.delayedCount > overall.reasonRecorded && (
                  <p className="text-xs text-slate mt-4">
                    {plural(overall.delayedCount - overall.reasonRecorded, "delay")}{" "}
                    had no reason recorded. Choose a reason when marking a delay
                    to improve this chart.
                  </p>
                )}
              </Section>

              <Section title="Average delay by doctor">
                <HBarChart
                  empty="No delays recorded in this period."
                  items={perDoctor
                    .filter((d) => d.delayedCount > 0)
                    .sort((a, b) => b.avgDelay - a.avgDelay)
                    .map((d) => ({
                      label: d.name,
                      value: d.avgDelay,
                      valueLabel: `${minutes(d.avgDelay)} avg`,
                      sub: `Late on ${d.delayedCount} of ${d.booked} (${percent(d.delayRate)})`,
                    }))}
                />
              </Section>

              <Section title="Average delay by weekday (minutes)">
                <ColumnChart
                  unit="minutes"
                  empty="No delays recorded in this period."
                  items={perWeekday.map((w) => ({
                    label: w.label,
                    value: w.avgDelay,
                    tooltip: w.delayed
                      ? `${minutes(w.avgDelay)} average, ${w.delayed} of ${w.appointments} delayed`
                      : "No delays",
                  }))}
                />
              </Section>

              <Section title={`Average delay per ${granularity} (minutes)`}>
                <LineChart
                  unit="minutes"
                  empty="No delays recorded in this period."
                  points={perPeriod.map((t) => ({
                    label: t.label,
                    value: t.avgDelay,
                    tooltip: t.delayed
                      ? `${t.title}: ${minutes(t.avgDelay)} average, ${percent(t.delayRate)} of ${plural(t.appointments, "appointment")} delayed`
                      : `${t.title}: no delays`,
                  }))}
                />
              </Section>
            </div>

            {/* Client visits */}
            <Section title={`Client visits (${rows.length})`}>
              {rows.length === 0 ? (
                <p className="text-sm text-slate">
                  No appointments for this selection.
                </p>
              ) : (
                <div className="overflow-x-auto max-h-[28rem] overflow-y-auto print:max-h-none print:overflow-visible">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-white print:static">
                      <tr className="border-b border-sand text-slate">
                        <th className="py-2 pr-4 font-medium">Date</th>
                        <th className="py-2 pr-4 font-medium">Time</th>
                        {doctorId === "all" && (
                          <th className="py-2 pr-4 font-medium">Doctor</th>
                        )}
                        <th className="py-2 pr-4 font-medium">Client</th>
                        <th className="py-2 pr-4 font-medium">Status</th>
                        <th className="py-2 pr-4 font-medium">Doctor delay</th>
                        <th className="py-2 pr-4 font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownRows.map((r) => (
                        <tr key={r.id} className="border-b border-sand last:border-0 print-avoid-break">
                          <td className="py-2 pr-4 text-ink whitespace-nowrap">{r.date}</td>
                          <td className="py-2 pr-4 text-slate">{r.time}</td>
                          {doctorId === "all" && (
                            <td className="py-2 pr-4 text-slate">{r.doctor}</td>
                          )}
                          <td className="py-2 pr-4 text-ink">{r.client}</td>
                          <td className="py-2 pr-4 text-slate capitalize">{r.status}</td>
                          <td className="py-2 pr-4 text-slate whitespace-nowrap">
                            {r.delayMinutes ? minutes(r.delayMinutes) : "–"}
                          </td>
                          <td className="py-2 pr-4 text-slate">{r.delayReason || "–"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {rows.length > ROW_LIMIT && (
                <p className="text-xs text-slate mt-3">
                  Showing the first {ROW_LIMIT} of {rows.length} visits. Use the
                  CSV export to get every row.
                </p>
              )}
            </Section>
          </div>
        )}
      </div>
    </SecretaryLayout>
  );
}
