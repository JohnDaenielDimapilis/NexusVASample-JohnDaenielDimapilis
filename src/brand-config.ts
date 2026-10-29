export const brand = {
  name: "Nexus Virtual Executives",
  shortName: "Nexus",
  logo: "/brand/nexus-wordmark.jpg",
  instagram: "https://www.instagram.com/nexusvirtualexecutives/",
};

export function companyName(value: string) {
  return value === "Nexus VA" ? brand.name : value;
}
