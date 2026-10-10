---
topic: os.thread
title: 스레드와 스레드 모델
author: jihwankim128
date: 2026-10-10
prerequisites:
  - os.process           # 스레드는 프로세스 주소 공간 안에서 산다
  - arch.cpu-execution   # PC·레지스터가 "실행 흐름"의 실체
leads_to:
  - os.context-switch    # 스레드를 늘릴 때 붙는 비용
  - os.sync-primitive    # 힙을 공유하니까 동기화가 필요
  - os.race-atomic       # 공유 데이터에 동시 접근 → 경쟁 상태
  - os.scheduling        # Ready/Running/Blocked 상태를 누가 어떻게 옮기나
  - os.io-model          # 블로킹 I/O가 스레드를 묶어둔다 → 논블로킹/이벤트 루프
  - net.timeout-retry    # 풀 대기가 길어지면 타임아웃이 먼저 터진다
related:
  - os.syscall           # 블로킹 시스템 콜이 Blocked 상태로 가는 입구
  - arch.interrupt-dma   # I/O 완료 인터럽트가 대기 스레드를 깨운다
sources:
  - https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf
  - https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Thread.State.html
  - https://docs.spring.io/spring-boot/appendix/application-properties/index.html#application-properties.server.server.tomcat.threads.max
  - https://github.com/brettwooldridge/HikariCP#gear-configuration-knobs-baby
  - https://en.wikipedia.org/wiki/Little%27s_law
  - Brian Goetz, Java Concurrency in Practice, 8.2 Sizing thread pools
quiz:
  - q: 스레드끼리 공유하지 않는 것 두 가지와, 따로 있어야 하는 이유는?
    a: 스택(지역 변수·호출 기록)과 레지스터(PC, SP). 스레드는 독립적으로 멈췄다 이어서 실행되는 흐름이라 "어디까지 실행했나(PC)"와 "어떻게 여기까지 왔나(스택)"를 각자 가져야 한다. 나머지 주소 공간(코드·데이터·힙·열린 파일)은 공유한다.
    level: basic
  - q: 코어 8개, 요청당 CPU 10ms + DB 대기 90ms. CPU를 놀리지 않으려면 스레드가 몇 개 필요한가?
    a: 코어 × (1 + 대기/계산) = 8 × (1 + 90/10) = 80개. 코어 1개는 한 스레드가 기다리는 90ms를 다른 9개가 10ms씩 채우므로 10개가 필요하다.
    level: basic
  - q: CPU 사용률이 20%인데 톰캣 스레드가 전부 busy다. 원인 후보 두 개와 확인 방법은?
    a: 스레드가 대기 상태다. (1) DB 커넥션 풀 대기 — 스레드 덤프 스택 맨 위에 HikariPool.getConnection, hikaricp.connections.pending > 0. (2) 외부 API·소켓 I/O 대기 — 스레드 덤프에 SocketInputStream.read (JVM에선 RUNNABLE로 찍히니 주의).
    level: basic
  - q: '"트래픽이 늘었으니 threads.max를 200에서 1,000으로 올리자"는 제안에 어떻게 답하나?'
    a: 먼저 피크 시 busy 스레드, CPU 사용률, 커넥션 풀 pending을 본다. CPU가 높으면 반대(스위칭만 늘어남 → 스케일 아웃·최적화). CPU가 낮고 풀 pending이 많으면 반대(DB 병목 → 풀·쿼리 개선). CPU가 낮고 뒷단도 여유 있을 때만 찬성하되, 1,000이 아니라 코어×(1+W/C)로 상한을 잡고 부하 테스트로 확정한다.
    level: interview
suggest:
  - title: 가상 스레드(Virtual Thread)
    category: os
    why: 블로킹 대기 비용을 플랫폼 스레드에서 떼어내 "스레드 수 = 동시 요청 수" 공식을 바꾼다. JDK 21+ 스프링 부트에서 실무 선택지
  - title: 커넥션 풀 크기 산정 (HikariCP)
    category: db
    why: 금요일 저녁의 진짜 병목. 풀을 키우는 게 답인지, DB 쪽 한계는 어떻게 재는지 별도 학습 필요
  - title: 벌크헤드 패턴과 스레드 풀 격리
    category: dist
    category_name: 분산 시스템
    why: 느린 외부 API 하나가 톰캣 스레드를 전부 잡아먹어 빠른 API까지 죽는 장애를 막는 방법
  - title: 리틀의 법칙과 용량 산정
    category: perf
    category_name: 성능 엔지니어링
    why: 요청이 섞인 트래픽에서 가중 평균으로 필요한 동시 처리량과 코어 수를 계산하는 법. 스레드뿐 아니라 풀·큐·서버 대수 산정의 공통 도구
---

## 한 줄 요약

스레드는 **실행 흐름(스택+레지스터)만 따로 갖고 주소 공간은 공유**한다. 그래서 가볍고, 그래서 동기화가 필요하다.
스레드 풀 크기는 감이 아니라 **`코어 × (1 + 대기/계산)`으로 출발점을 잡고, 뒷단 용량과 부하 테스트로 확정**한다.

## 핵심 개념

### 1. 공유 vs 독립
| 공유 (주소 공간) | 독립 (실행 흐름) |
|---|---|
| 코드, 데이터(static), **힙**, 열린 파일·소켓 | **스택**(지역 변수, 호출 기록), **레지스터**(PC, SP), 스레드 ID, ThreadLocal |

