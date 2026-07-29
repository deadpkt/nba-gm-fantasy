function ProgressBadge({ unlocked = false, progressAvailable = false }) {
  if (unlocked)
    return (
      <span className="progress-badge progress-badge--unlocked">
        <i aria-hidden="true">✓</i> Unlocked
      </span>
    );
  if (!progressAvailable)
    return (
      <span className="progress-badge">
        <i aria-hidden="true">—</i> Tracking unavailable
      </span>
    );
  return (
    <span className="progress-badge">
      <i aria-hidden="true">◌</i> In progress
    </span>
  );
}

export default ProgressBadge;
