'use client';

/**
 * Switches a table to card layout whenever it doesn't fit its container.
 *
 * Attach `ref` to the `.table-wrap` and add `as-cards` to its className when
 * `cards` is true. While in table mode it records the table's natural width;
 * it goes back to a table once the container is at least that wide again.
 * Works for any screen (phone, iPad, narrow window) and any data, instead of
 * guessing a breakpoint per table.
 */
import { useLayoutEffect, useRef, useState } from 'react';

export function useCardMode<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [cards, setCards] = useState(false);
  const neededWidth = useRef(0);

  // No dependency list on purpose: re-measure after every render, because new
  // data (longer names, more columns of text) can change the table's width.
  useLayoutEffect(() => {
    const wrap = ref.current;
    if (!wrap) return;

    const measure = () => {
      const table = wrap.querySelector('table');
      if (!table) return;
      // Only a real table layout tells us how wide the table wants to be.
      if (!wrap.classList.contains('as-cards')) neededWidth.current = table.scrollWidth;
      setCards(wrap.clientWidth + 1 < neededWidth.current);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  });

  return { ref, cards };
}
