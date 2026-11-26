import type { PoundStatus } from "./pound-actions";

export type Animal = {
  id: number | string;
  name: string;
  species: "Dog" | "Cat";
  classification?: "Pet" | "Stray";
  neutered?: boolean;
  breed?: string;
  age?: number;
  sex?: string;
  color?: string;
  owner: string;
  purok: string;
  vaccinated: boolean;
  status: "Vaccinated" | "Due soon" | "Expired" | "Unvaccinated";
  vaccineDate?: string | null;
  nextDueDate: string | null;
  nextDue: string;
  contact: string;
  impoundArea: string;
  vaccineType?: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string;
  imageReferences?: string[];
  imageUrls?: string[];
  imageLoadError?: string;
  poundStatus?: PoundStatus | null;
};

export type AnimalFilters = {
  breed: string;
  species: string;
  owner: string;
  location: string;
  classification: string;
};

export type ReportId = "animals" | "vaccinations" | "maps" | "pound";
export type ReportCell = string | number;

export interface ReportTableData {
  title: string;
  headers: string[];
  rows: ReportCell[][];
  emptyMessage: string;
}

export interface ReportData {
  id: ReportId;
  title: string;
  description: string;
  metrics: { label: string; value: string | number }[];
  tables: ReportTableData[];
}

export type ReportBreakdownRow = {
  label: string;
  count: number;
  vaccinated: number;
  rate: number;
};

export type SupabaseAnimalRecord = {
  id: number;
  name: string;
  species: Animal["species"];
  classification?: Animal["classification"];
  neutered?: boolean | null;
  breed?: string | null;
  age?: number | null;
  sex?: string | null;
  color?: string | null;
  owner_name: string;
  vaccinated: boolean;
  vaccine_date: string | null;
  next_due_date: string | null;
  contact_number: string | null;
  impound_area: string | null;
  vaccine_type?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  image_references?: string[] | null;
  pound_status?: PoundStatus | null;
  puroks: { name: string } | { name: string }[] | null;
};

export interface UserNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}
