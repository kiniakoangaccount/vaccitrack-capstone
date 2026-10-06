export type VaccineSpecies = "Dog" | "Cat" | "Both";

export type VaccineEntry = { name: string; species: VaccineSpecies };

// Rabies vaccines apply to both species (this app exists to track rabies
// compliance), so they're tagged "Both" rather than Dog-only/Cat-only.
export const VACCINE_DATA: VaccineEntry[] = [
  { name: "Anti-Rabies Vaccine (Generic)", species: "Both" },
  { name: "Rabisin (Anti-Rabies)", species: "Both" },
  { name: "Nobivac Rabies", species: "Both" },
  { name: "Defensor 3 (Anti-Rabies)", species: "Both" },
  { name: "Imrab 3 (Anti-Rabies)", species: "Both" },

  { name: "Canine Distemper Vaccine", species: "Dog" },
  { name: "Canine Parvovirus Vaccine", species: "Dog" },
  { name: "Canine Adenovirus (Hepatitis) Vaccine", species: "Dog" },
  { name: "Canine Parainfluenza Vaccine", species: "Dog" },
  { name: "DHPPi (Distemper-Hepatitis-Parainfluenza-Parvovirus) 5-in-1", species: "Dog" },
  { name: "DHLPPi 6-in-1 (with Leptospirosis)", species: "Dog" },
  { name: "Nobivac DHPPi (Dog Core 5-in-1)", species: "Dog" },
  { name: "Vanguard Plus 5/L (Dog Core)", species: "Dog" },
  { name: "Canine Leptospirosis Vaccine", species: "Dog" },
  { name: "Bordetella bronchiseptica (Kennel Cough) Vaccine", species: "Dog" },
  { name: "Canine Coronavirus Vaccine", species: "Dog" },
  { name: "Canine Influenza Vaccine", species: "Dog" },

  { name: "Feline Viral Rhinotracheitis Vaccine", species: "Cat" },
  { name: "Feline Calicivirus Vaccine", species: "Cat" },
  { name: "Feline Panleukopenia Vaccine", species: "Cat" },
  { name: "FVRCP (Rhinotracheitis-Calicivirus-Panleukopenia) 3-in-1", species: "Cat" },
  { name: "Purevax RCP (Cat Core Booster)", species: "Cat" },
  { name: "Feline Leukemia Virus (FeLV) Vaccine", species: "Cat" },
  { name: "Feline Immunodeficiency Virus (FIV) Vaccine", species: "Cat" },
  { name: "Feline Chlamydophila Vaccine", species: "Cat" },
  { name: "Feline Infectious Peritonitis (FIP) Vaccine", species: "Cat" },
];
