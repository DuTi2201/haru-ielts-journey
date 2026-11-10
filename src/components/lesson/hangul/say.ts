import { createContext } from "react";

/** One voice for the whole alphabet lesson, so two letters never play over each other. */
export interface Say {
  play: (ko: string) => void;
  active: string | null;
  loading: boolean;
}
export const SayContext = createContext<Say>({
  play: () => undefined,
  active: null,
  loading: false,
});

/** Whether the Vietnamese «mốc» shows on the letter cards (off by default: the ear first, then the eye). */
export const ViHintContext = createContext<{ on: boolean; toggle: () => void }>({
  on: false,
  toggle: () => undefined,
});
