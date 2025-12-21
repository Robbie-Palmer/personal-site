export function smoothScrollTo(
  elementId: string,
  options: { offset?: number; duration?: number } = {},
): void {
  const { offset = 0, duration = 1000 } = options;
  const element = document.getElementById(elementId);
  if (!element) return;

  const start = window.scrollY;
  const elementPosition = element.getBoundingClientRect().top;
  const targetPosition = elementPosition + start - offset;
  const distance = targetPosition - start;
  let startTime: number | null = null;

  function animation(currentTime: number) {
    if (startTime === null) startTime = currentTime;
    const timeElapsed = currentTime - startTime;
    const run = easeInOutQuad(timeElapsed, start, distance, duration);
    window.scrollTo(0, run);

    if (timeElapsed < duration) {
      requestAnimationFrame(animation);
    }
  }

  function easeInOutQuad(t: number, b: number, c: number, d: number) {
    t /= d / 2;
    if (t < 1) return (c / 2) * t * t + b;
    t--;
    return (-c / 2) * (t * (t - 2) - 1) + b;
  }

  requestAnimationFrame(animation);
}
