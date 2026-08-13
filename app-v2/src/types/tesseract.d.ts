declare module 'tesseract.js' {
  export function recognize(
    image: Buffer | string,
    lang?: string,
    options?: Record<string, string | number>,
  ): Promise<{ data: { text: string } }>;
}
