import Header from './Header'

function PageLayout({ children }) {
  return <main><Header />{children}</main>
}

export default PageLayout
