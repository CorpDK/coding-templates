'use client';

import { LineChart, BarChart } from "@corpdk/ui-charts";
import { LINE_CHART_DATA, BAR_CHART_DATA } from "@/lib/mock-data";

export default function ChartsPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 space-y-10">
      <h1 className="text-2xl font-bold">Charts</h1>

      <section className="space-y-2">
        <h2 className="font-semibold text-lg">LineChart</h2>
        <div className="overflow-x-auto">
          <LineChart data={LINE_CHART_DATA} width={600} height={300} color="#3b82f6" />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-lg">BarChart — vertical</h2>
        <div className="overflow-x-auto">
          <BarChart data={BAR_CHART_DATA} width={400} height={260} color="#10b981" />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-lg">BarChart — horizontal</h2>
        <div className="overflow-x-auto">
          <BarChart
            data={BAR_CHART_DATA}
            width={400}
            height={260}
            color="#8b5cf6"
            direction="horizontal"
          />
        </div>
      </section>
    </main>
  );
}
