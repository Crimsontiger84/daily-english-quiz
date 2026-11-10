# Quiz Flow — 구현 기준 문서

Claude Code가 관리한다. 엔진(`src/engine/`)이 실제로 하는 일을 적은 문서이고, Antigravity가 UX를 설계할 때 참고하는 계약이다.

## 하루 세트 (6문항, 순서 고정)

| # | 파트 | 유형 `type` | 채점 |
|---|---|---|---|
| 1 | 다이어리 | `cloze` 빈칸 채우기 — 최근 일기 10건 중 1건 | 자동(대소문자·문장부호 무시, 그 외 완전 일치) |
| 2 | 다이어리 | `cloze` 빈칸 채우기 — 전체 중 1건 | 자동 |
| 3 | 다이어리 | `write` 한국어 뜻을 보고 영작(패러프레이징) | 모범 답안 공개 후 자기 판정, 단어 일치율(%) 참고 표시 |
| 4 | 구동사 | `choice` 전치사 4지선다 | 자동 |
| 5 | 구동사 | `choice` 전치사 4지선다 | 자동 |
| 6 | 구동사 | `write` 상황 회화 영작 | 자기 판정 |

- 세트는 날짜(기기 현지 날짜)를 시드로 만들어 `localStorage`에 저장한다. 같은 날에는 새로고침해도 같은 문제다.
- 최근 7일에 나온 항목은 가능한 한 피한다.
- 틀린 문항은 복습 노트에 쌓인다. 같은 문항은 최신 기록 하나만 남는다.

## 데이터

### `docs/data/diary.json` — Notion `[2026]English Diary`에서 추출

| 필드 | 출처 | 설명 |
|---|---|---|
| `id` | 날짜 | `YYYY-MM-DD` |
| `title` | 제목 | 일기 제목 |
| `word` | Daily word | 그날의 표현 |
| `cloze` | 예문 | 정답 부분을 `{{ }}`로 감싼 문장. 원문의 문법 오류는 교정했다. 없으면 `null` |
| `expr` | 주요표현 | 영작 모범 답안. 없으면 `null` |
| `meaning`, `clozeKo`, `exprKo` | Claude 작성 | 한국어 뜻·해석 |

### `docs/data/phrasal_verbs.json` — NotebookLM 구동사 자료

**지금은 임시 시드 36건이다.** NotebookLM 원본을 같은 스키마로 덮어쓰면 된다.

| 필드 | 설명 |
|---|---|
| `id`, `phrase`, `particle`, `meaning` | 예: `pick-up`, `pick up`, `up`, `(차로) 데리러 가다` |
| `sentence`, `sentenceKo` | 전치사 자리를 `___`로 비운 예문과 해석 |
| `situation`, `model` | 상황 영작 지시문(한국어)과 모범 답안 |

데이터를 고친 뒤에는 `python scripts/sync_notion.py --check`로 규격을 확인한다.

## 저장 키 (`localStorage`, 접두어 `deq.v1.`)

- `day.<날짜>`: 그날의 문항과 답
- `history`: 날짜별 점수(최대 60일) — 연속 학습일 계산
- `review`: 복습 노트
