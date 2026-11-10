import { h } from "./components/dom.js";
import { ProgressBar } from "./components/ProgressBar.js";
import { QuizCard } from "./components/QuizCard.js";
import { ResultModal } from "./components/ResultModal.js";
import { ReviewNote } from "./components/ReviewNote.js";
import { buildDailySet, todayKey } from "./engine/quiz.js";
import * as store from "./engine/store.js";

const app = document.getElementById("app");
const today = todayKey(); // 학습일: 오전 8시에 바뀐다
let day; // {date, questions, answers: [{correct, your}], done}

async function loadJson(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

async function init() {
  day = store.loadDay(today);
  if (!day) {
    const [diary, phrasal] = await Promise.all([
      loadJson("docs/data/diary.json"),
      loadJson("docs/data/phrasal_verbs.json"),
    ]);
    const set = buildDailySet(today, diary.entries, phrasal.groups, store.recentSrcIds(), store.dueKeys(today));
    day = { ...set, answers: [], done: false };
    store.saveDay(day); // 하루 1세트 캐싱
  }
  showHome();
}

function show(...nodes) {
  app.replaceChildren(...nodes);
  window.scrollTo(0, 0);
}

function showHome() {
  const answered = day.answers.length;
  const total = day.questions.length;
  const score = day.answers.filter((a) => a.correct).length;
  const reviewCount = store.loadReview().length;
  const reviewToday = day.questions.filter((q) => q.review).length;

  const cta = day.done
    ? h("button", { class: "btn btn--primary btn--big", type: "button", onclick: showResult }, "오늘 결과 다시 보기")
    : h("button", { class: "btn btn--primary btn--big", type: "button", onclick: showQuiz }, answered ? `이어서 풀기 (${answered}/${total})` : "오늘의 퀴즈 시작");

  const lead = day.done
    ? `오늘 ${score} / ${total} 완료. 내일 오전 8시에 새 문제가 나와요.`
    : `내 일기 표현 6문항 + 구동사 4문항${reviewToday ? ` · 그중 복습 ${reviewToday}문항` : ""}`;

  show(h("section", { class: "home" },
    h("p", { class: "home__date" }, `${today} · 매일 오전 8시 갱신`),
    h("h1", { class: "home__title" }, "Daily English Quiz"),
    h("p", { class: "home__lead" }, lead),
    h("div", { class: "stats" },
      h("div", { class: "stat" }, h("strong", {}, `${store.streak(today)}`), h("span", {}, "연속 학습일")),
      h("div", { class: "stat" }, h("strong", {}, `${reviewCount}`), h("span", {}, "복습 노트"))
    ),
    cta,
    h("button", { class: "btn btn--ghost btn--big", type: "button", onclick: showReview }, "복습 노트")
  ));
}

function reviewItem(q, your) {
  return {
    id: q.id, date: today, label: q.label, your, q,
    prompt: q.type === "write" ? q.ko : [q.ask, q.text, q.ko && `(${q.ko})`].filter(Boolean).join(" "),
    answer: q.model ?? q.full,
    note: q.explain,
  };
}

function showQuiz() {
  const i = day.answers.length;
  const total = day.questions.length;
  if (i >= total) return finish();
  const q = day.questions[i];
  const bar = () => ProgressBar({ total, current: i, results: day.answers.map((a) => a.correct) });

  show(
    h("div", { class: "quiz__top" },
      h("button", { class: "btn btn--ghost btn--small", type: "button", onclick: showHome, "aria-label": "홈으로" }, "← 홈"),
      bar()
    ),
    QuizCard({
      q, index: i, total, isLast: i === total - 1,
      onAnswer: ({ correct, your }) => {
        day.answers.push({ correct, your });
        store.saveDay(day);
        store.updateSrs(q.srs, correct, today);
        if (!correct) store.addReview(reviewItem(q, your));
        else if (q.review) store.removeReviewBySrs(q.srs);
        app.querySelector(".progress").replaceWith(bar());
      },
      onNext: showQuiz,
    })
  );
}

function finish() {
  if (!day.done) {
    day.done = true;
    store.saveDay(day);
    store.recordResult(today, day.answers.filter((a) => a.correct).length, day.questions.length, day.questions.map((q) => q.src));
  }
  showHome();
  showResult();
}

function showResult() {
  const modal = ResultModal({ day, streak: store.streak(today), onClose: () => {}, onReview: showReview });
  document.body.append(modal);
  modal.showModal();
}

function showReview() {
  show(ReviewNote({
    items: store.loadReview(),
    scheduled: store.scheduledCount(),
    onRemove: (id) => { store.removeReview(id); showReview(); },
    onBack: showHome,
    onRetry: () => showRetry(store.loadReview().filter((r) => r.q), 0, []),
  }));
}

// 복습 노트 다시 풀기: 맞히면 노트에서 빠진다. 오늘의 점수·간격 반복 일정에는 영향을 주지 않는다.
function showRetry(items, i, results) {
  if (i >= items.length) return showReview();
  const q = { ...items[i].q, review: true };
  const bar = () => ProgressBar({ total: items.length, current: i, results });
  show(
    h("div", { class: "quiz__top" },
      h("button", { class: "btn btn--ghost btn--small", type: "button", onclick: showReview }, "← 노트"),
      bar()
    ),
    QuizCard({
      q, index: i, total: items.length, isLast: i === items.length - 1,
      onAnswer: ({ correct, your }) => {
        results.push(correct);
        if (correct) store.removeReview(q.id);
        else store.addReview(reviewItem(items[i].q, your));
        app.querySelector(".progress").replaceWith(bar());
      },
      onNext: () => showRetry(items, i + 1, results),
    })
  );
}

init().catch((err) => {
  console.error(err);
  show(h("p", { class: "empty" }, "퀴즈 데이터를 불러오지 못했어요. 새로고침해 주세요."));
});
