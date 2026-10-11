/** Wordmark built from the supplied Bauhaus Demi letter outlines.
 * The initial W is exactly the same lowercase m rotated 180 degrees. */
export function WimmWordmark() {
  const mPath = "M182 0H48V336Q48 414 102 456Q156 498 247 498Q327 498 392 424Q454 498 546 498Q623 498 674 457Q730 412 730 336V0H596V292Q596 371 526 370Q480 369 456 325V0H322V292Q322 370 252 370Q182 370 182 292Z";
  const iPath = "M175 0H47V486H175ZM111 712Q144 712 165.5 690.5Q187 669 187 631Q187 593 165.5 571.5Q144 550 111 550Q78 550 56.5 571.5Q35 593 35 631Q35 669 56.5 690.5Q78 712 111 712Z";
  return (
    <svg className="wimm-wordmark" viewBox="0 0 2586 745" role="img" aria-label="Wimm" xmlns="http://www.w3.org/2000/svg">
      <g fill="currentColor" transform="translate(0 724) scale(1 -1)">
        <path d={mPath} transform="translate(778 498) rotate(180)" />
        <path d={iPath} transform="translate(784 0)" />
        <path d={mPath} transform="translate(1034 0)" />
        <path d={mPath} transform="translate(1812 0)" />
      </g>
    </svg>
  );
}
