interface ScrollTopButtonProps {
  visible: boolean
  onClick: () => void
}

export default function ScrollTopButton({ visible, onClick }: ScrollTopButtonProps) {
  return (
    <button
      className={`scroll-top${visible ? ' visible' : ''}`}
      aria-label="Scroll to top"
      onClick={onClick}
    >
      &#9650;
    </button>
  )
}
