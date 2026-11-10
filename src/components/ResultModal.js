import { h } from "./dom.js";

function message(score, total) {
  const r = score / total;
  if (r === 1) return "완벽해요!";
  if (r >= 0.8) return "거의 다 왔어요";
  if (r >= 0.5) return "절반 넘었어요";
  return "틀린 문제는 내일 다시 나와요";
}

const prompt = (q) => (q.type === "write" ? q.ko : [q.ask, q.text, q.ko && `(${q.ko})`].filter(Boolean).join(" "));
const answer = (q) => q.model ?? q.full;

// 채점 결과를 노션에 붙여 넣을 수 있는 마크다운으로 만든다. 틀린 문제를 먼저, 자세히 적는다.
export function resultMarkdown(day) {
  const rows = day.questions.map((q, i) => ({ q, a: day.answers[i] }));
  const score = rows.filter((r) => r.a.correct).length;
  const item = ({ q, a }, detail) => [
    `- **[${q.label}]** ${prompt(q)}`,
    `    - 정답: ${answer(q)}`,
    detail && `    - 내 답: ${a.your}`,
    detail && q.explain && `    - 설명: ${q.explain}`,
  ].filter(Boolean).join("\n");
  const wrong = rows.filter((r) => !r.a.correct);
  const right = rows.filter((r) => r.a.correct);
  return [
    `## ${day.date} · ${score} / ${rows.length}`,
    `### ✗ 틀린 문제 (${wrong.length})`,
    wrong.length ? wrong.map((r) => item(r, true)).join("\n") : "- 없음",
    `### ○ 맞은 문제 (${right.length})`,
    right.length ? right.map((r) => item(r, false)).join("\n") : "- 없음",
  ].join("\n");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 클립보드 권한이 없는 브라우저용 대체 방법
    const ta = h("textarea", { value: text, style: "position:fixed;opacity:0" });
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

// 오늘 결과 모달(<dialog>). 문항별 채점(○/×, 정답, 틀린 문항은 내 답과 설명)을 보여 준다.
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
        h("span", { class: "result__answer" }, answer(q)),
        !a.correct && h("span", { class: "result__yours" }, `내 답: ${a.your}`),
        !a.correct && q.explain && h("span", { class: "result__note" }, q.explain)
      )
    );
  });

  const copyBtn = h("button", {
    class: "btn btn--ghost", type: "button",
    onclick: async () => {
      const ok = await copyText(resultMarkdown(day));
      copyBtn.textContent = ok ? "복사했어요 — 노션에 붙여 넣으세요" : "복사하지 못했어요";
    },
  }, "채점 결과 복사 (노션 기록용)");

  dialog.append(
    h("p", { class: "modal__eyebrow" }, day.date),
    h("h2", { id: "result-title", class: "modal__score" }, `${score}`, h("small", {}, ` / ${total}`)),
    h("p", { class: "modal__msg" }, `${message(score, total)}${streak > 1 ? ` · ${streak}일 연속` : ""}`),
    h("ul", { class: "result" }, rows),
    h("div", { class: "modal__actions" },
      score < total && h("button", { class: "btn btn--primary", type: "button", onclick: () => { dialog.close(); onReview(); } }, "복습 노트 보기"),
      copyBtn,
      h("button", { class: `btn ${score < total ? "btn--ghost" : "btn--primary"}`, type: "button", onclick: () => dialog.close() }, "닫기")
    )
  );
  dialog.addEventListener("close", () => { dialog.remove(); onClose(); });
  return dialog;
}
