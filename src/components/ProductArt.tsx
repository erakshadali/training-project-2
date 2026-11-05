import type { ArtKind } from "@/data/products";

type Props = { kind: ArtKind; tint: string; className?: string };

const shade = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, #000)`;
const tintUp = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

/** Original, hand-drawn SVG product illustrations. No third-party images. */
export function ProductArt({ kind, tint, className }: Props) {
  const base = tint;
  const dark = shade(tint, 68);
  const light = tintUp(tint, 55);
  const floor = "rgba(19,35,31,0.12)";

  return (
    <svg
      viewBox="0 0 240 180"
      role="img"
      aria-label={kind}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="120" cy="158" rx="88" ry="9" fill={floor} />
      {kind === "bed" && (
        <g>
          <rect x="34" y="62" width="14" height="86" rx="4" fill={dark} />
          <rect x="192" y="82" width="14" height="66" rx="4" fill={dark} />
          <rect x="44" y="104" width="154" height="30" rx="6" fill={base} />
          <rect x="44" y="96" width="154" height="16" rx="8" fill={light} />
          <rect x="52" y="84" width="40" height="18" rx="8" fill="#fff" opacity="0.92" />
          <rect x="98" y="84" width="40" height="18" rx="8" fill="#fff" opacity="0.8" />
          <rect x="44" y="130" width="154" height="10" rx="3" fill={dark} />
          <rect x="52" y="140" width="8" height="12" fill={dark} />
          <rect x="182" y="140" width="8" height="12" fill={dark} />
        </g>
      )}
      {kind === "sofa" && (
        <g>
          <rect x="30" y="68" width="180" height="48" rx="16" fill={dark} />
          <rect x="22" y="92" width="34" height="42" rx="12" fill={base} />
          <rect x="184" y="92" width="34" height="42" rx="12" fill={base} />
          <rect x="52" y="92" width="136" height="36" rx="10" fill={base} />
          <rect x="58" y="80" width="56" height="26" rx="10" fill={light} />
          <rect x="126" y="80" width="56" height="26" rx="10" fill={light} />
          <rect x="44" y="132" width="9" height="20" rx="3" fill="#3a2a1e" />
          <rect x="187" y="132" width="9" height="20" rx="3" fill="#3a2a1e" />
        </g>
      )}
      {kind === "dining" && (
        <g>
          <ellipse cx="120" cy="92" rx="62" ry="16" fill={base} />
          <ellipse cx="120" cy="88" rx="62" ry="14" fill={light} />
          <rect x="113" y="98" width="14" height="48" fill={dark} />
          <ellipse cx="120" cy="148" rx="28" ry="6" fill={dark} />
          <g fill={dark}>
            <rect x="36" y="86" width="26" height="26" rx="8" />
            <rect x="178" y="86" width="26" height="26" rx="8" />
            <rect x="96" y="52" width="48" height="22" rx="8" />
          </g>
          <rect x="43" y="112" width="5" height="34" fill={dark} />
          <rect x="192" y="112" width="5" height="34" fill={dark} />
        </g>
      )}
      {kind === "desk" && (
        <g>
          <rect x="30" y="76" width="180" height="12" rx="4" fill={light} />
          <rect x="36" y="88" width="8" height="62" fill={dark} />
          <rect x="196" y="88" width="8" height="62" fill={dark} />
          <rect x="136" y="88" width="56" height="40" rx="4" fill={base} />
          <rect x="152" y="104" width="24" height="6" rx="3" fill={light} />
          <rect x="84" y="46" width="54" height="30" rx="4" fill="#1c2724" />
          <rect x="88" y="50" width="46" height="22" rx="2" fill="#6fb6a4" opacity="0.8" />
          <rect x="107" y="76" width="8" height="6" fill="#1c2724" />
        </g>
      )}
      {kind === "wardrobe" && (
        <g>
          <rect x="62" y="22" width="116" height="126" rx="6" fill={base} />
          <rect x="68" y="28" width="52" height="114" rx="3" fill={light} />
          <rect x="124" y="28" width="48" height="114" rx="3" fill={light} />
          <rect x="112" y="78" width="4" height="22" rx="2" fill={dark} />
          <rect x="128" y="78" width="4" height="22" rx="2" fill={dark} />
          <rect x="68" y="148" width="10" height="8" fill={dark} />
          <rect x="162" y="148" width="10" height="8" fill={dark} />
        </g>
      )}
      {kind === "chair" && (
        <g>
          <rect x="86" y="30" width="68" height="62" rx="16" fill={base} />
          <rect x="94" y="38" width="52" height="46" rx="10" fill={light} opacity="0.55" />
          <rect x="78" y="92" width="84" height="16" rx="8" fill={dark} />
          <rect x="116" y="108" width="8" height="30" fill={dark} />
          <path d="M120 138 L82 152 M120 138 L158 152 M120 138 L120 154" stroke={dark} strokeWidth="6" strokeLinecap="round" />
          <circle cx="82" cy="154" r="5" fill="#1c2724" />
          <circle cx="158" cy="154" r="5" fill="#1c2724" />
          <circle cx="120" cy="156" r="5" fill="#1c2724" />
        </g>
      )}
      {kind === "shelf" && (
        <g>
          <rect x="78" y="18" width="84" height="132" rx="4" fill={dark} />
          {[26, 52, 78, 104, 128].map((y, i) => (
            <g key={y}>
              <rect x="84" y={y} width="72" height="20" rx="2" fill={light} />
              {i % 2 === 0 ? (
                <g>
                  <rect x="90" y={y + 4} width="9" height="16" fill={base} />
                  <rect x="101" y={y + 7} width="9" height="13" fill="#e5603a" />
                  <rect x="112" y={y + 3} width="9" height="17" fill="#1f6b5b" />
                </g>
              ) : (
                <g>
                  <circle cx="108" cy={y + 12} r="6" fill="#1f6b5b" />
                  <rect x="130" y={y + 6} width="16" height="14" rx="3" fill={base} />
                </g>
              )}
            </g>
          ))}
        </g>
      )}
      {kind === "fridge" && (
        <g>
          <rect x="76" y="14" width="88" height="138" rx="8" fill={base} />
          <rect x="76" y="14" width="88" height="138" rx="8" fill="none" stroke={dark} strokeWidth="2" />
          <rect x="76" y="62" width="88" height="3" fill={dark} />
          <rect x="148" y="32" width="5" height="20" rx="2.5" fill={dark} />
          <rect x="148" y="80" width="5" height="34" rx="2.5" fill={dark} />
          <rect x="84" y="22" width="32" height="6" rx="3" fill="#fff" opacity="0.45" />
          <rect x="82" y="152" width="10" height="6" fill={dark} />
          <rect x="148" y="152" width="10" height="6" fill={dark} />
        </g>
      )}
      {kind === "washer" && (
        <g>
          <rect x="70" y="20" width="100" height="132" rx="10" fill={base} />
          <rect x="70" y="20" width="100" height="132" rx="10" fill="none" stroke={dark} strokeWidth="2" />
          <rect x="78" y="28" width="84" height="18" rx="4" fill={dark} />
          <circle cx="90" cy="37" r="4" fill={light} />
          <circle cx="104" cy="37" r="4" fill="#e5603a" />
          <rect x="128" y="33" width="26" height="8" rx="4" fill={light} />
          <circle cx="120" cy="98" r="34" fill={dark} />
          <circle cx="120" cy="98" r="27" fill="#6fb6c9" opacity="0.8" />
          <path d="M100 100 Q112 90 124 100 T146 98" stroke="#fff" strokeWidth="3" fill="none" opacity="0.7" />
        </g>
      )}
      {kind === "tv" && (
        <g>
          <rect x="34" y="34" width="172" height="100" rx="8" fill="#161f1d" />
          <rect x="40" y="40" width="160" height="88" rx="4" fill="#2a8f86" />
          <path d="M40 112 L96 70 L132 98 L158 78 L200 112 L200 128 L40 128 Z" fill="#0d3b33" opacity="0.75" />
          <circle cx="164" cy="60" r="10" fill="#f1b44c" />
          <rect x="108" y="134" width="24" height="10" fill="#161f1d" />
          <rect x="84" y="144" width="72" height="6" rx="3" fill="#161f1d" />
        </g>
      )}
      {kind === "ac" && (
        <g>
          <rect x="28" y="40" width="184" height="58" rx="14" fill="#fff" stroke={dark} strokeWidth="2" />
          <rect x="40" y="76" width="160" height="10" rx="5" fill={base} />
          <circle cx="180" cy="56" r="4" fill="#1f6b5b" />
          <rect x="44" y="52" width="40" height="5" rx="2.5" fill={base} />
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M${70 + i * 38} 110 q10 14 0 28`} stroke="#6fb6c9" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.75" />
          ))}
        </g>
      )}
      {kind === "microwave" && (
        <g>
          <rect x="30" y="46" width="180" height="96" rx="10" fill={base} />
          <rect x="40" y="56" width="110" height="76" rx="6" fill="#141d1b" />
          <rect x="46" y="62" width="98" height="64" rx="3" fill="#6fb6a4" opacity="0.28" />
          <circle cx="182" cy="68" r="11" fill={dark} />
          <circle cx="182" cy="68" r="4" fill={light} />
          <rect x="164" y="90" width="36" height="8" rx="4" fill={dark} />
          <rect x="164" y="106" width="36" height="8" rx="4" fill={dark} />
        </g>
      )}
      {kind === "purifier" && (
        <g>
          <rect x="82" y="22" width="76" height="126" rx="14" fill={base} />
          <rect x="92" y="34" width="56" height="34" rx="8" fill="#fff" opacity="0.85" />
          <circle cx="104" cy="51" r="5" fill="#1f6b5b" />
          <rect x="116" y="47" width="24" height="8" rx="4" fill={dark} opacity="0.55" />
          <path d="M120 84 q-14 18 0 28 q14 -10 0 -28 z" fill="#fff" opacity="0.9" />
          <rect x="108" y="126" width="24" height="12" rx="4" fill={dark} />
        </g>
      )}
    </svg>
  );
}
