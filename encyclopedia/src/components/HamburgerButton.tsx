interface HamburgerButtonProps {
  active: boolean
  onClick: () => void
}

export default function HamburgerButton({ active, onClick }: HamburgerButtonProps) {
  return (
    <button
      className={`hamburger${active ? ' active' : ''}`}
      aria-label="Toggle sidebar"
      onClick={onClick}
    >
      <span></span><span></span><span></span>
    </button>
  )
}
