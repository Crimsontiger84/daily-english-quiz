// localStorage 래퍼. 저장이 막힌 환경(사생활 보호 모드 등)에서도 앱은 메모리로 계속 동작한다.

const PREFIX = "deq.v2.";
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

export function addDays(dateKey, n) {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + n);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const loadDay = (date) => read(`day.${date}`, null);
export const saveDay = (day) => write(`day.${day.date}`, day);

// history: [{date, score, total, srcIds}] 최신순, 최대 60일
export const loadHistory = () => read("history", []);
export function recordResult(date, score, total, srcIds) {
  const rest = loadHistory().filter((h) => h.date !== date);
  write("history", [{ date, score, total, srcIds }, ...rest].slice(0, 60));
}

export function recentSrcIds(days = 5) {
  return loadHistory().slice(0, days).flatMap((h) => h.srcIds);
}

export function streak(today) {
  const done = new Set(loadHistory().map((h) => h.date));
  let day = done.has(today) ? today : addDays(today, -1); // 오늘 아직 안 풀었으면 어제까지의 연속 기록
  let n = 0;
  while (done.has(day)) { n++; day = addDays(day, -1); }
  return n;
}

// ── 간격 반복(SRS). 틀린 항목은 1일 뒤에 다시 나오고, 맞힐 때마다 3 → 7 → 14일로 벌어진 뒤 졸업한다.
const INTERVALS = [1, 3, 7, 14];
export const loadSrs = () => read("srs", {});
export function updateSrs(key, correct, today) {
  const srs = loadSrs();
  const cur = srs[key];
  if (!correct) srs[key] = { box: 0, due: addDays(today, INTERVALS[0]) };
  else if (cur) {
    const box = cur.box + 1;
    if (box >= INTERVALS.length) delete srs[key];
    else srs[key] = { box, due: addDays(today, INTERVALS[box]) };
  }
  write("srs", srs);
}
export function dueKeys(today) {
  return Object.entries(loadSrs()).filter(([, v]) => v.due <= today).map(([k]) => k);
}
export function scheduledCount() {
  return Object.keys(loadSrs()).length;
}

// ── 구글 시트 기록 연동. logConfig: {url, key} | null, outbox: 아직 못 보낸 기록들
export const loadLogConfig = () => read("logConfig", null);
export const saveLogConfig = (cfg) => write("logConfig", cfg);
export const loadOutbox = () => read("outbox", []);
export const saveOutbox = (list) => write("outbox", list.slice(-30));
export function deviceId() {
  let id = read("device", null);
  if (!id) {
    id = Math.random().toString(36).slice(2, 8);
    write("device", id);
  }
  return id;
}

// ── 복습 노트: 틀린 문항(문항 전체를 저장해 다시 풀 수 있게 한다). 같은 문항은 최신 기록 하나만.
export const loadReview = () => read("review", []);
export function addReview(item) {
  write("review", [item, ...loadReview().filter((r) => r.id !== item.id)].slice(0, 200));
}
// 같은 표현을 다른 유형의 문항으로 맞힌 경우에도 노트에서 뺀다.
export function removeReviewBySrs(srsKey) {
  write("review", loadReview().filter((r) => r.q?.srs !== srsKey));
}
export function removeReview(id) {
  write("review", loadReview().filter((r) => r.id !== id));
}
