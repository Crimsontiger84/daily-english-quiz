// 채점 결과를 사용자의 구글 시트(Apps Script 웹 앱)로 보낸다.
// 연동 주소와 키는 공개 코드에 넣지 않고, 사용자가 기기에 한 번 입력한 값을 localStorage에서 읽는다.

// 붙여 넣은 연동 링크(https://script.google.com/macros/s/…/exec?key=…)를 주소와 키로 나눈다.
export function parseLink(text) {
  try {
    const u = new URL(String(text).trim());
    const key = u.searchParams.get("key");
    // 기록이 다른 곳으로 새지 않도록 구글 Apps Script 주소만 받는다.
    if (u.protocol !== "https:" || u.hostname !== "script.google.com" || !u.pathname.endsWith("/exec") || !key) return null;
    return { url: u.origin + u.pathname, key };
  } catch {
    return null;
  }
}

// 반환: "saved"(저장 확인) | "sent"(보냈지만 응답을 읽지 못함). 실패하면 예외.
export async function send(cfg, payload) {
  const init = {
    method: "POST",
    // text/plain이면 브라우저가 사전 요청(preflight) 없이 보낸다. Apps Script는 본문을 그대로 받는다.
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...payload, key: cfg.key }),
  };
  let res;
  try {
    res = await fetch(cfg.url, init);
  } catch {
    // 응답을 읽을 수 없는 환경이면 보내기만 한다. 스크립트가 기록 ID로 중복을 걸러 준다.
    await fetch(cfg.url, { ...init, mode: "no-cors" });
    return "sent";
  }
  const data = await res.json();
  if (!data.ok) throw new Error(data.error === "key" ? "연동 키가 맞지 않아요" : (data.error || "저장 실패"));
  return "saved";
}

export async function test(cfg) {
  const res = await fetch(`${cfg.url}?key=${encodeURIComponent(cfg.key)}`);
  const data = await res.json();
  return data.ok === true;
}
