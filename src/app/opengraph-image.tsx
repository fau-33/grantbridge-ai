import { ImageResponse } from "next/og";

export const alt =
  "GrantBridge AI — Conectando iniciativas ambientais do Brasil a fundos climáticos internacionais";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const STACK = ["Firecrawl v2", "Gemini 2.5 Flash", "Neon PostgreSQL", "Nvoip v3"];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "radial-gradient(circle at 85% 15%, rgba(32,189,128,0.28), transparent 45%), linear-gradient(135deg, #050B08 0%, #0B1611 60%, #050B08 100%)",
          color: "#F3F7F4",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 22,
              background: "#0B1611",
              border: "2px solid #1A2F24",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="60" height="60" viewBox="0 0 36 36" fill="none">
              <path
                d="M27.5 8.5C18.2 8.5 11.2 12.9 9.2 21.8C8.8 23.6 8.8 25.3 9.1 26.9C10.7 27.2 12.4 27.2 14.2 26.8C23.1 24.8 27.5 17.8 27.5 8.5Z"
                fill="rgba(32,189,128,0.18)"
                stroke="#57DCA0"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
              <path
                d="M27.5 8.5L17.6 18.4L14.2 26.8"
                stroke="#20BD80"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M8.5 27.5L22.5 13.5" stroke="#57DCA0" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>GrantBridge AI</div>
            <div style={{ fontSize: 24, color: "#57DCA0" }}>Hack Brasil 2026 · Meio ambiente & economia verde</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, letterSpacing: -2, maxWidth: 1000 }}>
            Financiamento climático global para iniciativas locais do Brasil
          </div>
          <div style={{ fontSize: 28, color: "#B5C7BD", maxWidth: 980 }}>
            Editais internacionais, Match Score com IA e Concept Note em inglês em minutos.
          </div>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          {STACK.map((item) => (
            <div
              key={item}
              style={{
                display: "flex",
                padding: "10px 22px",
                borderRadius: 999,
                border: "1px solid #1F3A2C",
                background: "rgba(32,189,128,0.10)",
                color: "#57DCA0",
                fontSize: 22,
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
