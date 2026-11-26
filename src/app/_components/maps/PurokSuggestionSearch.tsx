"use client";

import { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";

type PurokSuggestionSearchProps = {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  className?: string;
};

export default function PurokSuggestionSearch({ value, options, onChange, placeholder, ariaLabel, className = "" }: PurokSuggestionSearchProps) {
  const id = useId().replace(/:/g, "");
  const listId = `purok-suggestions-${id}`;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedQuery = value.trim().toLocaleLowerCase();
  const suggestions = useMemo(
    () => normalizedQuery
      ? options.filter((purok) => purok.toLocaleLowerCase().includes(normalizedQuery)).slice(0, 6)
      : [],
    [normalizedQuery, options],
  );

  return (
    <div className={`search-box purok-suggestion-search ${className}`.trim()}>
      <Search size={16} aria-hidden="true" />
      <input
        type="search"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={open && suggestions.length > 0 ? listId : undefined}
        aria-activedescendant={open && suggestions.length > 0 ? `${listId}-${activeIndex}` : undefined}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setActiveIndex(0);
          setOpen(true);
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
            onChange(suggestions[activeIndex] ?? suggestions[0]);
            setOpen(false);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 100)}
      />
      {open && suggestions.length > 0 && (
        <ul className="purok-suggestion-list" id={listId} role="listbox" aria-label="Matching puroks">
          {suggestions.map((purok, index) => (
            <li key={purok} role="presentation">
              <button id={`${listId}-${index}`} type="button" role="option" aria-selected={index === activeIndex} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(purok); setOpen(false); }}>
                {purok}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
