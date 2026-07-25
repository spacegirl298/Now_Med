// Shared shell for every patient screen: sidebar on desktop, bottom tabs on
// mobile, consistent page padding. Mirrors SecretaryLayout so both roles
// share the same app chrome.
import Sidebar from '../../components/Sidebar'
import BottomTabBar from '../../components/BottomTabBar'

export default function PatientLayout({ children }) {
  return (
    <div className="min-h-screen bg-sand flex">
      <Sidebar role="patient" />
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>
      <BottomTabBar role="patient" />
    </div>
  )
}