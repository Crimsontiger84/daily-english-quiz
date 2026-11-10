import { h } from "./dom.js";

// 복습 노트: 틀린 문항 목록. "외웠어요"를 누르면 노트에서 지운다.
export function ReviewNote({ items, onRemove, onBack }) {
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
    list
  );
}
