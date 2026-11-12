import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugify(s: string | undefined): string {
  return (s ?? 'diagram').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'diagram';
}

export function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.removeAttribute('style');
  clone.querySelectorAll('[style]').forEach((el) => el.removeAttribute('style'));
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
}

export function exportSvg(svg: SVGSVGElement, name: string) {
  download(new Blob([serializeSvg(svg)], { type: 'image/svg+xml' }), `${name}.svg`);
}

export async function svgToPngBlob(svg: SVGSVGElement, scale = 2): Promise<Blob> {
  const w = Number(svg.getAttribute('width'));
  const h = Number(svg.getAttribute('height'));
  const url = URL.createObjectURL(new Blob([serializeSvg(svg)], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * scale);
    canvas.height = Math.ceil(h * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportPng(svg: SVGSVGElement, name: string) {
  download(await svgToPngBlob(svg), `${name}.png`);
}

export async function copyPng(svg: SVGSVGElement) {
  const blob = await svgToPngBlob(svg);
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

const HASH_KEY = 'code=';

export function shareUrl(code: string): string {
  const url = new URL(window.location.href);
  url.hash = HASH_KEY + compressToEncodedURIComponent(code);
  return url.toString();
}

export function codeFromHash(): string | undefined {
  const h = window.location.hash.slice(1);
  if (!h.startsWith(HASH_KEY)) return undefined;
  return decompressFromEncodedURIComponent(h.slice(HASH_KEY.length)) ?? undefined;
}
