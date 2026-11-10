// 하루 10문항 세트 생성기. 같은 "학습일"에는 항상 같은 세트가 나온다(날짜 시드).
// 학습일은 오전 8시에 바뀐다.
// 구성(쉬운 것 → 어려운 것 순서)
//   다이어리 6: 뜻 고르기 1 · 표현 고르기 1 · 빈칸 쓰기 2 · 영작 2
//   구동사   4: 문장 빈칸 쓰기 2 · 문장 영작 2 (보기에서 고르는 문항 없음)
// 복습 예정(due) 항목은 직접 써야 하는 문항 자리에 먼저 배치한다.

const RESET_HOUR = 8;

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

// 복습 예정 항목 → 최근에 안 나온 항목 → 나머지 순으로 count개를 고른다.
function pick(pool, count, rnd, { avoid, due = new Set(), used = new Set(), key = (x) => x.id }) {
  const out = [];
  const take = (list) => {
    for (const item of shuffle(list, rnd)) {
      if (out.length >= count) return;
      if (used.has(key(item))) continue;
      used.add(key(item));
      out.push({ item, review: due.has(item.id) });
    }
  };
  take(pool.filter((x) => due.has(x.id)));
  take(pool.filter((x) => !avoid.has(x.id)));
  take(pool);
  return out;
}

function parseCloze(cloze) {
  const m = cloze.match(/\{\{(.+?)\}\}/);
  return { text: cloze.replace(/\{\{.+?\}\}/, "_____"), answer: m[1], full: cloze.replace(/\{\{(.+?)\}\}/, "$1") };
}

// 보기 4개: 정답 + 서로 다른 오답 3개
function options(answer, candidates, rnd) {
  const wrong = shuffle([...new Set(candidates)].filter((c) => c !== answer), rnd).slice(0, 3);
  return shuffle([answer, ...wrong], rnd);
}

export function todayKey(now = new Date()) {
  const d = new Date(now.getTime() - RESET_HOUR * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function flattenPhrasals(groups) {
  return groups.flatMap((g) =>
    g.examples.map(([cloze, ko], i) => ({
      id: `${g.phrase.replace(/\s+/g, "-")}-${i + 1}`,
      phrase: g.phrase, meaning: g.meaning, cloze, ko,
    }))
  );
}

// dueKeys: 복습 예정 항목의 키 목록. "word:<일기id>", "expr:<일기id>", "pv:<구동사 예문 id>"
export function buildDailySet(date, diary, phrasalGroups, recentIds = [], dueKeys = []) {
  const rnd = seededRandom(date);
  const avoid = new Set(recentIds);
  const dueOf = (kind) => new Set(dueKeys.filter((k) => k.startsWith(`${kind}:`)).map((k) => k.slice(kind.length + 1)));
  const byNewest = diary.slice().sort((a, b) => b.id.localeCompare(a.id));
  const used = new Set();
  const byWord = (e) => (e.word ?? e.id).toLowerCase(); // 같은 표현이 하루에 두 번 나오지 않게
  const withWord = byNewest.filter((e) => e.word && e.meaning); // 단어 없이 주요 표현만 있는 날도 있다

  // ── 다이어리: 빈칸 쓰기 2 (복습 예정 우선, 없으면 1번은 최근 일기 10건에서)
  const clozePool = withWord.filter((e) => e.cloze);
  const wordDue = dueOf("word");
  const clozes = pick(clozePool.slice(0, 10), wordDue.size ? 0 : 1, rnd, { avoid, used, key: byWord });
  clozes.push(...pick(clozePool, 2 - clozes.length, rnd, { avoid, due: wordDue, used, key: byWord }));
  // ── 다이어리: 4지선다 2
  const mcs = pick(withWord, 2, rnd, { avoid, used, key: byWord });
  // ── 다이어리: 영작 2
  const writes = pick(byNewest.filter((e) => e.expr && e.exprKo), 2, rnd, { avoid, due: dueOf("expr"), used: new Set(clozes.map((c) => c.item.id)) });

  const from = (e) => (e.title ? `${e.id} · ${e.title}` : e.id);
  const meanings = withWord.map((e) => e.meaning);
  const words = withWord.map((e) => e.word);
  const [m1, m2] = mcs.map((m) => m.item);
  const diaryQs = [
    {
      id: `d-meaning-${m1.id}`, src: m1.id, srs: `word:${m1.id}`, part: "diary", type: "choice",
      label: "오늘의 단어 · 뜻 고르기", ask: "이 표현의 뜻은?",
      text: m1.word, choices: options(m1.meaning, meanings, rnd), answer: m1.meaning,
      full: `${m1.word} — ${m1.meaning}`, explain: m1.cloze ? parseCloze(m1.cloze).full : null, from: from(m1),
    },
    {
      id: `d-word-${m2.id}`, src: m2.id, srs: `word:${m2.id}`, part: "diary", type: "choice",
      label: "오늘의 단어 · 표현 고르기", ask: "이 뜻에 맞는 표현은?",
      text: m2.meaning, choices: options(m2.word, words, rnd), answer: m2.word,
      full: `${m2.word} — ${m2.meaning}`, explain: m2.cloze ? parseCloze(m2.cloze).full : null, from: from(m2),
    },
    ...clozes.map(({ item: e, review }) => ({
      id: `d-cloze-${e.id}`, src: e.id, srs: `word:${e.id}`, part: "diary", type: "cloze", review,
      label: "오늘의 단어 · 빈칸 쓰기", ...parseCloze(e.cloze),
      ko: e.clozeKo, hint: `기본형: ${e.word}`, explain: `${e.word} — ${e.meaning}`, from: from(e),
    })),
    ...writes.map(({ item: e, review }) => ({
      id: `d-write-${e.id}`, src: e.id, srs: `expr:${e.id}`, part: "diary", type: "write", review,
      label: "영어 표현 · 영작", ko: e.exprKo, model: e.expr, hint: `첫 두 단어: ${e.expr.split(" ").slice(0, 2).join(" ")} …`, from: from(e),
    })),
  ];

  // ── 구동사 4: 복습 예정 항목은 직접 쓰는 자리(전치사 쓰기, 영작)에 먼저 넣는다.
  const pvs = flattenPhrasals(phrasalGroups);
  // 구동사는 문장에 따라 뜻이 달라지므로 보기에서 고르는 문항은 내지 않는다.
  // 항상 문장 전체와 그 문장에서의 뜻(해석)을 보여 주고, 빈칸을 직접 쓰거나 문장을 통째로 쓴다.
  const picked = pick(pvs, 4, rnd, { avoid, due: dueOf("pv"), key: (p) => p.phrase });
  const pvQs = [
    ...picked.slice(0, 2).map(({ item: p, review }) => {
      const c = parseCloze(p.cloze);
      return {
        id: `p-cloze-${p.id}`, src: p.id, srs: `pv:${p.id}`, part: "phrasal", type: "cloze", review,
        label: "구동사 · 문장 빈칸 쓰기", ...c, ko: p.ko,
        hint: `첫 글자: ${c.answer[0]} (${c.answer.length}글자)`, explain: `${p.phrase} — ${p.meaning}`,
      };
    }),
    ...picked.slice(2).map(({ item: p, review }) => ({
      id: `p-write-${p.id}`, src: p.id, srs: `pv:${p.id}`, part: "phrasal", type: "write", review,
      label: "구동사 · 문장 영작", ko: p.ko, model: parseCloze(p.cloze).full,
      hint: `${p.phrase} 사용`, explain: `${p.phrase} — ${p.meaning}`,
    })),
  ];

  return { date, questions: [...diaryQs, ...pvQs] };
}
