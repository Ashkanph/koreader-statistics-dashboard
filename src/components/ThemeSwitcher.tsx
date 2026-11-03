import type { ThemePreference } from '../lib/theme.ts'

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

interface Props {
  value: ThemePreference
  onChange: (theme: ThemePreference) => void
}

export function ThemeSwitcher({ value, onChange }: Props) {
  return (
    <fieldset className="segmented">
      <legend className="visually-hidden">Theme</legend>
      {OPTIONS.map((option) => (
        <label key={option.value}>
          <input
            type="radio"
            name="theme"
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  )
}
