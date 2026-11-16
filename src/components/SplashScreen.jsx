// Branded loading screen
export default function SplashScreen() {
  return (
    <div
      className="fixed inset-0 z-[100] bg-mist flex flex-col items-center justify-center px-6 text-center"
      role="status"
      aria-label="Loading NowMed"
    >
      <p
        className="splash-word text-5xl sm:text-7xl font-extrabold tracking-tight text-plum uppercase select-none"
        style={{ fontFamily: "'Bricolage Grotesque', 'DM Sans', sans-serif" }}
      >
        Now Med
      </p>
      <p className="splash-tagline mt-3 text-sm sm:text-base font-semibold text-rose uppercase tracking-wide">
        Turning <span className="splash-now-now">now now</span> into now
      </p>
      <div className="mt-8 h-1 w-24 rounded-full bg-blush overflow-hidden">
        <div className="splash-bar h-full w-1/2 rounded-full bg-rose" />
      </div>
    </div>
  )
}
