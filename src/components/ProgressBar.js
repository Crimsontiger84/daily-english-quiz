import { h } from "./dom.js";

// 6칸 진행 막대. results[i]: true(정답) / false(오답) / undefined(미응답)
export function ProgressBar({ total, current, results }) {
  return h(
    "div",
    { class: "progress", role: "progressbar", "aria-valuemin": 1, "aria-valuemax": total, "aria-valuenow": current + 1, "aria-label": `${total}문항 중 ${current + 1}번째` },
    Array.from({ length: total }, (_, i) => {
      const state = results[i] === true ? "ok" : results[i] === false ? "no" : i === current ? "now" : "";
      return h("span", { class: `progress__seg ${state}` });
    })
  );
}
