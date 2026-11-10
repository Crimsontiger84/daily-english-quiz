import { h } from "./dom.js";
import { isExact, similarity } from "../engine/grade.js";

// 문항 1개. 답을 확정하면 onAnswer({correct, your})를 한 번 호출하고, 피드백 뒤 onNext로 넘어간다.
export function QuizCard({ q, index, total, isLast, onAnswer, onNext }) {
  const card = h("article", { class: "card" });
  const feedback = h("div", { class: "feedback", "aria-live": "polite" });
  const nextBtn = h("button", { class: "btn btn--primary", type: "button", onclick: onNext }, isLast ? "결과 보기" : "다음 문제");

  const head = h("header", { class: "card__head" },
    h("span", { class: `tag tag--${q.part}` }, q.label),
    h("span", { class: "card__count" }, `${index + 1} / ${total}`)
  );

  function settle(correct, your, lines) {
    card.classList.add(correct ? "is-correct" : "is-wrong");
    feedback.replaceChildren(
      h("p", { class: "feedback__verdict" }, correct ? "정답이에요" : "아쉬워요"),
      ...lines,
      nextBtn
    );
    onAnswer({ correct, your });
    nextBtn.focus();
  }

  let body;

  if (q.type === "choice") {
    const buttons = q.choices.map((c) =>
      h("button", {
        class: "choice", type: "button",
        onclick: () => {
          buttons.forEach((b) => {
            b.disabled = true;
            if (b.textContent === q.answer) b.classList.add("is-answer");
          });
          const correct = c === q.answer;
          if (!correct) buttons.find((b) => b.textContent === c).classList.add("is-picked-wrong");
          settle(correct, c, [h("p", { class: "feedback__model" }, q.full), h("p", { class: "feedback__note" }, q.explain)]);
        },
      }, c)
    );
    body = [
      h("p", { class: "card__sentence" }, q.text),
      h("p", { class: "card__ko" }, q.ko),
      h("div", { class: "choices" }, buttons),
    ];
  } else {
    const isCloze = q.type === "cloze";
    const input = isCloze
      ? h("input", { class: "input", type: "text", placeholder: "빈칸에 들어갈 표현", autocomplete: "off", autocapitalize: "off", spellcheck: false, enterKeyHint: "done", "aria-label": "빈칸 답" })
      : h("textarea", { class: "input input--area", rows: 3, placeholder: "영어로 써 보세요", autocapitalize: "sentences", spellcheck: false, "aria-label": "영작 답" });
    const hintBox = h("p", { class: "card__hint", hidden: true }, q.hint);
    const hintBtn = q.hint && h("button", { class: "btn btn--ghost", type: "button", onclick: () => { hintBox.hidden = false; hintBtn.hidden = true; } }, "힌트 보기");
    const submit = h("button", { class: "btn btn--primary", type: "submit" }, "확인");

    const form = h("form", {
      class: "answer",
      onsubmit: (e) => {
        e.preventDefault();
        const your = input.value.trim();
        if (!your) { input.focus(); return; }
        input.readOnly = true;
        submit.hidden = true;
        if (hintBtn) hintBtn.hidden = true;

        if (isCloze) {
          settle(isExact(your, q.answer), your, [
            h("p", { class: "feedback__model" }, q.text.replace("_____", q.answer)),
            h("p", { class: "feedback__note" }, q.hint),
          ]);
          return;
        }
        // 영작: 표현은 여러 가지가 맞을 수 있어 모범 답안과 비교한 뒤 스스로 판정한다.
        const pct = Math.round(similarity(your, q.model) * 100);
        const judge = (correct) => () => settle(correct, your, [
          h("p", { class: "feedback__model" }, q.model),
          q.hint && h("p", { class: "feedback__note" }, q.hint),
        ]);
        feedback.replaceChildren(
          h("p", { class: "feedback__label" }, "모범 답안"),
          h("p", { class: "feedback__model" }, q.model),
          h("p", { class: "feedback__note" }, `모범 답안과 겹치는 단어 ${pct}% · 뜻이 통하면 맞은 것으로 하세요.`),
          h("div", { class: "judge" },
            h("button", { class: "btn btn--ok", type: "button", onclick: judge(true) }, "맞았어요"),
            h("button", { class: "btn btn--no", type: "button", onclick: judge(false) }, "다시 볼래요")
          )
        );
      },
    }, input, hintBox, h("div", { class: "answer__actions" }, hintBtn, submit));

    // 한 줄 영작은 Enter로 제출(줄바꿈은 Shift+Enter)
    if (!isCloze) input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
    });

    body = isCloze
      ? [h("p", { class: "card__sentence" }, q.text), h("p", { class: "card__ko" }, q.ko), form]
      : [h("p", { class: "card__prompt" }, q.ko), form];
    queueMicrotask(() => input.focus({ preventScroll: true }));
  }

  card.append(head, ...body, feedback, q.from && h("p", { class: "card__from" }, `출처: 내 일기 ${q.from}`) || "");
  return card;
}
