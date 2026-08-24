import { useRef } from "react";

type CompositionHandlers<T extends HTMLElement> = {
  onKeyDown?: React.KeyboardEventHandler<T>;
  onCompositionStart?: React.CompositionEventHandler<T>;
  onCompositionEnd?: React.CompositionEventHandler<T>;
};

/** Preserves normal IME composition semantics for shared form controls. */
export function useComposition<T extends HTMLElement>(handlers: CompositionHandlers<T>) {
  const composing = useRef(false);
  return {
    onKeyDown: (event: React.KeyboardEvent<T>) => handlers.onKeyDown?.(event),
    onCompositionStart: (event: React.CompositionEvent<T>) => {
      composing.current = true;
      handlers.onCompositionStart?.(event);
    },
    onCompositionEnd: (event: React.CompositionEvent<T>) => {
      composing.current = false;
      handlers.onCompositionEnd?.(event);
    },
    isComposing: () => composing.current,
  };
}
