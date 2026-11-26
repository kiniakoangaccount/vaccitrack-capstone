"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, ListFilter, Search, X } from "lucide-react";
import type { AnimalFilters } from "@/app/_features/workspace/workspace-types";

type FilterKey = keyof AnimalFilters;
type FilterOption = { value: string; label: string };

type Props = {
  filters: AnimalFilters;
  onChange: (filters: AnimalFilters) => void;
  breeds: string[];
  owners: [string, number][];
  locations: string[];
};

export default function AnimalFilterBuilder({ filters, onChange, breeds, owners, locations }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<FilterKey | null>(null);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const categories: { key: FilterKey; label: string; options: FilterOption[] }[] = [
    { key: "breed", label: "Breed", options: [{ value: "All", label: "All breeds" }, ...breeds.map((value) => ({ value, label: value }))] },
    { key: "species", label: "Species", options: [{ value: "All", label: "All species" }, { value: "Dog", label: "Dog" }, { value: "Cat", label: "Cat" }] },
    { key: "owner", label: "Owner", options: [{ value: "All", label: "All owners" }, ...owners.map(([value, count]) => ({ value, label: `${value} (${count} ${count === 1 ? "pet" : "pets"})` }))] },
    { key: "location", label: "Location / purok", options: [{ value: "All", label: "All locations" }, ...locations.map((value) => ({ value, label: value }))] },
    { key: "classification", label: "Classification", options: [{ value: "All", label: "Pets and strays" }, { value: "Pet", label: "Pets" }, { value: "Stray", label: "Strays" }] },
  ];

  const activeFilters = categories.flatMap((category) => {
    const selected = filters[category.key];
    if (selected === "All") return [];
    return [{ ...category, selected, selectedLabel: category.options.find((option) => option.value === selected)?.label ?? selected }];
  });

  const activeCategory = categories.find((category) => category.key === activeKey) ?? null;
  const visibleCategories = categories.filter((category) => category.label.toLowerCase().includes(search.trim().toLowerCase()));
  const visibleOptions = activeCategory?.options.filter((option) => option.label.toLowerCase().includes(search.trim().toLowerCase())) ?? [];

  useEffect(() => {
    if (!isOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setIsOpen(false);
        setActiveKey(null);
        setSearch("");
      }
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setActiveKey(null);
        setSearch("");
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [isOpen]);

  function clearMenu() {
    setIsOpen(false);
    setActiveKey(null);
    setSearch("");
  }

  function chooseFilter(key: FilterKey, value: string) {
    onChange({ ...filters, [key]: value });
    clearMenu();
  }

  return (
    <div className="animal-filter-builder" ref={rootRef}>
      <div className="animal-filter-toolbar">
        <button type="button" className={`animal-filter-add ${isOpen ? "is-open" : ""}`} aria-expanded={isOpen} onClick={() => { setIsOpen((open) => !open); setActiveKey(null); setSearch(""); }}>
          <ListFilter size={15} /> Add Filter
        </button>
        {activeFilters.map((filter) => <span className="animal-filter-chip" key={filter.key}>
          <span>{filter.label}</span><strong>{filter.selectedLabel}</strong>
          <button type="button" aria-label={`Remove ${filter.label} filter`} onClick={() => chooseFilter(filter.key, "All")}><X size={13} /></button>
        </span>)}
        {activeFilters.length > 0 && <button type="button" className="animal-filter-clear" onClick={() => onChange({ breed: "All", species: "All", owner: "All", location: "All", classification: "All" })}>Clear filters</button>}
      </div>

      {isOpen && <div className="animal-filter-menu" role="dialog" aria-label="Add animal filter">
        <label className="animal-filter-search"><Search size={15} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder={activeCategory ? `Filter ${activeCategory.label.toLowerCase()}...` : "Filter by..."} />{search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button>}</label>
        {activeCategory ? <>
          <button type="button" className="animal-filter-back" onClick={() => { setActiveKey(null); setSearch(""); }}><ChevronLeft size={15} /> All filters <span>{activeCategory.label}</span></button>
          <div className="animal-filter-options" role="listbox" aria-label={`${activeCategory.label} choices`}>
            {visibleOptions.map((option) => <button type="button" role="option" aria-selected={filters[activeCategory.key] === option.value} key={option.value} onClick={() => chooseFilter(activeCategory.key, option.value)}><span>{option.label}</span>{filters[activeCategory.key] === option.value && <Check size={15} />}</button>)}
            {visibleOptions.length === 0 && <p className="animal-filter-no-results">No matching options.</p>}
          </div>
        </> : <div className="animal-filter-options" role="listbox" aria-label="Filter fields">
          {visibleCategories.map((category) => <button type="button" role="option" aria-selected={filters[category.key] !== "All"} key={category.key} onClick={() => { setActiveKey(category.key); setSearch(""); }}><span>{category.label}{filters[category.key] !== "All" && <small> · {category.options.find((option) => option.value === filters[category.key])?.label}</small>}</span><ChevronRight size={16} /></button>)}
          {visibleCategories.length === 0 && <p className="animal-filter-no-results">No matching filters.</p>}
        </div>}
      </div>}
    </div>
  );
}
