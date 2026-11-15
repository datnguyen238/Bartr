import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Base({ title, children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      aria-label={title}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const ArrowLeft = (props: IconProps) => (
  <Base {...props}>
    <path d="M19 12H5" />
    <path d="m11 18-6-6 6-6" />
  </Base>
);

export const ArrowRight = (props: IconProps) => (
  <Base {...props}>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </Base>
);

export const ArrowUpRight = (props: IconProps) => (
  <Base {...props}>
    <path d="M7 17 17 7" />
    <path d="M8 7h9v9" />
  </Base>
);

export const Check = (props: IconProps) => (
  <Base {...props}>
    <path d="m5 12 4.5 4.5L19 7" />
  </Base>
);

export const ChevronDown = (props: IconProps) => (
  <Base {...props}>
    <path d="m6 9 6 6 6-6" />
  </Base>
);

export const Close = (props: IconProps) => (
  <Base {...props}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Base>
);

export const Compass = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
  </Base>
);

export const Handshake = (props: IconProps) => (
  <Base {...props}>
    <path d="m11 17 2 2a2.1 2.1 0 0 0 3-3" />
    <path d="m14 14 2.5 2.5a2.1 2.1 0 0 0 3-3l-3.9-3.9a2 2 0 0 0-2.8 0L11 11.5" />
    <path d="m7 10 2.5-2.5a2 2 0 0 1 2.8 0L15 10" />
    <path d="m2 9 3-3 4 4" />
    <path d="m22 9-3-3-4 4" />
  </Base>
);

export const Image = (props: IconProps) => (
  <Base {...props}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-4.5-4.5L6 21" />
  </Base>
);

export const Leaf = (props: IconProps) => (
  <Base {...props}>
    <path d="M11 20A7 7 0 0 1 4 13c0-6 7-9 16-9 0 9-3 16-9 16Z" />
    <path d="M4 21c2-6 6-9 11-11" />
  </Base>
);

export const Lock = (props: IconProps) => (
  <Base {...props}>
    <rect width="16" height="11" x="4" y="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Base>
);

export const Package = (props: IconProps) => (
  <Base {...props}>
    <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
    <path d="m4.5 7.5 7.5 4 7.5-4" />
    <path d="M12 21v-9.5" />
  </Base>
);

export const Plus = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Base>
);

export const Refresh = (props: IconProps) => (
  <Base {...props}>
    <path d="M20 11a8 8 0 1 0-2.3 6.3" />
    <path d="M20 4v7h-7" />
  </Base>
);

export const Scale = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 3v18" />
    <path d="M7 21h10" />
    <path d="m5 7 14-2" />
    <path d="M5 7 2 14h6L5 7Z" />
    <path d="m19 5-3 7h6l-3-7Z" />
  </Base>
);

export const Search = (props: IconProps) => (
  <Base {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Base>
);

export const Shield = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    <path d="m9 12 2 2 4-4" />
  </Base>
);

export const Sparkles = (props: IconProps) => (
  <Base {...props}>
    <path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z" />
    <path d="m19 14 .8 2.2 2.2.8-2.2.8L19 20l-.8-2.2-2.2-.8 2.2-.8L19 14Z" />
    <path d="m5 14 .6 1.4L7 16l-1.4.6L5 18l-.6-1.4L3 16l1.4-.6L5 14Z" />
  </Base>
);

export const Alert = (props: IconProps) => (
  <Base {...props}>
    <path d="M10.3 3.7 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </Base>
);

export const User = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Base>
);

export const Sliders = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 21v-7" />
    <path d="M4 10V3" />
    <path d="M12 21v-9" />
    <path d="M12 8V3" />
    <path d="M20 21v-5" />
    <path d="M20 12V3" />
    <path d="M1 14h6" />
    <path d="M9 8h6" />
    <path d="M17 16h6" />
  </Base>
);

export const Receipt = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z" />
    <path d="M8 7h8" />
    <path d="M8 11h8" />
    <path d="M8 15h5" />
  </Base>
);
