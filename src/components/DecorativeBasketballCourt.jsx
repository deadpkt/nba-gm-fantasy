function DecorativeBasketballCourt({ className = "" }) {
  return (
    <svg className={`decorative-court decorative-court--half ${className}`} viewBox="0 0 560 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="home-court-boards" width="34" height="500" patternUnits="userSpaceOnUse">
          <rect width="34" height="500" className="decorative-court__board" />
          <path d="M34 0v500" className="decorative-court__board-seam" />
        </pattern>
        <radialGradient id="home-court-light" cx="84%" cy="48%" r="72%">
          <stop offset="0" stopColor="#7f9cba" stopOpacity=".12" />
          <stop offset=".58" stopColor="#15304a" stopOpacity=".03" />
          <stop offset="1" stopColor="#020914" stopOpacity=".38" />
        </radialGradient>
        <linearGradient id="home-court-fade" x1="0" x2="1">
          <stop offset="0" stopColor="white" stopOpacity="0" />
          <stop offset=".3" stopColor="white" stopOpacity=".3" />
          <stop offset=".58" stopColor="white" stopOpacity="1" />
        </linearGradient>
        <mask id="home-court-mask"><rect width="560" height="500" fill="url(#home-court-fade)" /></mask>
      </defs>
      <g mask="url(#home-court-mask)">
        <rect x="20" y="18" width="520" height="464" rx="5" fill="url(#home-court-boards)" />
        <rect x="20" y="18" width="520" height="464" rx="5" fill="url(#home-court-light)" />
        <path className="decorative-court__ambient" d="M470 18h70v464h-70z" />
        <g fill="none">
          <path className="decorative-court__line" d="M20 18H540V482H20M20 18V482" />
          <path className="decorative-court__detail" d="M20 78a172 172 0 0 1 0 344" />
          <path className="decorative-court__paint" d="M540 166H360V334H540" />
          <path className="decorative-court__line" d="M360 166V334" />
          <circle className="decorative-court__line" cx="360" cy="250" r="60" />
          <path className="decorative-court__detail" strokeDasharray="8 9" d="M360 190a60 60 0 0 0 0 120" />
          <path className="decorative-court__line" d="M540 70h-62a230 230 0 0 0 0 360h62" />
          <path className="decorative-court__backboard" d="M502 212v76" />
          <circle className="decorative-court__rim" cx="480" cy="250" r="10" />
          <path className="decorative-court__detail" d="M480 222a29 29 0 0 0 0 56" />
          <circle className="decorative-court__detail" cx="20" cy="250" r="60" />
        </g>
      </g>
    </svg>
  );
}

export default DecorativeBasketballCourt;
