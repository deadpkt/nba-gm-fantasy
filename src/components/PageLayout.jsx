import Header from "./Header";
import PlayerDetailsModal from "./player/PlayerDetailsModal";

function PageLayout({ children }) {
  return (
    <main>
      <div className="arena-lights" aria-hidden="true" />
      <div className="court-lines court-lines--top" aria-hidden="true" />
      <Header />
      {children}
      <div className="court-lines court-lines--bottom" aria-hidden="true" />
      <PlayerDetailsModal />
    </main>
  );
}

export default PageLayout;
