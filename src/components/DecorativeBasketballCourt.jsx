function DecorativeBasketballCourt({ className = "" }) {
  return (
    <svg
      className={`decorative-court ${className}`}
      viewBox="0 0 940 500"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" vectorEffect="non-scaling-stroke">
        <rect className="decorative-court__line" x="20" y="20" width="900" height="460" rx="3" />
        <path className="decorative-court__line" d="M470 20v460" />
        <circle className="decorative-court__line" cx="470" cy="250" r="61" />
        <circle className="decorative-court__detail" cx="470" cy="250" r="4" />

        <path className="decorative-court__paint" d="M20 166h190v168H20M920 166H730v168h190" />
        <path className="decorative-court__line" d="M210 166v168M730 166v168" />
        <circle className="decorative-court__line" cx="210" cy="250" r="61" />
        <circle className="decorative-court__line" cx="730" cy="250" r="61" />
        <path className="decorative-court__detail" strokeDasharray="8 8" d="M210 189a61 61 0 0 0 0 122M730 189a61 61 0 0 1 0 122" />

        <path className="decorative-court__line" d="M20 70h92A225 225 0 0 1 112 430H20M920 70h-92a225 225 0 0 0 0 360h92" />
        <path className="decorative-court__detail" d="M55 215v70M885 215v70" />
        <circle className="decorative-court__accent" cx="74" cy="250" r="9" />
        <circle className="decorative-court__accent" cx="866" cy="250" r="9" />
        <path className="decorative-court__detail" d="M74 220a30 30 0 0 1 0 60M866 220a30 30 0 0 0 0 60" />
      </g>
    </svg>
  );
}

export default DecorativeBasketballCourt;
