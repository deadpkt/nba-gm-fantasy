import { Link } from 'react-router-dom'
import PageLayout from '../components/PageLayout'

function NotFoundPage() {
  return (
    <PageLayout>
      <section className="not-found-page">
        <p className="section-label">OFF THE COURT</p>
        <span className="not-found-code">404</span>
        <h1>This play does not exist.</h1>
        <p>The page you are looking for has moved, expired, or never made the roster.</p>
        <Link to="/">Return to player market <span>→</span></Link>
      </section>
    </PageLayout>
  )
}

export default NotFoundPage
