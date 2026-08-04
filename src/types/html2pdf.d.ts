// html2pdf.js no trae tipos. Declaración mínima para el import diferido en ./app/ui/pdf.ts.
declare module 'html2pdf.js' {
  const html2pdf: () => any;
  export default html2pdf;
}
