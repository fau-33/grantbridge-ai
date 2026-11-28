import React from "react";

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className = "w-10 h-10" }: BrandMarkProps) {
  return (
    <div
      className={`${className} rounded-xl bg-[#0B1611] border border-[#1A2F24] flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_rgba(87,220,160,0.18)]`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-6 h-6"
      >
        {/* Geometric diamond leaf outline */}
        <path
          d="M27.5 8.5C18.2 8.5 11.2 12.9 9.2 21.8C8.8 23.6 8.8 25.3 9.1 26.9C10.7 27.2 12.4 27.2 14.2 26.8C23.1 24.8 27.5 17.8 27.5 8.5Z"
          fill="#20BD80"
          fillOpacity="0.18"
          stroke="#57DCA0"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        {/* Inner geometric facet */}
        <path
          d="M27.5 8.5L17.6 18.4L14.2 26.8"
          stroke="#20BD80"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Stem & central vein */}
        <path
          d="M8.5 27.5L22.5 13.5"
          stroke="#57DCA0"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path
          d="M15.5 20.5L13.5 15.5"
          stroke="#20BD80"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M19.5 16.5L23.5 17.5"
          stroke="#20BD80"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
