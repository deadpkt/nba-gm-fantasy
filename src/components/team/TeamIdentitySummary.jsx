const ARCHETYPE_LABELS = { BALANCED: "Balanced", PACE_AND_SPACE: "Pace & Space", PERIMETER_OFFENSE: "Perimeter Offense", PAINT_DOMINANT: "Paint Dominant", DEFENSIVE_ANCHOR: "Defensive Anchor", SWITCHABLE_DEFENSE: "Switchable Defense", PLAYMAKING_HUB: "Playmaking Hub", STAR_CENTRIC: "Star-Centric", REBOUNDING_POWERHOUSE: "Rebounding Powerhouse", OFFENSIVE_FIREPOWER: "Offensive Firepower", DEFENSIVE_GRIND: "Defensive Grind" };
const TRAIT_LABELS = { elite_shooting: "Elite shooting", strong_playmaking: "Strong playmaking", rim_pressure: "Rim pressure", perimeter_defense: "Perimeter defense", interior_defense: "Interior defense", rebounding: "Rebounding", turnover_security: "Turnover security", poor_spacing: "Poor spacing", weak_rim_protection: "Weak rim protection", limited_creation: "Limited creation", weak_rebounding: "Weak rebounding", defensive_mismatch: "Defensive mismatch", star_dependency: "Star dependency" };

function Metric({ label, value }) { return <div className="team-identity__metric"><span>{label}</span><b>{value}</b></div>; }

export default function TeamIdentitySummary({ profile }) {
  if (!profile?.valid) return null;
  const limited = profile.ratingsConfidence !== "verified";
  return <section className="team-identity" aria-labelledby="team-identity-title">
    <header><div><p className="section-label">TEAM IDENTITY</p><h2 id="team-identity-title">{ARCHETYPE_LABELS[profile.archetype] || "Balanced"}</h2></div><span className={`team-identity__confidence is-${profile.ratingsConfidence}`}>{limited ? "Ratings data limited" : "Verified ratings"}</span></header>
    <div className="team-identity__metrics"><Metric label="Overall" value={profile.overall} /><Metric label="Offense" value={profile.offense} /><Metric label="Defense" value={profile.defense} /><Metric label="Shooting" value={profile.shooting} /><Metric label="Playmaking" value={profile.playmaking} /><Metric label="Rebounding" value={profile.rebounding} /></div>
    <footer><p><span>Strength</span><b>{TRAIT_LABELS[profile.primaryStrength] || "Balanced profile"}</b></p><i aria-hidden="true" /><p><span>Weakness</span><b>{TRAIT_LABELS[profile.primaryWeakness] || "No clear weakness"}</b></p></footer>
    {limited && <p className="team-identity__notice">Identity is an estimate until verified detailed player ratings are available.</p>}
  </section>;
}
