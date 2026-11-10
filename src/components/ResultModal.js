import { h } from "./dom.js";

function message(score, total) {
  const r = score / total;
  if (r === 1) return "완벽해요!";
  if (r >= 0.8) return "거의 다 왔어요";
  if (r >= 0.5) return "절반 넘었어요";
  return "틀린 문제는 내일 다시 나와요";
}

// 오늘 결과 모달(<dialog>). 닫으면 onClose, 복습 노트로 가면 onReview.
export function ResultModal({ day, streak, onClose, onReview }) {
  const score = day.answers.filter((a) => a.correct).length;
  const total = day.questions.length;
  const dialog = h("dialog", { class: "modal", "aria-labelledby": "result-title" });

  const rows = day.questions.map((q, i) => {
    const a = day.answers[i];
    return h("li", { class: `result__row ${a.correct ? "ok" : "no"}` },
      h("span", { class: "result__mark", "aria-hidden": "true" }, a.correct ? "○" : "×"),
      h("span", { class: "result__text" },
        h("span", { class: "result__label" }, q.review ? `${q.label} · 복습` : q.label),
        h("span", { class: "result__answer" }, q.model ?? q.full)
      )
    );
  });

  dialog.append(
    h("p", { class: "modal__eyebrow" }, day.date),
    h("h2", { id: "result-title", class: "modal__score" }, `${score}`, h("small", {}, ` / ${total}`)),
    h("p", { class: "modal__msg" }, `${message(score, total)}${streak > 1 ? ` · ${streak}일 연속` : ""}`),
    h("ul", { class: "result" }, rows),
    h("div", { class: "modal__actions" },
      score < total && h("button", { class: "btn btn--primary", type: "button", onclick: () => { dialog.close(); onReview(); } }, "복습 노트 보기"),
      h("button", { class: `btn ${score < total ? "btn--ghost" : "btn--primary"}`, type: "button", onclick: () => dialog.close() }, "닫기")
    )
  );
  dialog.addEventListener("close", () => { dialog.remove(); onClose(); });
  return dialog;
}
