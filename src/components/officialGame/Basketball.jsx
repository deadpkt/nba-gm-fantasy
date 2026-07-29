function Basketball({ ball, event }) {
  return (
    <span
      className={`court-ball ball-${ball.mode}`}
      key={`ball-${event?.sequence || 0}`}
      style={{
        "--ball-from-x": `${ball.from.x}%`,
        "--ball-from-y": `${ball.from.y}%`,
        "--ball-via-x": `${ball.via.x}%`,
        "--ball-via-y": `${ball.via.y}%`,
        "--ball-to-x": `${ball.to.x}%`,
        "--ball-to-y": `${ball.to.y}%`,
      }}
      aria-label="Basketball"
    />
  );
}

export default Basketball;
