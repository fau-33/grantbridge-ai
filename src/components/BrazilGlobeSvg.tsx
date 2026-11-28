import React from "react";

interface BrazilGlobeSvgProps {
  activeGrantsCount: number | null;
}

export function BrazilGlobeSvg({ activeGrantsCount }: BrazilGlobeSvgProps) {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <svg
        viewBox="0 0 360 320"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full max-w-[350px] h-auto select-none"
        role="img"
        aria-label="Globo vetorial conectando fundos climáticos internacionais ao Brasil"
      >
        <defs>
          <radialGradient id="gbGlobeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#20BD80" stopOpacity="0.22" />
            <stop offset="62%" stopColor="#0B1611" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#050B08" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="gbArcPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E7BD71" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#57DCA0" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="gbArcSecondary" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#57DCA0" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#20BD80" stopOpacity="0.95" />
          </linearGradient>
          <clipPath id="gbSphereClip">
            <circle cx="180" cy="160" r="112" />
          </clipPath>
        </defs>

        {/* Ambient radial glow */}
        <circle cx="180" cy="160" r="142" fill="url(#gbGlobeGlow)" />

        {/* Outer orbital ring */}
        <circle
          cx="180"
          cy="160"
          r="128"
          stroke="#1A2F24"
          strokeWidth="1"
          strokeDasharray="3 5"
        />

        {/* Globe sphere base */}
        <circle
          cx="180"
          cy="160"
          r="112"
          fill="#0B1611"
          fillOpacity="0.85"
          stroke="#1A2F24"
          strokeWidth="1.5"
        />

        {/* Latitude & Longitude wireframe lines */}
        <g clipPath="url(#gbSphereClip)" stroke="#1A2F24" strokeWidth="1">
          {/* Equator & latitude parallels */}
          <ellipse cx="180" cy="160" rx="112" ry="22" stroke="#20BD80" strokeOpacity="0.26" />
          <ellipse cx="180" cy="122" rx="105" ry="18" />
          <ellipse cx="180" cy="88" rx="85" ry="13" />
          <ellipse cx="180" cy="198" rx="105" ry="18" />
          <ellipse cx="180" cy="232" rx="85" ry="13" />

          {/* Longitude meridians */}
          <line x1="180" y1="48" x2="180" y2="272" />
          <ellipse cx="180" cy="160" rx="34" ry="112" />
          <ellipse cx="180" cy="160" rx="68" ry="112" />
          <ellipse cx="180" cy="160" rx="95" ry="112" />

          {/* Stylized South America & Brazil highlight silhouette */}
          <path
            d="M142 150 L158 144 L173 151 L188 164 L196 179 L190 198 L178 214 L167 228 L158 242 L152 224 L147 204 L138 184 L135 166 Z"
            fill="#20BD80"
            fillOpacity="0.16"
            stroke="#20BD80"
            strokeOpacity="0.45"
            strokeWidth="1.1"
          />
          {/* Brazil core landmass highlight */}
          <path
            d="M148 156 L166 151 L182 162 L192 178 L184 196 L172 208 L159 204 L151 189 L145 172 Z"
            fill="#20BD80"
            fillOpacity="0.34"
            stroke="#57DCA0"
            strokeWidth="1.35"
            strokeLinejoin="round"
          />

          {/* Subtle North America & Europe silhouettes */}
          <path
            d="M114 96 L138 86 L154 98 L148 118 L134 128 L119 120 Z"
            fill="#1A2F24"
            fillOpacity="0.7"
          />
          <path
            d="M214 88 L244 82 L258 96 L248 114 L224 116 L212 104 Z"
            fill="#1A2F24"
            fillOpacity="0.7"
          />
        </g>

        {/* International funding arcs converging onto Brazil */}
        {/* US / Global Greengrants -> Brazil */}
        <path
          d="M134 106 Q132 146 168 180"
          stroke="url(#gbArcPrimary)"
          strokeWidth="1.75"
          strokeDasharray="4 3"
          fill="none"
        />
        {/* Europe / UK / Germany -> Brazil */}
        <path
          d="M236 98 Q220 144 168 180"
          stroke="url(#gbArcSecondary)"
          strokeWidth="1.75"
          strokeDasharray="4 3"
          fill="none"
        />
        {/* Global South / UN Hub -> Brazil */}
        <path
          d="M254 152 Q218 176 168 180"
          stroke="#57DCA0"
          strokeOpacity="0.7"
          strokeWidth="1.35"
          strokeDasharray="3 3"
          fill="none"
        />

        {/* Origin donor hub dots */}
        <g>
          <circle cx="134" cy="106" r="4" fill="#E7BD71" />
          <circle cx="134" cy="106" r="8" fill="#E7BD71" fillOpacity="0.2" />
          <text
            x="84"
            y="99"
            fill="#8EA396"
            fontSize="9"
            fontFamily="var(--font-jetbrains-mono), monospace"
          >
            US / UN
          </text>
        </g>

        <g>
          <circle cx="236" cy="98" r="4" fill="#E7BD71" />
          <circle cx="236" cy="98" r="8" fill="#E7BD71" fillOpacity="0.2" />
          <text
            x="246"
            y="94"
            fill="#8EA396"
            fontSize="9"
            fontFamily="var(--font-jetbrains-mono), monospace"
          >
            EU / UK
          </text>
        </g>

        <g>
          <circle cx="254" cy="152" r="3.5" fill="#57DCA0" />
          <circle cx="254" cy="152" r="7" fill="#57DCA0" fillOpacity="0.18" />
        </g>

        {/* Brazil target beacon */}
        <g>
          <circle
            cx="168"
            cy="180"
            r="10"
            fill="#57DCA0"
            fillOpacity="0.28"
            className="gb-beacon-ring"
          />
          <circle cx="168" cy="180" r="5.5" fill="#57DCA0" stroke="#050B08" strokeWidth="1.5" />
        </g>

        {/* Brazil callout pill */}
        <g transform="translate(178, 188)">
          <rect
            x="0"
            y="0"
            width="116"
            height="34"
            rx="8"
            fill="#050B08"
            fillOpacity="0.92"
            stroke="#20BD80"
            strokeOpacity="0.55"
            strokeWidth="1"
          />
          <circle cx="12" cy="17" r="3" fill="#57DCA0" />
          <text
            x="22"
            y="14"
            fill="#F3F7F4"
            fontSize="9.5"
            fontWeight="600"
            fontFamily="var(--font-space-grotesk), sans-serif"
          >
            BRASIL • HUB LOCAL
          </text>
          <text
            x="22"
            y="26"
            fill="#8EA396"
            fontSize="8.5"
            fontFamily="var(--font-jetbrains-mono), monospace"
          >
            {activeGrantsCount !== null
              ? `${activeGrantsCount} editais ativos`
              : "Conectando radar..."}
          </text>
        </g>
      </svg>
    </div>
  );
}
