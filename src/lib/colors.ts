// Map of color name -> CSS filter to tint a base product image.
// "auto-generated variants" use CSS filters so a single uploaded image
// produces convincing color swatches without server-side image processing.
export const COLOR_PRESETS: { name: string; hex: string; filter: string }[] = [
  { name: "White",   hex: "#ffffff", filter: "none" },
  { name: "Black",   hex: "#111111", filter: "brightness(0.55) saturate(0.6)" },
  { name: "Red",     hex: "#e11d48", filter: "hue-rotate(-30deg) saturate(1.8)" },
  { name: "Pink",    hex: "#ec4899", filter: "hue-rotate(310deg) saturate(1.6)" },
  { name: "Blue",    hex: "#2563eb", filter: "hue-rotate(190deg) saturate(1.6)" },
  { name: "Green",   hex: "#16a34a", filter: "hue-rotate(90deg) saturate(1.5)" },
  { name: "Yellow",  hex: "#eab308", filter: "hue-rotate(40deg) saturate(1.6)" },
  { name: "Orange",  hex: "#f97316", filter: "hue-rotate(20deg) saturate(1.6)" },
  { name: "Purple",  hex: "#7c3aed", filter: "hue-rotate(250deg) saturate(1.5)" },
  { name: "Brown",   hex: "#7c4a2d", filter: "sepia(0.6) saturate(1.4) hue-rotate(-20deg) brightness(0.85)" },
  { name: "Beige",   hex: "#e7d5b5", filter: "sepia(0.4) saturate(0.9) brightness(1.05)" },
  { name: "Grey",    hex: "#6b7280", filter: "grayscale(1) brightness(0.9)" },
];

export function filterFor(name: string): string {
  return COLOR_PRESETS.find((c) => c.name.toLowerCase() === name.toLowerCase())?.filter ?? "none";
}
export function hexFor(name: string): string {
  return COLOR_PRESETS.find((c) => c.name.toLowerCase() === name.toLowerCase())?.hex ?? "#cccccc";
}

export const SIZE_PRESETS = ["XS", "S", "M", "L", "XL", "XXL", "Free"];
