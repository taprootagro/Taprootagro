import { useState, useEffect } from 'react';

/**
 * Detect virtual keyboard visibility on mobile devices.
 * 
 * Strategy:
 * - Uses visualViewport API: when keyboard opens, visualViewport.height
 *   becomes significantly smaller than window.innerHeight.
 * - Threshold: 150px difference (keyboards are typically 250-350px tall).
 * - Falls back to false on desktop / unsupported browsers.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const THRESHOLD = 150; // px — minimum height difference to consider keyboard "open"

    function check() {
      // When keyboard opens, visualViewport.height shrinks but innerHeight stays the same
      const diff = window.innerHeight - (vv?.height ?? window.innerHeight);
      setVisible(diff > THRESHOLD);
    }

    vv.addEventListener('resize', check);
    // iOS also fires scroll when keyboard pushes viewport
    vv.addEventListener('scroll', check);

    // Initial check
    check();

    return () => {
      vv.removeEventListener('resize', check);
      vv.removeEventListener('scroll', check);
    };
  }, []);

  return visible;
}
