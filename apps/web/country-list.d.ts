declare module "country-list" {
  export function getData(): { code: string; name: string }[];
  export function getNames(): Record<string, string>;
  export function getName(code: string): string | undefined;
  export function getCode(name: string): string | undefined;
}
