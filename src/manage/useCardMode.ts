'use client';

/**
 * Switches a table to card layout whenever it doesn't fit its container.
 *
 * Attach `ref` to the `.table-wrap` and add `as-cards` to its className when
 * `cards` is true.
 *
 * Built to never oscillate (an earlier version did — table → cards → table on
 * every frame near the boundary — until React threw "Maximum update depth
 * exceeded"):
 *   - The width it needs is measured only in table mode: the table's
 *     min-content width plus its own scrollbar. Cards don't change it.
 *   - The width it has is the wrapper's outer width, which its own scrollbar
 *     doesn't change either.
 *   - Going back to a table needs HYSTERESIS px of spare room, so the page's
 *     scrollbar appearing/disappearing as the layout changes can't flip it.
 *   - At most one switch per MIN_SWITCH_MS, as a last-resort brake.
 */
import { useLayoutEffect, useRef, useState } from 'react';

const HYSTERESIS = 24;
const MIN_SWITCH_MS = 300;

export function useCardMode<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [cards, setCards] = useState(false);
  const cardsRef = useRef(false);
  const needed = useRef(0);
  const lastSwitch = useRef(0);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);

  // No dependency list on purpose: re-measure after every render, because new
  // data (longer names, more columns of text) can change the table's width.
  useLayoutEffect(() => {
    const wrap = ref.current;
    if (!wrap) return;

    const measure = () => {
      const table = wrap.querySelector('table');
      if (!table) return;

      if (!cardsRef.current) {
        // Table mode: the narrowest the table can be, plus the wrapper's
        // vertical scrollbar (if any) — independent of the current width.
        const prev = table.style.width;
        table.style.width = 'min-content';
        const minTable = Math.ceil(table.getBoundingClientRect().width);
        table.style.width = prev;
        const style = getComputedStyle(wrap);
        const borders = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
        const scrollbar = Math.max(0, wrap.offsetWidth - wrap.clientWidth - borders);
        needed.current = minTable + scrollbar + borders;
      }

      const available = wrap.offsetWidth;
      const next = cardsRef.current
        ? available < needed.current + HYSTERESIS // stay cards until there's clear room
        : available < needed.current;
      if (next === cardsRef.current) return;

      const wait = lastSwitch.current + MIN_SWITCH_MS - Date.now();
      if (wait > 0) {
        if (!retry.current) retry.current = setTimeout(() => { retry.current = null; measure(); }, wait);
        return;
      }
      lastSwitch.current = Date.now();
      cardsRef.current = next;
      setCards(next);
    };

    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(wrap);
    return () => {
      observer.disconnect();
      if (retry.current) { clearTimeout(retry.current); retry.current = null; }
    };
  });

  return { ref, cards };
}
