"use client";

import dynamic from "next/dynamic";
import type { MapAnimal, MapPurok } from "../../LeafletMap";

const LeafletMap = dynamic(() => import("../../LeafletMap"), { ssr: false });

export default function AdminMapPanel({ animals, puroks }: { animals: MapAnimal[]; puroks: MapPurok[] }) {
  return <LeafletMap animals={animals} puroks={puroks} />;
}
