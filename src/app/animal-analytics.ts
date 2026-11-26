import { DOG_BREEDS, CAT_BREEDS } from "@/lib/breed-data";
import { VACCINE_DATA } from "@/lib/vaccine-data";
import type { Animal, AnimalFilters } from "./workspace-types";

export function matchesAnimalFilters(animal: Animal, filters: AnimalFilters): boolean {
  const breed = animal.breed?.trim() || "Unspecified";
  const owner = animal.owner.trim() || "Unspecified owner";
  const location = animal.purok?.trim() || "Unassigned";
  const classification = animal.classification ?? "Pet";
  return (filters.breed === "All" || breed === filters.breed)
    && (filters.species === "All" || animal.species === filters.species)
    && (filters.owner === "All" || owner === filters.owner)
    && (filters.location === "All" || location.toLocaleLowerCase().includes(filters.location.toLocaleLowerCase()))
    && (filters.classification === "All" || classification === filters.classification);
}

export function firstVaccineFor(species: string): string {
  return VACCINE_DATA.find((vaccine) => vaccine.species === "Both" || vaccine.species === species)?.name ?? "";
}

export const statusStyles: Record<Animal["status"], string> = {
  Vaccinated: "status-good",
  "Due soon": "status-warn",
  Expired: "status-overdue",
  Unvaccinated: "status-neutral",
};

export function formatDueDate(nextDueDate: string | null) {
  if (!nextDueDate) return "Not scheduled";
  return new Date(`${nextDueDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

export function formatVaccineDate(vaccineDate?: string | null) {
  if (!vaccineDate) return "Not vaccinated";
  return new Date(`${vaccineDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

export function hasVaccinationHistory(animal: Pick<Animal, "vaccinated" | "vaccineDate">): boolean {
  return animal.vaccinated || Boolean(animal.vaccineDate);
}

export function isCurrentVaccinated(animal: Pick<Animal, "vaccinated" | "vaccineDate" | "status">): boolean {
  return hasVaccinationHistory(animal) && (animal.status === "Vaccinated" || animal.status === "Due soon");
}

export function isExpiredVaccination(animal: Pick<Animal, "vaccinated" | "vaccineDate" | "status">): boolean {
  return hasVaccinationHistory(animal) && animal.status === "Expired";
}

export const AGE_GROUP_ORDER = ["Under 1 year", "1–3 years", "3–7 years", "7+ years", "Unknown"];

export const BREED_OPTIONS = [...DOG_BREEDS.map((name) => ({ name, species: "Dog" })), ...CAT_BREEDS.map((name) => ({ name, species: "Cat" }))]
  .map((breed, index) => ({ id: index + 1, name: breed.name, species: breed.species }));

export function ageGroupLabel(ageMonths?: number): string {
  if (ageMonths === undefined || ageMonths === null) return "Unknown";
  if (ageMonths < 12) return "Under 1 year";
  if (ageMonths < 36) return "1–3 years";
  if (ageMonths < 84) return "3–7 years";
  return "7+ years";
}

export function summarizeReportDimension(animals: Animal[], keyFn: (animal: Animal) => string) {
  return buildCoverageBreakdown(animals, keyFn)
    .map((row) => ({ label: row.label, count: row.total, vaccinated: row.vaccinated, rate: row.rate }));
}

export function buildCoverageBreakdown(animals: Animal[], keyFn: (animal: Animal) => string, order?: string[]) {
  const totals = new Map<string, { total: number; vaccinated: number }>();
  for (const animal of animals) {
    const key = keyFn(animal);
    const entry = totals.get(key) ?? { total: 0, vaccinated: 0 };
    entry.total += 1;
    if (isCurrentVaccinated(animal)) entry.vaccinated += 1;
    totals.set(key, entry);
  }
  const keys = order ? order.filter((key) => totals.has(key)) : Array.from(totals.keys()).sort();
  return keys.map((key) => {
    const { total, vaccinated } = totals.get(key)!;
    return { label: key, total, vaccinated, rate: total ? Math.round((vaccinated / total) * 100) : 0 };
  });
}

export function buildPurokRiskRows(animals: Animal[], purokNames: string[]) {
  return purokNames.map((purokName) => {
    const records = animals.filter((animal) => animal.purok === purokName);
    const unvaccinated = records.filter((animal) => !hasVaccinationHistory(animal)).length;
    const vaccinated = records.filter(isCurrentVaccinated).length;
    const dueSoon = records.filter((animal) => animal.status === "Due soon").length;
    const overdue = records.filter(isExpiredVaccination).length;
    const atRisk = unvaccinated + overdue;
    const notScheduled = records.filter((animal) => !animal.nextDueDate).length;
    const unvaccinatedRate = records.length ? Math.round((unvaccinated / records.length) * 100) : 0;
    const atRiskRate = records.length ? Math.round((atRisk / records.length) * 100) : 0;
    const coverageRate = records.length ? Math.round((vaccinated / records.length) * 100) : 0;
    const gapToTarget = Math.max(0, Math.ceil(records.length * 0.7) - vaccinated);
    const risk = records.length === 0 ? "NO DATA" : atRisk * 2 > records.length ? "HIGH" : atRisk * 10 > records.length * 3 ? "MODERATE" : "LOW";
    return { purok: purokName, total: records.length, vaccinated, unvaccinated, overdue, atRisk, dueSoon, notScheduled, gapToTarget, coverageRate, unvaccinatedRate, atRiskRate, risk };
  });
}
