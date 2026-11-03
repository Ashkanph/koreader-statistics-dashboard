/** Decorative meter; the percentage is always shown as text next to it. */
export function ProgressBar({ value }: { value: number }) {
  return (
    <span className="progress" aria-hidden="true">
      <span className="progress-fill" style={{ width: `${Math.round(value * 100)}%` }} />
    </span>
  )
}
