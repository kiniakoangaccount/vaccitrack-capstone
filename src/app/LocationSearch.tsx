"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Search } from "lucide-react";

type LocationSearchProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  allLabel?: string;
  exactOnly?: boolean;
  required?: boolean;
  compact?: boolean;
  className?: string;
};

export default function LocationSearch({
  label,
  value,
  options,
  onChange,
  placeholder = "Search locations...",
  allLabel,
  exactOnly = false,
  required = false,
  compact = false,
  className = "",
}: LocationSearchProps) {
  const id = useId().replace(/:/g, "");
  const inputId = `location-search-${id}`;
  const optionsId = `location-options-${id}`;
  const [query, setQuery] = useState(value === "All" ? "" : value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchingLocations = useMemo(
    () => options.filter((location) => location.toLocaleLowerCase().includes(normalizedQuery)),
    [options, normalizedQuery],
  );
  const suggestions = useMemo(() => {
    const matches = matchingLocations.slice(0, 8).map((location) => ({ value: location, label: location }));
    if (allLabel && !normalizedQuery) matches.unshift({ value: "All", label: allLabel });
    return matches;
  }, [allLabel, matchingLocations, normalizedQuery]);

  useEffect(() => {
    setQuery(value === "All" ? "" : value);
  }, [value]);

  function choose(option: { value: string; label: string }) {
    setQuery(option.value === "All" ? "" : option.label);
    onChange(option.value);
    setOpen(false);
    setActiveIndex(0);
  }

  return (
    <div className={`location-search ${compact ? "location-search-compact" : ""} ${className}`.trim()}>
      <label className={compact ? "risk-filter-label" : "location-search-label"} htmlFor={inputId}>
        {label}
      </label>
      <div className={`location-search-control ${compact ? "leaflet-purok-search-control" : ""}`}>
        <Search size={15} aria-hidden="true" />
        <input
          id={inputId}
          type="search"
          required={required}
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={open && suggestions.length > 0 ? optionsId : undefined}
          aria-activedescendant={open && suggestions.length > 0 ? `${optionsId}-${activeIndex}` : undefined}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setActiveIndex(0);
            setOpen(true);
            if (!exactOnly) onChange(nextQuery || (allLabel ? "All" : ""));
          }}
          onKeyDown={(event) => {
            if (!open || suggestions.length === 0) {
              if (event.key === "Escape") setOpen(false);
              return;
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((current) => (current + 1) % suggestions.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
            } else if (event.key === "Enter") {
              event.preventDefault();
              choose(suggestions[activeIndex] ?? suggestions[0]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          onBlur={() => {
            window.setTimeout(() => {
              setOpen(false);
              if (exactOnly && query !== (value === "All" ? "" : value)) setQuery(value === "All" ? "" : value);
            }, 100);
          }}
        />
        {compact && <span className="risk-filter-count" aria-label={`${matchingLocations.length} puroks match`}>{matchingLocations.length}</span>}
        {open && suggestions.length > 0 && (
          <ul className="location-search-suggestions" id={optionsId} role="listbox" aria-label={`${label} suggestions`}>
            {suggestions.map((suggestion, index) => (
              <li key={suggestion.value} role="presentation">
                <button id={`${optionsId}-${index}`} type="button" role="option" aria-selected={index === activeIndex} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(suggestion)}>
                  {suggestion.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
