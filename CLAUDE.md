# Daily English Quiz Web Application

Notion 영작 다이어리와 구동사 정리 문서(Google Docs)로 매일 오전 8시에 10문항(다이어리 6 + 구동사 4) 퀴즈를 내는 반응형 웹앱. 틀린 항목은 간격 반복으로 다시 낸다.

- 배포: https://crimsontiger84.github.io/daily-english-quiz/ (`main`에 푸시하면 자동 배포)
- 저장소: https://github.com/Crimsontiger84/daily-english-quiz

## 역할

- **Claude Code (PM·개발 리드):** Notion MCP로 다이어리 데이터 추출, 퀴즈 엔진·UI 구현, Git·배포 관리.
- **Antigravity (UX 디자이너·기획):** `docs/specs/ui_ux_spec.md`에 UX·디자인 명세 작성.
- 협업은 이 리포지토리로 한다. Antigravity가 스펙의 **변경:** 줄을 채워 커밋하면 Claude Code가 구현에 반영한다.

## 구조

```
index.html                    진입점
src/main.js                   화면 전환(홈·퀴즈·결과·복습 노트)
src/engine/                   quiz.js(세트 생성) · grade.js(채점) · store.js(localStorage)
src/components/               QuizCard · ProgressBar · ResultModal · ReviewNote
src/styles.css                디자인 토큰 + 전체 스타일
docs/data/                    diary.json · phrasal_verbs.json
docs/specs/                   ui_ux_spec.md(Antigravity) · quiz_flow.md(구현 기준)
scripts/sync_notion.py        데이터 규격 검사
.github/workflows/deploy.yml  GitHub Pages 배포
```

## 규칙

- 빌드 도구 없음(이 PC에 Node 없음). Vanilla JS ES 모듈만 쓴다.
- 로컬 실행: `python -m http.server 8765` 후 http://localhost:8765 (ES 모듈이라 파일을 직접 열면 동작하지 않는다).
- Notion 동기화: MCP로 `[2026]English Diary`(collection://2dc5d750-ba6c-80c8-8fe6-000b140a8e95)에서 `diary.json`의 마지막 날짜 이후 행을 가져와 추가한다. `cloze`의 `{{ }}`, 한국어 뜻·해석을 함께 작성하고 `python scripts/sync_notion.py --check`를 통과시킨다.
- 구동사 동기화: Google Drive 커넥터로 문서 `1HbUKGg-2UHZGsfKycQidmuzvzygQjEvJMkdakKlN0aw`를 읽어 `phrasal_verbs.json`의 `groups`를 갱신한다.
- 데이터 구조나 문항 유형을 바꾸면 `docs/specs/quiz_flow.md`를 같이 고친다.
- 보고는 간결하게: 바뀐 파일, 실행할 명령, 다음 단계 순으로.
