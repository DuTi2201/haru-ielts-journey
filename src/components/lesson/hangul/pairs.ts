import type { PairSet } from "./coach";

/** Sounds easy to mix up, per part of the alphabet lesson (heard one after another in PairDrill). */
export const PAIRS: Record<string, PairSet[]> = {
  p1: [
    {
      title: "어 · 오",
      items: ["어", "오"],
      hint: "Cả hai lưỡi lùi sau. 어: hạ cằm, môi KHÔNG tròn. 오: môi chu tròn nhỏ.",
    },
    {
      title: "우 · 으",
      items: ["우", "으"],
      hint: "우: môi tròn đẩy ra trước. 으: kéo ngang khóe miệng, môi dẹt.",
    },
    {
      title: "여 · 요",
      items: ["여", "요"],
      hint: "Cùng bắt đầu bằng «i» lướt nhanh, rồi dừng ở 어 (môi mở) hoặc 오 (môi tròn).",
    },
  ],
  p2: [
    {
      title: "가 · 카",
      items: ["가", "카"],
      hint: "가: hơi nhẹ, giọng trầm. 카: bật mạnh hơi, giọng cao — để tờ giấy trước miệng, 카 làm giấy bay.",
    },
    {
      title: "다 · 타",
      items: ["다", "타"],
      hint: "Đầu lưỡi chạm lợi trên. 타 bật hơi và cao giọng hơn 다.",
    },
    {
      title: "바 · 파",
      items: ["바", "파"],
      hint: "Hai môi. 파 bật hơi mạnh, giọng cao; 바 nhẹ, giọng trầm.",
    },
    { title: "자 · 차", items: ["자", "차"], hint: "Mặt lưỡi áp vòm cứng. 차 bật hơi, giọng cao." },
  ],
  p3: [
    {
      title: "가 · 카 · 까",
      items: ["가", "카", "까"],
      hint: "Trầm–nhẹ / cao–bật hơi / cao–nén cổ. Người Hàn nhận ra bộ ba này một nửa nhờ CAO ĐỘ.",
    },
    {
      title: "다 · 타 · 따",
      items: ["다", "타", "따"],
      hint: "따: lưỡi ép chặt, cổ họng căng, không bật hơi.",
    },
    {
      title: "바 · 파 · 빠",
      items: ["바", "파", "빠"],
      hint: "빠: môi mím chặt rồi mở, giấy đứng yên.",
    },
    {
      title: "자 · 차 · 짜",
      items: ["자", "차", "짜"],
      hint: "짜: nén mạnh, giọng cao, không có hơi.",
    },
    {
      title: "사 · 싸",
      items: ["사", "싸"],
      hint: "싸: căng và mạnh hơn, giọng cao; 사 nhẹ, có hơi xì.",
    },
  ],
  p4: [
    {
      title: "각 · 갇 · 갑",
      items: ["각", "갇", "갑"],
      hint: "Âm cuối «nuốt»: khép lưỡi/môi vào đúng chỗ rồi GIỮ, không bật hơi ra.",
    },
    {
      title: "간 · 강 · 감",
      items: ["간", "강", "감"],
      hint: "ㄴ: lưỡi chạm lợi; ㅇ: cuống lưỡi chặn; ㅁ: mím môi — cả ba đều cho hơi ra mũi.",
    },
    {
      title: "갈 · 간",
      items: ["갈", "간"],
      hint: "ㄹ cuối: đầu lưỡi cong lên chạm lợi trên và giữ nguyên, hơi đi hai bên lưỡi.",
    },
  ],
};
