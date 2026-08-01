const paths = {
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
  league: <><circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2M4 8H2m20 0h-2"/></>,
  team: <><path d="M4 5h16v14H4z"/><path d="M8 5v14m8-14v14M4 12h16"/></>,
  games: <><circle cx="12" cy="12" r="9"/><path d="M4 8c4 1 7 5 8 13M20 8c-4 1-7 5-8 13M3 14c6-2 12-2 18 0"/></>,
  standings: <path d="M5 20V10h4v10m2 0V4h4v16m2 0v-7h4v7M3 20h20"/>,
  playoffs: <><path d="M8 4h8v5a4 4 0 0 1-8 0zM10 15h4m-2-2v5m-4 2h8"/><path d="M8 6H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4"/></>,
  freeAgency: <><path d="M4 20h16M7 17l10-10 2 2-10 10H7z"/><path d="m15 9-2-2 2-2 2 2"/></>,
  profile: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5l-.4 3.1a8 8 0 0 0-1.7 1L5 6.1 3 9.5 5.1 11a7 7 0 0 0 0 2L3 14.5 5 18l2.4-1a8 8 0 0 0 1.7 1l.4 3h5l.4-3a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2.1-1.5a7 7 0 0 0 .1-1z"/></>,
  logout: <><path d="M10 5H4v14h6M14 8l4 4-4 4m4-4H8"/></>,
  userPlus: <><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0m4-9v6m-3-3h6"/></>,
  clipboard: <><path d="M8 5H5v16h14V5h-3"/><path d="M9 3h6v4H9zM8 11h8m-8 4h8"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18M8 14h2m4 0h2m-8 4h2"/></>,
  bracket: <><path d="M5 4v5h4m-4 11v-5h4m10-11v5h-4m4 11v-5h-4M9 7h3v10H9m6-10h-3"/></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0zM10 15h4m-2-2v5m-4 2h8"/><path d="M8 6H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4"/></>,
  crown: <path d="m4 8 4 4 4-7 4 7 4-4-2 10H6zM6 21h12"/>,
  pen: <><path d="M4 20h5L20 9l-5-5L4 15zM13 6l5 5"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.01"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  history: <><path d="M4 12a8 8 0 1 0 2-5.3L4 9"/><path d="M4 4v5h5M12 8v5l3 2"/></>,
  plus: <><circle cx="12" cy="12" r="9"/><path d="M12 8v8m-4-4h8"/></>,
  trend: <><path d="m4 17 5-5 4 3 7-8"/><path d="M15 7h5v5"/></>,
  check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
};

function UiIcon({ name, size = 20, className = "" }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.info}</svg>;
}

export default UiIcon;
