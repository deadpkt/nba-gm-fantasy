function PlayoffPicture() {
  return (
    <section className="season-playoffs">
      <div>
        <span>PLAYOFF PICTURE</span>
        <b>Postseason race</b>
        <p>
          Playoff seeding will appear here when league playoff logic and
          standings are available.
        </p>
      </div>
      <div className="season-playoffs__bracket" aria-hidden="true">
        <i>01</i>
        <em />
        <i>02</i>
        <em />
        <i>03</i>
        <em />
        <i>04</i>
      </div>
    </section>
  );
}
export default PlayoffPicture;
