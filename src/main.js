import { h } from "./components/dom.js";
import { ProgressBar } from "./components/ProgressBar.js";
import { QuizCard } from "./components/QuizCard.js";
import { ResultModal, resultPayload } from "./components/ResultModal.js";
import * as logsync from "./engine/logsync.js";
import { ReviewNote } from "./components/ReviewNote.js";
import { buildDailySet, todayKey } from "./engine/quiz.js";
import * as store from "./engine/store.js";

const app = document.getElementById("app");
const today = todayKey(); // 학습일: 오전 8시에 바뀐다
const SET_VERSION = 3; // 문항 구성을 바꿀 때 올린다
let day; // {date, questions, answers: [{correct, your}], done}

async function loadJson(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

// ── 구글 시트 기록 ─────────────────────────────────────────────
let logNote = ""; // 마지막 전송 결과(홈 화면에 표시)

function logStatusText() {
  if (!store.loadLogConfig()) return "기록 저장: 꺼짐";
  const waiting = store.loadOutbox().length;
  return `기록 저장: 구글 시트 연결됨${waiting ? ` · 대기 ${waiting}건` : ""}${logNote ? ` · ${logNote}` : ""}`;
}

function refreshLogStatus() {
  const el = document.getElementById("log-status");
  if (el) el.textContent = logStatusText();
}

// 못 보낸 기록을 순서대로 보낸다. 실패한 것은 남겨 두고 다음에 다시 시도한다.
async function flushOutbox() {
  const cfg = store.loadLogConfig();
  if (!cfg) return;
  for (const payload of store.loadOutbox()) {
    try {
      const result = await logsync.send(cfg, payload);
      store.saveOutbox(store.loadOutbox().filter((p) => p.runId !== payload.runId));
      logNote = result === "saved" ? `${payload.date} 저장됨` : `${payload.date} 전송함`;
    } catch (err) {
      logNote = `전송 실패(${err.message}) — 다음에 다시 시도해요`;
      break;
    }
  }
  refreshLogStatus();
}

function queueLog() {
  const payload = resultPayload(day, store.deviceId());
  store.saveOutbox([...store.loadOutbox().filter((p) => p.runId !== payload.runId), payload]);
  return flushOutbox();
}

// 이 기기에 남아 있는 끝낸 퀴즈를 모두 보낸다(연결 전에 푼 것 포함). 이미 저장된 기록은 시트 쪽에서 걸러진다.
function queueAllDone() {
  const device = store.deviceId();
  const all = store.loadDoneDays().map((d) => resultPayload(d, device));
  const ids = new Set(all.map((p) => p.runId));
  store.saveOutbox([...store.loadOutbox().filter((p) => !ids.has(p.runId)), ...all]);
  return flushOutbox().then(() => all.length);
}

// 연동 링크를 주소 뒤에 붙여 열면(#log=…) 그 기기에 저장하고 주소에서 지운다.
function readSetupLink() {
  const m = location.hash.match(/^#log=(.+)$/);
  if (!m) return;
  const cfg = logsync.parseLink(decodeURIComponent(m[1]));
  if (cfg) store.saveLogConfig(cfg);
  history.replaceState(null, "", location.pathname + location.search);
}

async function init() {
  readSetupLink();
  flushOutbox();
  day = store.loadDay(today);
  // 문항 구성이 바뀌었으면, 아직 풀기 시작하지 않은 세트는 새 구성으로 다시 만든다.
  if (day && day.v !== SET_VERSION && day.answers.length === 0) day = null;
  if (!day) {
    const [diary, phrasal] = await Promise.all([
      loadJson("docs/data/diary.json"),
      loadJson("docs/data/phrasal_verbs.json"),
    ]);
    const set = buildDailySet(today, diary.entries, phrasal.groups, store.recentSrcIds(), store.dueKeys(today));
    day = { ...set, v: SET_VERSION, answers: [], done: false };
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
    h("button", { class: "btn btn--ghost btn--big", type: "button", onclick: showReview }, "복습 노트"),
    h("button", { class: "linkbtn", type: "button", id: "log-status", onclick: showLogSettings }, logStatusText())
  ));
}

function showLogSettings(note) {
  const cfg = store.loadLogConfig();
  const input = h("input", { class: "input", type: "url", placeholder: "https://script.google.com/macros/s/…/exec?key=…", autocomplete: "off", autocapitalize: "off", spellcheck: false, "aria-label": "연동 링크" });
  const msg = h("p", { class: "view__lead", "aria-live": "polite" }, typeof note === "string" ? note : cfg ? "현재 연결되어 있어요. 퀴즈를 끝내면 결과가 자동으로 시트에 저장됩니다." : "아직 연결되지 않았어요.");

  const save = async () => {
    const next = logsync.parseLink(input.value);
    if (!next) { msg.textContent = "링크 형식이 맞지 않아요. script.google.com 으로 시작하고 ?key= 가 붙은 링크를 붙여 넣어 주세요."; return; }
    msg.textContent = "연결을 확인하는 중…";
    try {
      if (!(await logsync.test(next))) { msg.textContent = "연동 키가 맞지 않아요. 링크를 다시 확인해 주세요."; return; }
      store.saveLogConfig(next);
      input.value = "";
      const n = await queueAllDone();
      showLogSettings(`연결됐어요. 이 기기에 있던 결과 ${n}건을 보냈습니다. ${logNote}`);
    } catch {
      // 일부 브라우저는 확인 응답을 읽지 못한다. 저장은 하고, 테스트 전송으로 확인하게 한다.
      store.saveLogConfig(next);
      showLogSettings("링크를 저장했어요. 연결 확인 응답은 읽지 못했으니 아래 '테스트 기록 보내기'로 확인해 주세요.");
    }
  };

  // 시트에 실제로 한 줄이 써지는지 확인한다. 서버가 돌려준 오류를 그대로 보여 준다.
  const sendTest = async () => {
    msg.textContent = "테스트 기록을 보내는 중…";
    try {
      const result = await logsync.send(store.loadLogConfig(), {
        runId: `test-${Date.now()}`, date: today, device: "연결 테스트", score: 0, total: 0, items: [],
      });
      msg.textContent = result === "saved"
        ? "저장 확인됨. 시트의 '요약' 탭에 '연결 테스트' 줄이 생겼어요(지워도 됩니다)."
        : "보내긴 했지만 응답을 읽지 못했어요. 시트의 '요약' 탭에 '연결 테스트' 줄이 생겼는지 확인해 주세요.";
    } catch (err) {
      msg.textContent = `저장 실패: ${err.message}`;
    }
  };

  const resendAll = async () => {
    msg.textContent = "보내는 중…";
    const n = await queueAllDone();
    msg.textContent = n ? `결과 ${n}건을 보냈습니다. ${logNote}` : "이 기기에 끝낸 퀴즈 기록이 없어요. 오늘 퀴즈를 끝내면 자동으로 저장됩니다.";
  };

  show(h("section", { class: "view" },
    h("header", { class: "view__head" },
      h("button", { class: "btn btn--ghost btn--small", type: "button", onclick: showHome }, "← 홈"),
      h("h2", {}, "기록 저장 설정")
    ),
    h("p", { class: "view__lead" }, "퀴즈 결과를 내 구글 시트에 자동으로 저장합니다. 연동 링크는 이 기기에만 저장되고 다른 곳으로 보내지 않습니다."),
    msg,
    h("form", { class: "answer", onsubmit: (e) => { e.preventDefault(); save(); } },
      input,
      h("button", { class: "btn btn--primary", type: "submit" }, cfg ? "링크 바꾸기" : "연결하기")
    ),
    cfg && h("button", { class: "btn btn--ghost", type: "button", onclick: () => { store.saveLogConfig(null); logNote = ""; showLogSettings(); } }, "연결 끊기"),
    cfg && h("button", { class: "btn btn--ghost", type: "button", onclick: sendTest }, "테스트 기록 보내기"),
    cfg && h("button", { class: "btn btn--ghost", type: "button", onclick: resendAll }, "지난 결과 모두 다시 보내기")
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
    queueLog(); // 연결돼 있으면 바로 전송, 아니면 연결될 때까지 보관
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
