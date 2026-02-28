/**
 * Country list for institution country dropdown.
 * Sorted by name for easier selection.
 */

import * as countryList from "country-list";

export type CountryOption = { code: string; name: string };

const data = (countryList as { getData: () => CountryOption[] }).getData();
export const COUNTRY_OPTIONS: CountryOption[] = [...data].sort((a, b) =>
  a.name.localeCompare(b.name)
);

export function getCountryName(code: string): string | undefined {
  return COUNTRY_OPTIONS.find((c) => c.code === code)?.name;
}

export function getCountryCode(name: string): string | undefined {
  return COUNTRY_OPTIONS.find(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  )?.code;
}
