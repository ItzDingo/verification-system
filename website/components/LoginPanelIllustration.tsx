/**
 * Decorative illustration for the login marketing panel.
 * Uses currentColor so it adapts to light/dark panel backgrounds.
 */
export default function LoginPanelIllustration() {
  return (
    <svg
      viewBox="0 0 400 260"
      className="h-auto w-full max-w-[17.5rem] select-none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden
    >
      <rect
        x="24"
        y="32"
        width="352"
        height="196"
        rx="16"
        className="stroke-current"
        strokeWidth="1.25"
        strokeOpacity="0.35"
      />
      <path
        d="M48 64h120M48 88h88M48 112h104"
        className="stroke-current"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeOpacity="0.45"
      />
      <rect
        x="200"
        y="56"
        width="152"
        height="72"
        rx="10"
        className="stroke-current"
        strokeWidth="1.25"
        strokeOpacity="0.3"
      />
      <path
        d="M216 80h120M216 100h72M216 120h96"
        className="stroke-current"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeOpacity="0.35"
      />
      <circle cx="92" cy="168" r="28" className="stroke-current" strokeWidth="1.25" strokeOpacity="0.35" />
      <path
        d="M80 168c6-10 18-16 30-12s20 14 20 26"
        className="stroke-current"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeOpacity="0.45"
      />
      <rect
        x="152"
        y="148"
        width="200"
        height="64"
        rx="12"
        className="stroke-current"
        strokeWidth="1.25"
        strokeOpacity="0.28"
      />
      <path
        d="M172 172h160M172 192h104"
        className="stroke-current"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeOpacity="0.35"
      />
    </svg>
  );
}
