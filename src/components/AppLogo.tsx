// The app icon is the favicon itself (public/favicon.svg), so it's one file shared by the
// browser tab, the header and the home page.
const LOGO_URL = `${import.meta.env.BASE_URL}favicon.svg`

/** Decorative: always shown next to the app's name, so hidden from assistive tech. */
export function AppLogo({ size, className }: { size: number; className?: string }) {
  return <img src={LOGO_URL} alt="" width={size} height={size} className={className} />
}
