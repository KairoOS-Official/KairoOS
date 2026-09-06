import { useEffect, useRef, useState, useCallback } from 'react';

interface UseGamepadOptions {
  onBack?: () => void;
  onGamepadDetected?: () => void;
  enabled?: boolean;
}

export function useGamepad({
  onBack,
  onGamepadDetected,
  enabled = true,
}: UseGamepadOptions = {}) {
  const [hasGamepad, setHasGamepad] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const lastActionTime = useRef<number>(0);
  const prevFocusedEl = useRef<HTMLElement | null>(null);

  // Sélecteur des éléments focusables pour la navigation manette
  const getFocusableElements = useCallback((): HTMLElement[] => {
    const selector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
    return elements.filter((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    });
  }, []);

  // Détection des manettes connectées
  useEffect(() => {
    const handleConnected = () => {
      setHasGamepad(true);
      if (onGamepadDetected) onGamepadDetected();
    };

    const handleDisconnected = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const anyConnected = Array.from(gamepads).some((g) => g !== null && g.connected);
      setHasGamepad(anyConnected);
    };

    window.addEventListener('gamepadconnected', handleConnected);
    window.addEventListener('gamepaddisconnected', handleDisconnected);

    // Vérification initiale
    if (typeof navigator.getGamepads === 'function') {
      const gamepads = navigator.getGamepads();
      if (Array.from(gamepads).some((g) => g !== null && g.connected)) {
        setHasGamepad(true);
        if (onGamepadDetected) onGamepadDetected();
      }
    }

    return () => {
      window.removeEventListener('gamepadconnected', handleConnected);
      window.removeEventListener('gamepaddisconnected', handleDisconnected);
    };
  }, [onGamepadDetected]);

  // Boucle de polling Gamepad API
  useEffect(() => {
    if (!enabled) return;

    let animId: number;

    const poll = () => {
      const now = Date.now();
      const gamepads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
      const pad = Array.from(gamepads).find((g) => g !== null && g.connected);

      if (pad) {
        if (!hasGamepad) {
          setHasGamepad(true);
          if (onGamepadDetected) onGamepadDetected();
        }

        // Cooldown de répétition (180ms)
        if (now - lastActionTime.current > 180) {
          const up = pad.buttons[12]?.pressed || pad.axes[1] < -0.5;
          const down = pad.buttons[13]?.pressed || pad.axes[1] > 0.5;
          const left = pad.buttons[14]?.pressed || pad.axes[0] < -0.5;
          const right = pad.buttons[15]?.pressed || pad.axes[0] > 0.5;
          const btnA = pad.buttons[0]?.pressed; // Bouton A / Confirmer
          const btnB = pad.buttons[1]?.pressed; // Bouton B / Retour

          const focusables = getFocusableElements();

          if (focusables.length > 0) {
            if (down || right) {
              lastActionTime.current = now;
              setFocusedIndex((curr) => {
                const next = curr < 0 ? 0 : (curr + 1) % focusables.length;
                return next;
              });
            } else if (up || left) {
              lastActionTime.current = now;
              setFocusedIndex((curr) => {
                const prev = curr <= 0 ? focusables.length - 1 : curr - 1;
                return prev;
              });
            } else if (btnA) {
              lastActionTime.current = now + 150; // Extra délai pour éviter double-clic
              if (focusedIndex >= 0 && focusables[focusedIndex]) {
                focusables[focusedIndex].click();
              }
            } else if (btnB) {
              lastActionTime.current = now + 150;
              if (onBack) onBack();
            }
          }
        }
      }

      animId = requestAnimationFrame(poll);
    };

    animId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animId);
  }, [enabled, hasGamepad, focusedIndex, getFocusableElements, onBack, onGamepadDetected]);

  // Appliquer le focus visuel sur l'élément sélectionné
  useEffect(() => {
    if (prevFocusedEl.current) {
      prevFocusedEl.current.classList.remove('gamepad-focused');
      prevFocusedEl.current.style.outline = '';
      prevFocusedEl.current.style.boxShadow = '';
    }

    if (focusedIndex >= 0) {
      const focusables = getFocusableElements();
      const target = focusables[focusedIndex];
      if (target) {
        target.classList.add('gamepad-focused');
        target.style.outline = '3px solid #2563eb';
        target.style.outlineOffset = '2px';
        target.style.boxShadow = '0 0 0 4px rgba(37, 99, 235, 0.25)';
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        prevFocusedEl.current = target;
      }
    }
  }, [focusedIndex, getFocusableElements]);

  return { hasGamepad, focusedIndex };
}
