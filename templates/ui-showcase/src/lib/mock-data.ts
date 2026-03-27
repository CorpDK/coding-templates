import { type DataPoint } from "@corpdk/ui-charts";

export interface Person {
  id: string;
  name: string;
  role: string;
  department: string;
  startDate: string;
}

export const PEOPLE: Person[] = [
  { id: "1", name: "Alice Chen", role: "Engineer", department: "Platform", startDate: "2022-03-15" },
  { id: "2", name: "Bob Martínez", role: "Designer", department: "Product", startDate: "2021-07-01" },
  { id: "3", name: "Carol White", role: "Manager", department: "Platform", startDate: "2020-01-20" },
  { id: "4", name: "David Kim", role: "Engineer", department: "Data", startDate: "2023-05-10" },
  { id: "5", name: "Eva Rossi", role: "Analyst", department: "Data", startDate: "2022-11-03" },
  { id: "6", name: "Frank Osei", role: "Engineer", department: "Security", startDate: "2021-09-14" },
  { id: "7", name: "Grace Patel", role: "Designer", department: "Product", startDate: "2023-02-28" },
  { id: "8", name: "Henry Müller", role: "Manager", department: "Security", startDate: "2019-06-05" },
];

export const LINE_CHART_DATA: DataPoint[] = Array.from({ length: 12 }, (_, i) => ({
  x: i + 1,
  y: Math.round(20 + Math.sin(i * 0.8) * 15 + i * 2.5),
  label: `Month ${i + 1}`,
}));

export const BAR_CHART_DATA: DataPoint[] = [
  { x: 1, y: 42, label: "Q1" },
  { x: 2, y: 67, label: "Q2" },
  { x: 3, y: 55, label: "Q3" },
  { x: 4, y: 81, label: "Q4" },
];
