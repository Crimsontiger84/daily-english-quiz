// 채점. 빈칸·선택은 자동 채점, 영작은 유사도를 참고로 보여 주고 학습자가 스스로 판정한다.

export function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9' -]/g, " ")
    .replace(/\s+'/g, "'") // 휴대폰 자판이 "I 'm"처럼 띄어 쓴 경우도 같은 답으로 본다
    .replace(/\s+/g, " ")
    .trim();
}

export function isExact(input, answer) {
  return normalize(input) === normalize(answer);
}

// 모범 답안의 단어 중 내 답에 들어 있는 비율(0~1).
export function similarity(input, model) {
  const mine = new Set(normalize(input).split(" ").filter(Boolean));
  const target = normalize(model).split(" ").filter(Boolean);
  if (!target.length) return 0;
  return target.filter((w) => mine.has(w)).length / target.length;
}
