declare module 'pdf-parse' {
    interface PdfParseResult {
        text: string;
        numpages: number;
        numrender: number;
        info?: Record<string, string | number | boolean | null>;
        metadata?: Record<string, string | number | boolean | null>;
        version?: string;
    }

    type PdfParseFunction = (dataBuffer: Buffer) => Promise<PdfParseResult>;

    const pdfParse: PdfParseFunction;
    export default pdfParse;
}
