---
name: study
description: AceStudy CS 학습 세션. 내게 배정된 다음 토픽을 10~20분 학습하고, 노트와 시각화를 만들고, DB에 쌓인 노트를 보고 선행/후속 그래프 링크를 매핑한 뒤 PR을 올린다. "공부하자", "학습 시작", "study", "다음 토픽" 같은 요청에 사용.
---

# study — AceStudy 학습 세션

Claude Code(`/study`)와 Codex(`$study`)가 함께 쓰는 스킬이다. 전체 규칙은 저장소 루트의 `AGENTS.md` 를 따른다.

## 1. 준비
```bash
gh api user -q .login                 # 내 GitHub 아이디
git switch main && git pull
npm install                           # 처음 한 번
npm run context -- <아이디>            # next / studiedNotes / allTopics
```
- `expand.recommended` 가 true 이면 사용자에게 알리고 `expand` 스킬로 토픽 확장을 먼저 할지 묻는다.
  `next` 가 null 이면 배정된 토픽을 다 끝낸 것이다 → `expand` 스킬로 이어간다.
- 다른 사람에게 배정된 토픽은 학습하지 않는다.
```bash
git switch -c study/<topic-id>
```

## 2. 학습 (10~20분)
- 토픽 제목과 `hook`(백엔드 관점)을 보여주고 시작한다.
- 진행: 개념 설명 → 사용자에게 질문 → 예제나 실험(코드, 명령어) → 실무 사례.
- 범위를 넓히지 않는다. 다른 토픽이 필요하면 설명하지 말고 이름만 짚어서 링크 후보로 메모한다.
- 끝에 확인 질문 2~3개를 내고 사용자의 답을 듣는다.

## 3. 노트 — `notes/<category>/<topic-id>.md`
- 형식: `curriculum/note-template.md`
- 사용자가 실제로 이해한 내용과 말투를 반영한다. 교과서를 복붙하지 않는다.
- `sources` 에 근거를 남긴다.
- 학습 중 나왔지만 토픽 풀(`allTopics`)에 없고, 따로 10~20분 다룰 가치가 있는 개념은 `suggest` 에 남긴다.
  (title, category, why). 이 제안이 쌓여 토픽 풀이 확장된다.

## 4. 시각화 — `notes/<category>/<topic-id>.viz.html` (필수)
- `curriculum/viz-template.html` 을 복사해서 시작한다. 단일 HTML, 300KB 이하.
- 이 토픽의 **핵심 동작 과정**을 단계(step) 애니메이션으로 보여준다.
  - 예: TCP 핸드셰이크 패킷 흐름, B+Tree 노드 분할, 페이지 교체, 락 대기 그래프
- 사용자의 이해를 기준으로 만든다. 사용자에게 "어떤 장면이 제일 헷갈렸는지" 묻고 그 장면을 넣는다.
- 확인: `npm run dev` 로 로컬 페이지(http://localhost:8787)에서 해당 토픽을 열어본다. PR을 올리면 Vercel 미리보기 URL로도 확인할 수 있다.

## 5. 그래프 매핑 (PR 전 필수)
`context` 출력의 `studiedNotes`(DB에 쌓인 노트)와 `allTopics` 를 근거로 frontmatter를 채운다.
- `prerequisites`: 이 토픽을 이해하려면 먼저 알아야 하는 토픽
- `leads_to`: 이 지식이 쓰이거나 심화되는 토픽
- `related`: 방향 없이 연관된 토픽
- 아직 학습 안 된 토픽에도 링크한다. 그래프를 미리 깔아두는 것이다.
- 기존 노트 링크와 순환·모순이 없는지 확인한다.
- 본문 "연결" 섹션에 `[[topic-id]] — 이유` 를 한 줄씩 쓴다.
- 링크 목록과 근거를 사용자에게 보여주고 확정한다.

## 6. PR
```bash
npm run check
git add notes/<category>/<topic-id>.*
git commit -m "study(<topic-id>): <한 줄 요약>"
git push -u origin study/<topic-id>
gh pr create --base main --title "study(<topic-id>): <제목>" --body "<요약 + 추가한 링크와 근거>"
```
