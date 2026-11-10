import { h } from "./components/dom.js";
import { ProgressBar } from "./components/ProgressBar.js";
import { QuizCard } from "./components/QuizCard.js";
import { ResultModal } from "./components/ResultModal.js";
import { ReviewNote } from "./components/ReviewNote.js";
import { buildDailySet, todayKey } from "./engine/quiz.js";
import * as store from "./engine/store.js";

const app = document.getElementById("app");
const today = todayKey();
let day; // {date, questions, answers: [{correct, your}], done}

async function loadJson(path) {
  const res = await fetch(path);
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
    day = { ...buildDailySet(today, diary.entries, phrasal.entries, store.recentSrcIds()), answers: [], done: false };
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
  const streak = store.streak(today);
  const reviewCount = store.loadReview().length;

  const cta = day.done
    ? h("button", { class: "btn btn--primary btn--big", type: "button", onclick: showResult }, "오늘 결과 다시 보기")
    : h("button", { class: "btn btn--primary btn--big", type: "button", onclick: showQuiz }, answered ? `이어서 풀기 (${answered}/${total})` : "오늘의 퀴즈 시작");

  show(h("section", { class: "home" },
    h("p", { class: "home__date" }, today),
    h("h1", { class: "home__title" }, "Daily English Quiz"),
    h("p", { class: "home__lead" }, day.done ? `오늘 ${score} / ${total} 완료. 내일 새 문제가 나와요.` : "내 일기 표현 3문항 + 구동사 3문항, 5분이면 끝나요."),
    h("div", { class: "stats" },
      h("div", { class: "stat" }, h("strong", {}, `${streak}`), h("span", {}, "연속 학습일")),
      h("div", { class: "stat" }, h("strong", {}, `${reviewCount}`), h("span", {}, "복습할 문항"))
    ),
    cta,
    h("button", { class: "btn btn--ghost btn--big", type: "button", onclick: showReview }, "복습 노트")
  ));
}

function showQuiz() {
  const i = day.answers.length;
  if (i >= day.questions.length) return finish();
  const q = day.questions[i];

  show(
    h("div", { class: "quiz__top" },
      h("button", { class: "btn btn--ghost btn--small", type: "button", onclick: showHome, "aria-label": "홈으로" }, "← 홈"),
      ProgressBar({ total: day.questions.length, current: i, results: day.answers.map((a) => a.correct) })
    ),
    QuizCard({
      q, index: i, total: day.questions.length, isLast: i === day.questions.length - 1,
      onAnswer: ({ correct, your }) => {
        day.answers.push({ correct, your });
        store.saveDay(day);
        if (!correct) store.addReview({
          id: q.id, date: today, label: q.label, your,
          prompt: q.type === "write" ? q.ko : `${q.text}  (${q.ko})`,
          answer: q.model ?? q.full ?? q.text.replace("_____", q.answer),
          note: q.explain ?? q.hint,
        });
        // 진행 막대에 방금 결과를 반영
        app.querySelector(".progress").replaceWith(
          ProgressBar({ total: day.questions.length, current: i, results: day.answers.map((a) => a.correct) })
        );
      },
      onNext: showQuiz,
    })
  );
}

function finish() {
  if (!day.done) {
    day.done = true;
    store.saveDay(day);
    store.recordResult(today, day.answers.filter((a) => a.correct).length, day.questions.map((q) => q.src));
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
    onRemove: (id) => { store.removeReview(id); showReview(); },
    onBack: showHome,
  }));
}

init().catch((err) => {
  console.error(err);
  show(h("p", { class: "empty" }, "퀴즈 데이터를 불러오지 못했어요. 새로고침해 주세요."));
});
