// Minimal inline icons so the Trading page doesn't need an icon dependency yet.
import type { SVGProps } from 'react';

function Icon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props} />;
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return <Icon {...props}><path d="M20 6 9 17l-5-5" /></Icon>;
}

export function SwapIcon(props: SVGProps<SVGSVGElement>) {
  return <Icon {...props}><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></Icon>;
}

export function ArrowLeftIcon(props: SVGProps<SVGSVGElement>) {
  return <Icon {...props}><path d="M19 12H5M12 19l-7-7 7-7" /></Icon>;
}
