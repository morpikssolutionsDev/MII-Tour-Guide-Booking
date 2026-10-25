"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { t } from "@/i18n/id";
import { COUNTRY_CODES } from "@/lib/countries";
import { countryNameId } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Searchable country select with Indonesian names (05 §3.2 "Kewarganegaraan"). */
export function CountrySelect({ id, value, onChange, invalid }: { id: string; value: string; onChange: (code: string) => void; invalid?: boolean }) {
  const [open, setOpen] = useState(false);
  const options = useMemo(
    () => COUNTRY_CODES.map((code) => ({ code, name: countryNameId(code) })).sort((a, b) => a.name.localeCompare(b.name, "id")),
    [],
  );
  const selected = options.find((o) => o.code === value);
  const cw = t.booking.wizard.customer;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="secondary" role="combobox" aria-expanded={open} aria-invalid={invalid || undefined} className="w-full justify-between font-normal">
          {selected ? (
            <span className="flex items-center gap-2">
              <span className="rounded-sm bg-kabut-100 px-1.5 text-xs font-semibold text-kabut-700">{selected.code}</span>
              {selected.name}
            </span>
          ) : (
            <span className="text-muted-foreground">{cw.nationalityPlaceholder}</span>
          )}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder={cw.searchCountry} />
          <CommandList>
            <CommandEmpty>{cw.noCountry}</CommandEmpty>
            {options.map((o) => (
              <CommandItem
                key={o.code}
                value={`${o.name} ${o.code}`}
                onSelect={() => {
                  onChange(o.code);
                  setOpen(false);
                }}
              >
                <span className="w-7 text-xs font-semibold text-muted-foreground">{o.code}</span>
                {o.name}
                <Check className={cn("ml-auto", value === o.code ? "opacity-100" : "opacity-0")} />
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
