// localStorage 래퍼. 저장이 막힌 환경(사생활 보호 모드 등)에서도 앱은 메모리로 계속 동작한다.

const PREFIX = "deq.v1.";
const memory = {};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : (memory[key] ?? fallback);
  } catch {
    return memory[key] ?? fallback;
  }
}

function write(key, value) {
  memory[key] = value;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch { /* 메모리에만 유지 */ }
}

export const loadDay = (date) => read(`day.${date}`, null);
export const saveDay = (day) => write(`day.${day.date}`, day);

// history: [{date, score, srcIds}] 최신순, 최대 60일
export const loadHistory = () => read("history", []);
export function recordResult(date, score, srcIds) {
  const rest = loadHistory().filter((h) => h.date !== date);
  write("history", [{ date, score, srcIds }, ...rest].slice(0, 60));
}

export function recentSrcIds(days = 7) {
  return loadHistory().slice(0, days).flatMap((h) => h.srcIds);
}

export function streak(today) {
  const done = new Set(loadHistory().map((h) => h.date));
  const d = new Date(`${today}T00:00:00`);
  if (!done.has(today)) d.setDate(d.getDate() - 1); // 오늘 아직 안 풀었으면 어제까지의 연속 기록
  let n = 0;
  for (;;) {
    const p = (x) => String(x).padStart(2, "0");
    const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    if (!done.has(key)) return n;
    n++;
    d.setDate(d.getDate() - 1);
  }
}

// 복습 노트: 틀린 문항. 같은 문항은 최신 기록 하나만 남긴다.
export const loadReview = () => read("review", []);
export function addReview(item) {
  write("review", [item, ...loadReview().filter((r) => r.id !== item.id)].slice(0, 200));
}
export function removeReview(id) {
  write("review", loadReview().filter((r) => r.id !== id));
}
