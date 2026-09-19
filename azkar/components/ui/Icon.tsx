import type { SVGProps } from 'react';

/**
 * Небольшой набор инлайновых иконок.
 * Иконочная библиотека ради десятка глифов — лишние килобайты в бандле.
 */

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.8V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.8" />
  </Base>
);

export const BeadsIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="4.5" r="2" />
    <circle cx="18" cy="7.5" r="2" />
    <circle cx="20" cy="14" r="2" />
    <circle cx="16" cy="19.5" r="2" />
    <circle cx="8" cy="19.5" r="2" />
    <circle cx="4" cy="14" r="2" />
    <circle cx="6" cy="7.5" r="2" />
  </Base>
);

export const HeartIcon = ({ filled, ...props }: IconProps & { filled?: boolean }) => (
  <Base fill={filled ? 'currentColor' : 'none'} {...props}>
    <path d="M12 20.3 4.6 13a4.7 4.7 0 0 1 0-6.7 4.7 4.7 0 0 1 6.7 0l.7.7.7-.7a4.7 4.7 0 0 1 6.7 0 4.7 4.7 0 0 1 0 6.7Z" />
  </Base>
);

export const SettingsIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  </Base>
);

export const SearchIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Base>
);

export const CheckIcon = (props: IconProps) => (
  <Base strokeWidth={2.6} {...props}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Base>
);

export const ArrowRightIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 12h15" />
    <path d="m13 6 6 6-6 6" />
  </Base>
);

export const ArrowLeftIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M20 12H5" />
    <path d="m11 6-6 6 6 6" />
  </Base>
);

export const ChevronDownIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="m6 9 6 6 6-6" />
  </Base>
);

export const CloseIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M6 6 18 18" />
    <path d="M18 6 6 18" />
  </Base>
);

export const PlayIcon = (props: IconProps) => (
  <Base fill="currentColor" stroke="none" {...props}>
    <path d="M8 5.2a1 1 0 0 1 1.5-.9l9 6.8a1 1 0 0 1 0 1.7l-9 6.8A1 1 0 0 1 8 18.8Z" />
  </Base>
);

export const PauseIcon = (props: IconProps) => (
  <Base fill="currentColor" stroke="none" {...props}>
    <rect x="6.5" y="5" width="4" height="14" rx="1.3" />
    <rect x="13.5" y="5" width="4" height="14" rx="1.3" />
  </Base>
);

export const SpeakerIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M11 5 6.5 8.7H3.5v6.6h3L11 19Z" />
    <path d="M15.2 9.2a4 4 0 0 1 0 5.6" />
    <path d="M17.9 6.5a7.8 7.8 0 0 1 0 11" />
  </Base>
);

export const ShareIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 3v12" />
    <path d="m8 7 4-4 4 4" />
    <path d="M6 12H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1" />
  </Base>
);

export const RefreshIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M20 11a8 8 0 1 0-.9 4.6" />
    <path d="M20 5v6h-6" />
  </Base>
);

export const ShieldIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 3 5 6v6c0 4.3 2.8 7.8 7 9 4.2-1.2 7-4.7 7-9V6Z" />
  </Base>
);

export const FlameIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 3s5 4.2 5 8.6a5 5 0 0 1-10 0C7 9.4 9 7.6 9 7.6s.5 1.8 1.7 2.4C10.5 7.8 12 3 12 3Z" />
  </Base>
);

export const InfoIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <path d="M12 8h.01" />
  </Base>
);

export const AlertIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 4.5 2.8 20h18.4Z" />
    <path d="M12 10v4" />
    <path d="M12 17h.01" />
  </Base>
);

export const BookIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5Z" />
    <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5Z" />
  </Base>
);
