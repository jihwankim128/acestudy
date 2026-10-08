---
topic: os.page-cache              # curriculum/topics.yaml 의 id (파일명과 동일)
title: 페이지 캐시와 fsync
author: your-github-id            # 배정된 담당자
date: 2026-10-08
# ── 그래프 링크: PR 전에 DB에 쌓인 노트를 보고 채운다 (아직 학습 안 된 토픽도 OK) ──
prerequisites:                    # 이 토픽을 이해하려면 먼저 알아야 하는 토픽
  - os.virtual-memory
  - arch.storage-device
leads_to:                         # 이 지식이 쓰이는/심화되는 토픽
  - db.wal-recovery
related: []                       # 방향 없이 연관된 토픽
sources:
  - https://example.com
# ── 퀴즈 (2개 이상): 세션 끝 확인 질문. 페이지에서 복습 카드가 된다 ──
quiz:
  - q: 페이지 캐시에 쓴 데이터는 언제 디스크에 반영되나?
    a: dirty page 로 남아 있다가 커널 flush(writeback) 시점이나 fsync 호출 시 반영된다.
    level: basic
  - q: Kafka 가 fsync 를 매번 하지 않는데도 데이터 유실을 막는 방법은?
    a: 복제(acks=all, min.insync.replicas)로 여러 브로커의 페이지 캐시에 둔다. 단일 노드 내구성 대신 복제로 내구성을 얻는다.
    level: interview
# ── 토픽 제안 (1개 이상, 필수): 학습 중 나왔지만 토픽 풀에 없고 따로 10~20분 다룰 가치가 있는 개념 ──
suggest:
  - title: io_uring
    category: os
    why: epoll 이후의 비동기 I/O 모델. 페이지 캐시 우회(O_DIRECT)와 함께 볼 가치
  - title: 분산 합의(Raft)
    category: dist                # 기존에 없는 카테고리면
    category_name: 분산 시스템      # 이름도 함께
    why: 복제된 로그의 일관성 문제. WAL 이 여러 노드로 가면 필요해짐
---

## 한 줄 요약

## 핵심 개념

## 백엔드에서는
<!-- topics.yaml 의 hook 에서 출발. 실제 장애/설계 사례 -->

## 연결
<!-- 본문에서 다른 토픽은 [[topic-id]] 로 링크 (옵시디언 그래프에 그대로 보인다) -->
- 선행: [[os.virtual-memory]] — 왜 필요한지 한 줄
- 후속: [[db.wal-recovery]] — 어떻게 이어지는지 한 줄

## 확인 질문
