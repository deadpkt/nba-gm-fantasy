function FullCourtLogo({ size = 32, className = "" }) {
  return <svg className={`full-court-mark ${className}`} width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <circle cx="24" cy="24" r="20" fill="currentColor" />
    <circle cx="24" cy="24" r="19" stroke="rgba(255,255,255,.28)" strokeWidth="1.5" />
    <path d="M5.5 20.5h37M24 4.5v39M10.2 10.6c8.2 5.2 11.4 13.6 9.5 25.1M37.8 10.6c-8.2 5.2-11.4 13.6-9.5 25.1" stroke="#071426" strokeWidth="2.4" strokeLinecap="round" />
  </svg>;
}

export default FullCourtLogo;
