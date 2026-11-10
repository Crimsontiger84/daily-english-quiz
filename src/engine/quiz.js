// 1일 6문항 세트 생성기. 같은 날짜에는 항상 같은 세트가 나온다(날짜 시드).
// 구성: 다이어리 3(빈칸 2 + 영작 1) + 구동사 3(전치사 선택 2 + 상황 영작 1)

function seededRandom(seedText) {
  let h = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i++) {
    h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rnd) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 최근에 낸 항목은 피하되, 남는 게 부족하면 전체에서 뽑는다.
function pick(pool, count, rnd, avoid) {
  const fresh = pool.filter((x) => !avoid.has(x.id));
  return shuffle(fresh.length >= count ? fresh : pool, rnd).slice(0, count);
}

function parseCloze(cloze) {
  const m = cloze.match(/\{\{(.+?)\}\}/);
  return { text: cloze.replace(/\{\{.+?\}\}/, "_____"), answer: m[1] };
}

export function todayKey(now = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function buildDailySet(date, diary, phrasals, recentIds = []) {
  const rnd = seededRandom(date);
  const avoid = new Set(recentIds);
  const byNewest = diary.slice().sort((a, b) => b.id.localeCompare(a.id));
  const clozePool = byNewest.filter((e) => e.cloze);

  // 빈칸 1번은 최근 일기 10건에서, 2번은 전체에서 — 최신 표현을 먼저 복습한다.
  const c1 = pick(clozePool.slice(0, 10), 1, rnd, avoid)[0];
  avoid.add(c1.id);
  const c2 = pick(clozePool, 1, rnd, avoid)[0];
  avoid.add(c2.id);
  const w = pick(byNewest.filter((e) => e.expr && e.exprKo), 1, rnd, avoid)[0];

  const diaryQs = [c1, c2].map((e) => ({
    id: `d-cloze-${e.id}`, src: e.id, part: "diary", type: "cloze",
    label: "다이어리 · 빈칸 채우기",
    ...parseCloze(e.cloze),
    ko: e.clozeKo, hint: `${e.word} — ${e.meaning}`, from: `${e.id} · ${e.title}`,
  }));
  diaryQs.push({
    id: `d-write-${w.id}`, src: w.id, part: "diary", type: "write",
    label: "다이어리 · 영작",
    ko: w.exprKo, model: w.expr, hint: null, from: `${w.id} · ${w.title}`,
  });

  const particles = [...new Set(phrasals.map((p) => p.particle))];
  const pv = pick(phrasals, 3, rnd, avoid);
  const pvQs = pv.slice(0, 2).map((p) => {
    // "up" vs "up on"처럼 겹치는 보기는 정답이 모호해지므로 뺀다.
    const overlaps = (x) => x.startsWith(p.particle) || p.particle.startsWith(x);
    const wrong = shuffle(particles.filter((x) => !overlaps(x)), rnd).slice(0, 3);
    return {
      id: `p-choice-${p.id}`, src: p.id, part: "phrasal", type: "choice",
      label: "구동사 · 전치사 선택",
      text: p.sentence.replace("___", "_____"), ko: p.sentenceKo,
      choices: shuffle([p.particle, ...wrong], rnd), answer: p.particle,
      full: p.sentence.replace("___", p.particle), explain: `${p.phrase} — ${p.meaning}`,
    };
  });
  const s = pv[2];
  pvQs.push({
    id: `p-write-${s.id}`, src: s.id, part: "phrasal", type: "write",
    label: "구동사 · 상황 영작",
    ko: s.situation, model: s.model, hint: `${s.phrase} — ${s.meaning}`,
  });

  return { date, questions: [...diaryQs, ...pvQs] };
}