- 독립적으로 멈췄다가 이어서 실행하려면 "어디까지 실행했나(PC)"와 "어떻게 여기까지 왔나(스택)"가 각자 있어야 한다.
- ⚠️ 상호배제는 *공유된* 데이터 접근을 막는 **규칙**이지, 스레드가 따로 갖는 영역이 아니다. → [[os.sync-primitive]]

### 2. 스레드 상태
```
 Ready ──(스케줄러 선택)──▶ Running
   ▲                          │ 블로킹 시스템 콜 (read, 락, 풀 대기)
   └──(I/O 완료 인터럽트)── Blocked/Waiting
```
- 순서가 중요하다: **시스템 콜로 대기에 들어가고, 인터럽트로 깨어난다.** → [[os.syscall]], [[arch.interrupt-dma]]
- "busy인데 CPU가 놀고 있다" = 스레드들이 Blocked 상태라는 뜻이다.

### 3. 필요한 스레드 수
- **CPU만 쓰는 작업**: 코어 수 (또는 코어 + 1). 더 늘리면 컨텍스트 스위칭만 증가한다.
- **대기가 섞인 작업**: `코어 × (1 + 대기/계산)`
  - 코어 1개, CPU 10ms + 대기 90ms → 한 스레드가 기다리는 90ms를 다른 9개가 채움 → **10개**
  - 코어 8개 → **80개**
- **리틀의 법칙**: `동시 처리 수 = 처리량 × 응답 시간`
  - 스레드 200개 × (1s / 100ms) = 초당 2,000건
  - 요청 종류가 섞여 있어도 **트래픽 비율로 가중 평균**을 내면 그대로 성립한다.

## 백엔드에서는

**금요일 저녁 장애**: 톰캣 스레드 200개 전부 busy, p99 120ms → 4초, CPU 25%.
- 병목은 스레드가 아니라 **DB 커넥션 풀(10개)** 이었다. 쿼리당 50ms 점유 → 10 ÷ 0.05s = **초당 200건이 상한**이다.
- 스레드를 2,000개로 늘리면 처리량은 그대로고 풀 앞의 줄만 길어진다.
  - HikariCP `connectionTimeout` 기본 30초를 넘기면 예외가 난다. 클라이언트 타임아웃이 먼저 끊으면 서버 스레드는 그것도 모르고 계속 대기한다. → [[net.timeout-retry]]
  - 스레드마다 스택을 1MB(`-Xss` 기본값)씩 예약하고, 컨텍스트 스위칭 비용도 늘어난다. → [[os.context-switch]]
- 처방은 **뒷단 개선**이다. 풀 크기를 조정하고 쿼리 점유 시간을 줄인다(50ms → 10ms면 초당 1,000건).

**스레드 풀 크기를 정하는 순서**
1. 운영 지표를 본다: `tomcat.threads.busy`, CPU, `hikaricp.connections.pending`
2. 공식으로 출발점을 잡는다: 스레드 수 = min(CPU 공식, 뒷단 처리 용량)
3. 실제 트래픽 비율로 부하 테스트를 해서, 처리량이 멈추고 지연만 치솟는 지점 직전으로 확정한다.
4. 성격이 다른 작업(느린 외부 API)은 별도 풀로 격리한다(벌크헤드).

**스레드 증설이 답인 경우는 하나뿐이다: CPU가 놀고, 뒷단도 여유가 있을 때.**

## 실험

```bash
# 부하를 주면서 스레드 상태 분포 보기
jcmd $(pgrep -f spring) Thread.print | grep "java.lang.Thread.State" | sort | uniq -c
```
- 소켓 블로킹 I/O 대기 중인 스레드는 JVM에서 `RUNNABLE`로 찍힌다. `RUNNABLE`이 많다고 CPU를 쓰는 중이라고 단정하지 말 것.
- 스택 맨 위가 `HikariPool.getConnection`이면 풀 대기, `SocketInputStream.read`면 외부 응답 대기다.

## 연결
- 선행: [[os.process]] — 스레드는 프로세스 주소 공간 안의 실행 흐름이다
- 선행: [[arch.cpu-execution]] — PC와 레지스터가 "어디까지 실행했나"의 실체다
- 후속: [[os.context-switch]] — 스레드를 늘리면 붙는 비용, 1~10µs 수준
- 후속: [[os.sync-primitive]] — 힙을 공유하니까 접근 순서를 통제해야 한다
- 후속: [[os.race-atomic]] — 동기화가 없으면 재고가 음수가 된다
- 후속: [[os.scheduling]] — Ready → Running을 결정하는 쪽
- 후속: [[os.io-model]] — 블로킹 I/O가 스레드를 묶어두는 문제의 대안(논블로킹, 이벤트 루프)
- 후속: [[net.timeout-retry]] — 풀 대기가 길어지면 타임아웃이 먼저 터진다
- 관련: [[os.syscall]] — 블로킹 시스템 콜이 대기 상태로 들어가는 입구
- 관련: [[arch.interrupt-dma]] — I/O 완료 인터럽트가 대기 스레드를 깨운다

## 자주 하는 실수
- "스레드가 따로 갖는 것 = 상호배제된 영역" ✗ → 따로 갖는 건 스택과 레지스터, 상호배제는 공유 데이터 접근 규칙이다
- "I/O 때문에 인터럽트가 나서 대기한다" ✗ → 시스템 콜로 대기에 들어가고, 인터럽트로 깨어난다
- "CPU가 높으면 스레드를 늘린다" ✗ → CPU가 꽉 찼으면 스레드 증설은 역효과다
- 컨텍스트 스위칭을 ms 단위로 생각하기 ✗ → µs 단위다. 문제가 되는 건 스레드가 수천 개일 때다
