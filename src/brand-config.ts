export const brand = { name: "Nexus VA" };
export function companyName(value: string) {
  return value === "Nexus Virtual Executives" ? brand.name : value;
}
