export type AnimalStatus = "Vaccinated" | "Due soon" | "Overdue" | "Not scheduled";

// Fixed barangay purok list with map coordinates — shared by the main
// workspace map and the super admin map so both stay in sync.
export const purokOptions = [
  { id: 1, name: "The Palisades", latitude: 10.6685542, longitude: 122.9855123 },
  { id: 2, name: "Bagong Silang North", latitude: 10.6695881, longitude: 122.987599 },
  { id: 3, name: "Celine Homes East", latitude: 10.6705123, longitude: 122.9865456 },
  { id: 4, name: "Bagong Silang South", latitude: 10.6675999, longitude: 122.9880111 },
  { id: 5, name: "Zamora Street", latitude: 10.6710222, longitude: 122.9850333 },
  { id: 6, name: "Celine Homes West", latitude: 10.6690444, longitude: 122.9890555 },
];

export function getAnimalStatus(vaccinated: boolean, nextDueDate: string | null, today = new Date()): AnimalStatus {
  if (!nextDueDate) return vaccinated ? "Vaccinated" : "Not scheduled";

  const dueDate = new Date(`${nextDueDate}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) return vaccinated ? "Vaccinated" : "Not scheduled";

  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysUntilDue = Math.round((dueDate.getTime() - todayMidnight.getTime()) / 86400000);
  if (daysUntilDue < 0) return "Overdue";
  if (daysUntilDue <= 30) return "Due soon";
  return "Vaccinated";
}
