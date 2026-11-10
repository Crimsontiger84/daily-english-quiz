import { h } from "./dom.js";

// 복습 노트: 틀린 문항 목록. "다시 풀기"로 전부 다시 풀 수 있고, 맞히거나 "외웠어요"를 누르면 노트에서 빠진다.
export function ReviewNote({ items, scheduled, onRemove, onBack, onRetry }) {
  const list = items.length
    ? h("ul", { class: "review" }, items.map((r) =>
        h("li", { class: "review__item" },
          h("p", { class: "review__meta" }, `${r.label} · ${r.date}`),
          h("p", { class: "review__prompt" }, r.prompt),
          h("p", { class: "review__answer" }, r.answer),
          r.note && h("p", { class: "review__note" }, r.note),
          h("p", { class: "review__yours" }, `내 답: ${r.your}`),
          h("button", { class: "btn btn--ghost btn--small", type: "button", onclick: () => onRemove(r.id) }, "외웠어요")
        )))
    : h("p", { class: "empty" }, "복습할 문항이 없어요. 틀린 문제가 생기면 여기에 모입니다.");

  return h("section", { class: "view" },
    h("header", { class: "view__head" },
      h("button", { class: "btn btn--ghost btn--small", type: "button", onclick: onBack }, "← 홈"),
      h("h2", {}, "복습 노트"),
      h("span", { class: "view__count" }, `${items.length}개`)
    ),
    h("p", { class: "view__lead" }, `틀린 표현은 1 → 3 → 7 → 14일 간격으로 오늘의 퀴즈에 다시 나옵니다. 현재 예약 ${scheduled}개.`),
    items.length ? h("button", { class: "btn btn--primary btn--big", type: "button", onclick: onRetry }, `지금 다시 풀기 (${items.length}문항)`) : null,
    list
  );
}
