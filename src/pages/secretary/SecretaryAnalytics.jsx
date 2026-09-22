import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Star,
  AlertTriangle,
  Users,
  CalendarRange,
} from "lucide-react";
import SecretaryLayout from "./SecretaryLayout";
import Card from "../../components/Card";
import {
  subscribeToAnalyticsSummaries,
  backfillDoctorAnalyticsFromAppointmentsAndReviews,
} from "../../firebase/firestore";

const currentMonthKey = new Date().toISOString().slice(0, 7);

export default function SecretaryAnalytics() {
  const [summaries, setSummaries] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        await backfillDoctorAnalyticsFromAppointmentsAndReviews();
      } catch (err) {
        console.error("Could not backfill analytics summaries:", err);
      }

      if (!cancelled) {
        const unsub = subscribeToAnalyticsSummaries(
          {
            entityType: "doctor",
            periodType: "month",
            periodKey: currentMonthKey,
          },
          setSummaries,
          (err) => console.error("Could not load analytics:", err),
        );

        return unsub;
      }

      return null;
    }

    const unsubPromise = hydrate();

    return () => {
      cancelled = true;
      if (unsubPromise && typeof unsubPromise.then === "function") {
        unsubPromise.then((unsub) => unsub && unsub());
      }
    };
  }, []);

  const totals = useMemo(() => {
    const totalReviews = summaries.reduce(
      (sum, item) => sum + Number(item.reviewCount || 0),
      0,
    );
    const weightedRating = summaries.reduce(
      (sum, item) =>
        sum + Number(item.avgReviewRating || 0) * Number(item.reviewCount || 0),
      0,
    );
    const totalLateFees = summaries.reduce(
      (sum, item) => sum + Number(item.lateFeesCharged || 0),
      0,
    );
    const totalLateArrivals = summaries.reduce(
      (sum, item) => sum + Number(item.lateArrivalCount || 0),
      0,
    );
    const totalAppointments = summaries.reduce(
      (sum, item) => sum + Number(item.totalAppointments || 0),
      0,
    );

    const avgRating = totalReviews > 0 ? weightedRating / totalReviews : 0;

    return {
      totalReviews,
      avgRating,
      totalLateFees,
      totalLateArrivals,
      totalAppointments,
    };
  }, [summaries]);

  return (
    <SecretaryLayout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto md:pr-24">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-ink">
              Practice analytics
            </h1>
            <p className="text-sm text-slate">
              Monthly overview for review quality, volume, lateness and
              operational load
            </p>
          </div>
          <div className="shrink-0 rounded-full bg-plum/10 px-3 py-1.5 text-xs font-medium text-plum">
            {currentMonthKey}
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card>
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-blush text-rose">
                <CalendarRange size={18} />
              </span>
              <div>
                <p className="text-2xl font-semibold text-ink">
                  {totals.totalAppointments}
                </p>
                <p className="text-xs text-slate">Appointments</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-pastel-amber text-amber">
                <Star size={18} fill="currentColor" />
              </span>
              <div>
                <p className="text-2xl font-semibold text-ink">
                  {totals.totalReviews ? totals.avgRating.toFixed(1) : "0.0"}
                </p>
                <p className="text-xs text-slate">Avg review</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-pastel-red text-red">
                <AlertTriangle size={18} />
              </span>
              <div>
                <p className="text-2xl font-semibold text-ink">
                  {totals.totalLateArrivals}
                </p>
                <p className="text-xs text-slate">Late arrivals</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-mist text-plum">
                <Users size={18} />
              </span>
              <div>
                <p className="text-2xl font-semibold text-ink">
                  R {totals.totalLateFees}
                </p>
                <p className="text-xs text-slate">Late fees</p>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-rose" />
            <h2 className="font-semibold text-ink">Doctor overview</h2>
          </div>

          {summaries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-sand bg-mist px-4 py-8 text-center text-sm text-slate">
              No analytics data has been captured yet for this month. Once
              reviews, late-arrival events, or appointment metrics are logged,
              they will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-sand text-slate">
                    <th className="py-2 pr-4 font-medium">Doctor</th>
                    <th className="py-2 pr-4 font-medium">Appointments</th>
                    <th className="py-2 pr-4 font-medium">Reviews</th>
                    <th className="py-2 pr-4 font-medium">Avg rating</th>
                    <th className="py-2 pr-4 font-medium">Late arrivals</th>
                    <th className="py-2 pr-4 font-medium">Late fees</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-sand last:border-0"
                    >
                      <td className="py-3 pr-4 text-ink">
                        {item.doctorName || item.entityId || "Doctor"}
                      </td>
                      <td className="py-3 pr-4 text-slate">
                        {item.totalAppointments || 0}
                      </td>
                      <td className="py-3 pr-4 text-slate">
                        {item.reviewCount || 0}
                      </td>
                      <td className="py-3 pr-4 text-slate">
                        {item.reviewCount
                          ? Number(item.avgReviewRating || 0).toFixed(1)
                          : "0.0"}
                      </td>
                      <td className="py-3 pr-4 text-slate">
                        {item.lateArrivalCount || 0}
                      </td>
                      <td className="py-3 pr-4 text-slate">
                        R {item.lateFeesCharged || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </SecretaryLayout>
  );
}
