import { apiFetch } from "./client";

export interface PronSound {
  slug: string;
  order: number;
  ipa: string;
  kind: string;
  video_id: string;
  words: string[];
  pair: [string, string] | null;
  sentence: string;
  tip_vi: string;
}

export interface PronShadow {
  slug: string;
  order: number;
  video_id: string;
  title_vi: string;
  note_vi: string;
}

export interface PronCourse {
  source: string;
  intro: { id: string; title: string };
  sounds: PronSound[];
  shadowing: PronShadow[];
}

/** Public: the BBC videos and the practice texts of each sound. */
export const getPronCourse = () => apiFetch<PronCourse>("/api/v1/pronunciation");

/** Login required: score one recording of one practice text of a sound (Azure, en-GB). The
 * server only scores text the course itself offers for that sound. */
export const assessSound = (sound: string, text: string, wavB64: string) =>
  apiFetch<import("@/lib/speech-assess").SpeechScore>("/api/v1/me/pronunciation/assess", {
    method: "POST",
    json: { sound, text, wav_b64: wavB64 },
  });
