declare module 'pdf-parse/lib/pdf-parse.js' {
  const parse: (data: Buffer) => Promise<{ numpages: number; text: string }>;
  export default parse;
}
