// Shared shell for every secretary screen: sidebar on desktop, bottom tabs on
// mobile, consistent page padding. Keeps individual pages focused on content.
import Sidebar from '../../components/Sidebar'
import BottomTabBar from '../../components/BottomTabBar'

export default function SecretaryLayout({ children }) {
  return (
    <div className="min-h-screen bg-sand flex">
      <Sidebar role="secretary" />
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>
      <BottomTabBar role="secretary" />
    </div>
  )
}
