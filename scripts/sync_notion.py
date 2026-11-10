"""퀴즈 데이터 점검 + Notion 동기화 기준점 출력.

Notion 조회 자체는 Claude Code 세션의 Notion MCP로만 할 수 있다(독립 스크립트에서는 MCP를 못 부른다).
그래서 동기화는 두 단계로 나뉜다.
  1) Claude Code가 MCP로 [2026]English Diary를 조회해 docs/data/diary.json에 새 항목을 추가한다.
     (뜻·한국어 해석·빈칸 표시 {{ }}는 이때 함께 작성한다.)
  2) 이 스크립트로 데이터가 퀴즈 엔진 규격에 맞는지 확인한다. 배포 워크플로도 같은 검사를 돌린다.

사용법:
  python scripts/sync_notion.py           # 요약 + 다음 동기화 기준 날짜
  python scripts/sync_notion.py --check   # 오류가 있으면 종료 코드 1
"""
import json
import re
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "docs" / "data"
CLOZE = re.compile(r"\{\{.+?\}\}")


def load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def check_diary(entries):
    errors, seen = [], set()
    for e in entries:
        eid = e.get("id", "?")
        if eid in seen:
            errors.append(f"diary {eid}: id 중복")
        seen.add(eid)
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", eid):
            errors.append(f"diary {eid}: id는 YYYY-MM-DD 형식이어야 함")
        for key in ("word", "meaning"):
            if not e.get(key):
                errors.append(f"diary {eid}: {key} 없음")
        if e.get("cloze"):
            if len(CLOZE.findall(e["cloze"])) != 1:
                errors.append(f"diary {eid}: cloze에 {{{{ }}}} 빈칸이 정확히 1개여야 함")
            if not e.get("clozeKo"):
                errors.append(f"diary {eid}: clozeKo 없음")
        if e.get("expr") and not e.get("exprKo"):
            errors.append(f"diary {eid}: exprKo 없음")
    return errors


def check_phrasals(groups):
    errors, seen = [], set()
    for g in groups:
        phrase = g.get("phrase", "?")
        if phrase in seen:
            errors.append(f"phrasal {phrase}: phrase 중복")
        seen.add(phrase)
        if not g.get("meaning"):
            errors.append(f"phrasal {phrase}: meaning 없음")
        if not g.get("examples"):
            errors.append(f"phrasal {phrase}: examples 없음")
        for ex in g.get("examples", []):
            if len(ex) != 2 or not all(ex):
                errors.append(f"phrasal {phrase}: 예문은 [영어, 한국어] 쌍이어야 함")
                continue
            blanks = CLOZE.findall(ex[0])
            if len(blanks) != 1:
                errors.append(f"phrasal {phrase}: 예문에 {{{{ }}}} 빈칸이 정확히 1개여야 함 — {ex[0]}")
            elif blanks[0].strip("{}") not in phrase:
                errors.append(f"phrasal {phrase}: 빈칸이 구동사의 전치사와 다름 — {ex[0]}")
    return errors


def main():
    diary = load("diary.json")["entries"]
    phrasals = load("phrasal_verbs.json")["groups"]
    errors = check_diary(diary) + check_phrasals(phrasals)

    cloze = sum(1 for e in diary if e.get("cloze"))
    write = sum(1 for e in diary if e.get("expr"))
    examples = sum(len(g.get("examples", [])) for g in phrasals)
    print(f"diary: {len(diary)}건 (빈칸 {cloze}, 영작 {write}) / phrasal: {len(phrasals)}개 구동사, 예문 {examples}개")
    print(f"마지막 동기화 일기: {max(e['id'] for e in diary)} — 이후 날짜를 Notion MCP로 가져오면 됨")
    for err in errors:
        print("ERROR", err)
    if errors and "--check" in sys.argv:
        sys.exit(1)
    if not errors:
        print("OK")


if __name__ == "__main__":
    main()
