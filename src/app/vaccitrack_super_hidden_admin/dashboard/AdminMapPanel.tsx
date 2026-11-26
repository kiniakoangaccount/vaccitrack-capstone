"use client";

import dynamic from "next/dynamic";
import type { MapAnimal, MapPurok } from "@/app/_components/maps/LeafletMap";

const LeafletMap = dynamic(() => import("@/app/_components/maps/LeafletMap"), { ssr: false });

export default function AdminMapPanel({ animals, puroks }: { animals: MapAnimal[]; puroks: MapPurok[] }) {
  return <LeafletMap animals={animals} puroks={puroks} />;
}
