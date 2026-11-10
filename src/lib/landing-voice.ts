import { useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api/client";
import { pickAudioSrc } from "@/lib/audio-playback";

/** The home page's Korean lines read aloud in Haru's Chirp voice. The server makes each recording
 * once and keeps it (GET /api/v1/audio/landing, app/services/landing_audio.py): a visitor only reads
 * a stored file, never causes a Google call. A line without a recording yet (the first seconds
 * after a deploy) is read by the device's own voice. */

type Clip = { text: string; status: "ready" | "pending"; aac_path?: string; opus_path?: string };

let clips: Promise<Record<string, string>> | null = null;

/** One request per page view, shared by every demo on the page. */
function loadClips(): Promise<Record<string, string>> {
  clips ??= apiFetch<{ items: Clip[] }>("/api/v1/audio/landing")
    .then((out) => {
      const found: Record<string, string> = {};
      for (const c of out.items) {
        if (c.status === "ready" && c.aac_path && c.opus_path) {
          found[c.text] = pickAudioSrc({
            cache_key: "",
            duration_sec: 0,
            aac_path: c.aac_path,
            opus_path: c.opus_path,
          });
        }
      }
      if (Object.keys(found).length < out.items.length) clips = null; // ask again next time
      return found;
    })
    .catch(() => {
      clips = null;
      return {};
    });
  return clips;
}

export function useLandingVoice() {
  const [device, setDevice] = useState(false);
  const [stored, setStored] = useState<Record<string, string>>({});
  const player = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    setDevice(typeof window !== "undefined" && "speechSynthesis" in window);
    let live = true;
    void loadClips().then((found) => {
      if (live) setStored(found);
    });
    return () => {
      live = false;
      player.current?.pause();
    };
  }, []);

  const speak = (text: string) => {
    const src = stored[text];
    try {
      if (device) window.speechSynthesis.cancel();
      if (src) {
        const el = player.current ?? new Audio();
        player.current = el;
        el.pause();
        el.src = src;
        void el.play().catch(() => {});
        return;
      }
      if (!device) return;
      player.current?.pause();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ko-KR";
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    } catch {
      /* no voice on this device: the text is still on screen */
    }
  };

  return { ok: device || Object.keys(stored).length > 0, speak };
}
