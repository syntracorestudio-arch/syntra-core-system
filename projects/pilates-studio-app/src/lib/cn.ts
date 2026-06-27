/** Une clases truthy. Mínimo, sin twMerge (controlamos las clases en los primitivos). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
