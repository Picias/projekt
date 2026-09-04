export function formatujTekst(tekst: string): string[] {
  const zEnterami = tekst
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ");

  return zEnterami
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
