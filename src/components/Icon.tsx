import type { CSSProperties, ReactNode, SVGProps } from "react";

export type IconName =
    | "arrowLeft"
    | "bookOpen"
    | "brain"
    | "check"
    | "chefHat"
    | "clipboard"
    | "clock"
    | "messageCircle"
    | "plus"
    | "send"
    | "settings"
    | "sparkles"
    | "thumbsDown"
    | "thumbsUp"
    | "trash"
    | "x";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
    name: IconName;
    size?: number;
    strokeWidth?: number;
    style?: CSSProperties;
}

/**
 * Lightweight inline SVG icon set for Chefness UI controls.
 *
 * We keep these in-repo instead of adding an icon package so the PWA remains
 * small and every icon inherits the surrounding button/text color via
 * `currentColor`.
 */
export function Icon({
    name,
    size = 18,
    strokeWidth = 2,
    style,
    ...props
}: IconProps) {
    return (
        <svg
            aria-hidden="true"
            fill="none"
            height={size}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            style={{ display: "inline-block", flexShrink: 0, ...style }}
            viewBox="0 0 24 24"
            width={size}
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            {paths[name]}
        </svg>
    );
}

const paths: Record<IconName, ReactNode> = {
    arrowLeft: (
        <>
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
        </>
    ),
    bookOpen: (
        <>
            <path d="M12 7v14" />
            <path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H12v18H5.5A2.5 2.5 0 0 1 3 18.5z" />
            <path d="M21 5.5A2.5 2.5 0 0 0 18.5 3H12v18h6.5a2.5 2.5 0 0 0 2.5-2.5z" />
        </>
    ),
    brain: (
        <>
            <path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 5" />
            <path d="M15 3a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 5" />
            <path d="M9 3v18" />
            <path d="M15 3v18" />
            <path d="M9 8H7" />
            <path d="M15 8h2" />
            <path d="M9 14H6" />
            <path d="M15 14h3" />
        </>
    ),
    check: <path d="M20 6 9 17l-5-5" />,
    chefHat: (
        <>
            <path d="M7 21h10" />
            <path d="M7 16.5V21" />
            <path d="M17 16.5V21" />
            <path d="M7 16.5h10" />
            <path d="M6.4 16.5A5 5 0 0 1 7 6.6a5 5 0 0 1 10 0 5 5 0 0 1 .6 9.9" />
            <path d="M9 10.5v3" />
            <path d="M12 10.5v3" />
            <path d="M15 10.5v3" />
        </>
    ),
    clipboard: (
        <>
            <rect height="4" rx="1" width="8" x="8" y="2" />
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        </>
    ),
    clock: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
        </>
    ),
    messageCircle: (
        <>
            <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5A8.5 8.5 0 0 1 21 11z" />
        </>
    ),
    plus: (
        <>
            <path d="M12 5v14" />
            <path d="M5 12h14" />
        </>
    ),
    send: (
        <>
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
        </>
    ),
    settings: (
        <>
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.5a2 2 0 0 1-1 1.73l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.73v-.5a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
            <circle cx="12" cy="12" r="3" />
        </>
    ),
    sparkles: (
        <>
            <path d="m12 3-1.6 4.4L6 9l4.4 1.6L12 15l1.6-4.4L18 9l-4.4-1.6Z" />
            <path d="m19 14-.8 2.2L16 17l2.2.8L19 20l.8-2.2L22 17l-2.2-.8Z" />
            <path d="m5 4-.7 1.7L3 6.5l1.3.8L5 9l.7-1.7L7 6.5l-1.3-.8Z" />
        </>
    ),
    thumbsDown: (
        <>
            <path d="M17 14V4" />
            <path d="M19 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-3" />
            <path d="M7 10v10a2 2 0 0 0 2 2l4-8h4V4H8.3a2 2 0 0 0-2 1.7L5 10Z" />
        </>
    ),
    thumbsUp: (
        <>
            <path d="M7 10v10" />
            <path d="M5 20H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h3" />
            <path d="M17 14V4a2 2 0 0 0-2-2l-4 8H7v10h8.7a2 2 0 0 0 2-1.7L19 14Z" />
        </>
    ),
    trash: (
        <>
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
        </>
    ),
    x: (
        <>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </>
    ),
};