/** Geometric wordmark: vector outlines keep the lettering identical on every device. */
export function WimmWordmark() {
  return <svg className="wimm-wordmark" viewBox="0 0 206 52" role="img" aria-label="Wimm" xmlns="http://www.w3.org/2000/svg">
    <g fill="currentColor">
      <path d="M2 8H13L21 33L30 8H40L49 33L57 8H68L54 46H44L35 22L26 46H16Z" />
      <circle cx="77" cy="11" r="5.2" />
      <path d="M72.5 21H81.5V46H72.5Z" />
    </g>
    <g fill="none" stroke="currentColor" strokeWidth="9">
      <path d="M92 46V31C92 19 111 19 111 31V46M111 31C111 19 130 19 130 31V46" />
      <path d="M143 46V31C143 19 162 19 162 31V46M162 31C162 19 181 19 181 31V46" />
    </g>
    <path className="wimm-wordmark-star" d="M195 1C197 10 199 12 206 14C199 16 197 18 195 27C193 18 191 16 184 14C191 12 193 10 195 1Z" />
  </svg>;
}
