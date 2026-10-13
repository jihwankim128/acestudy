---
topic: os.process
title: 프로세스와 메모리 레이아웃
author: simhokyung
date: 2026-10-13
prerequisites: []
leads_to:
  - os.thread
  - os.virtual-memory
  - os.container
  - perf.allocation-gc
  - practice.export-memory-spike
related: []
sources:
  - https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-intro.pdf
  - https://pages.cs.wisc.edu/~remzi/OSTEP/vm-intro.pdf
  - https://docs.oracle.com/javase/specs/jvms/se21/html/jvms-2.html
  - https://docs.oracle.com/javase/specs/jls/se21/html/jls-12.html#jls-12.6.1
  - https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html
  - https://docs.oracle.com/en/java/javase/25/troubleshoot/diagnostic-tools.html#native-memory-tracking
quiz:
  - q: 메서드에서 만든 배열을 호출자에게 반환했다. 호출이 끝나면 스택 프레임과 배열은 각각 어떻게 되나?
    a: 메서드 호출이 끝나면 해당 스택 프레임은 제거된다. GC 실행을 기다리는 것이 아니다. 배열은 힙에 있으며, 호출자의 result 같은 참조를 통해 계속 사용한다면 살아 있다. 반환되는 것은 배열을 가리키는 참조값이다.
    level: basic
  - q: cache.add(data); data = null;을 실행했다. 배열을 GC 회수 대상으로 만들려면 무엇이 필요하고, 회수는 즉시 보장되나?
    a: data의 참조만 끊어도 cache의 리스트 원소가 같은 배열을 참조하므로 배열은 살아 있다. cache.clear() 등으로 리스트의 참조를 제거하고 다른 접근 경로도 없어야 회수 대상이 된다. 실제 회수 시점은 GC가 결정하며 즉시 회수는 보장되지 않는다.
    level: basic
  - q: 메모리 한도가 1 GiB인 컨테이너에서 Java 서버를 -Xmx1g로 실행하려고 한다. 이 설정을 어떻게 검토하겠나?
    a: -Xmx는 Java 힙의 상한이다. 힙이 상한까지 커지면 스택, 클래스 정보, 실행 코드, GC 관리용 메모리 등에 필요한 여유가 부족할 수 있다. 부하를 걸어 힙 지표, 프로세스 RSS, 컨테이너의 실제 사용량과 한도를 확인하고 힙 외의 사용량과 여유를 고려해 -Xmx를 더 낮게 정한다. NMT는 HotSpot 내부 항목을 살피는 보조 자료이며 RSS나 컨테이너 사용량과 동일한 지표는 아니다.
    level: interview
suggest:
  - title: JVM 네이티브 메모리와 NMT 진단
    category: perf
    why: 힙 사용량이 안정적인데 프로세스 RSS가 증가하는 상황을 재현하고, NMT의 항목별 변화와 운영체제 지표를 비교해 원인을 좁히는 별도 실험이 필요하다.
---

## 한 줄 요약

**호출이 끝나면 스택 프레임은 제거된다. 힙의 배열은 살아 있는 참조가 사용하면 남는다. `-Xmx`는 그 힙의 상한이며 프로세스 전체 메모리의 상한은 아니다.**

## 핵심 개념

### 1. 프로그램 하나를 두 번 실행하면 프로세스는 둘

학습자의 첫 설명은 “프로그램은 하나고 프로세스는 두 개일 것 같다. 실행을 두 번 시키니까”였다. 이 구분은 맞다.

`server.jar`는 실행할 프로그램의 파일이다. 두 번 실행하면 운영체제가 관리하는 실행 인스턴스인 프로세스가 두 개 생긴다. 각 프로세스는 자신의 주소 공간과 실행 상태를 가진다. 실행 상태에는 실행 중인 코드의 위치와 레지스터 등의 정보도 포함된다.

주소 공간은 **실행 중인 프로그램이 바라보는 메모리**다. 교과서의 코드·데이터·힙·스택 그림은 역할을 이해하기 위한 모형이다. 실제 배치와 구현은 운영체제와 런타임에 따라 달라진다.

### 2. 스택에는 호출 기록, 힙에는 배열 자체

JVM의 논리적인 메모리 모델로 살펴본다.

| 대상 | 역할 |
|---|---|
| Java 스택의 프레임 | 호출마다 생기는 기록. 지역 변수, 객체 참조, 계산 중인 값 등을 담는다. |
| Java 힙 | 클래스 인스턴스와 배열을 담는다. 여러 스레드가 같은 힙을 사용한다. |
| HotSpot의 클래스 정보·실행 코드·내부 관리 영역 | Metaspace, 컴파일된 코드, GC 관리 데이터 등에도 메모리가 필요하다. |

스택 프레임은 메서드 호출이 완료되면 제거된다. 그 제거를 위해 GC 실행을 기다리는 것은 아니다. JVM 명세는 논리적인 동작을 규정하며, 최적화 이후의 물리적 저장 방식까지 고정하지 않는다.

```java
static byte[] makeData() {
    byte[] data = new byte[1024];
    data[0] = 7;
    return data;
}

byte[] result = makeData();
System.out.println(result[0]);
```

`data`와 배열 자체를 구분한다. `data`에는 배열을 가리키는 참조값이 있고, 배열 자체는 힙에 있다. 반환할 때 참조값이 호출자에게 전달된다. `makeData()`의 프레임이 제거되어도 호출자의 `result`를 통해 배열을 사용할 수 있다.

가장 헷갈렸던 장면으로 **스택 프레임은 사라져도 배열은 남는 장면**을 선택했다. 마지막 확인에서 다음처럼 정리했다.

> makeData의 스택 프레임은 바로 제거되고 배열은 힙 메모리에 남아 있게 된다. result가 makeData에서 만든 배열을 참조한다.

### 3. `data = null`은 그 변수의 참조를 끊는다

```java
static List<byte[]> cache = new ArrayList<>();

static void handleRequest() {
    byte[] data = new byte[1024 * 1024]; // 배열 데이터 1 MiB
    cache.add(data);
    data = null;
}
```

`cache.add(data)`는 같은 배열을 가리키는 참조를 리스트에 저장한다. 지역 변수 `data`를 `null`로 바꿔도 다음 경로가 남는다.

```text
서버가 계속 사용하는 static cache → ArrayList의 원소 → byte[]
```

요청 처리가 끝나 프레임이 제거되어도 리스트를 통해 배열에 도달할 수 있다. 이 예시에서 요청 1,000개의 배열 데이터만 합쳐도 **1,000 MiB ≈ 0.98 GiB**다. 객체와 리스트 자체의 부가 공간도 필요하다.

처음에는 “모든 처리가 끝나면 GC가 배열을 지운다”, “data를 null로 만들면 회수한다”고 생각했다. 수정한 기준은 **호출 종료나 특정 변수의 null 여부가 아니라, 객체에 도달할 수 있는 접근 경로가 남아 있는가**이다.

`cache.clear()`로 리스트의 참조를 제거하고 다른 참조도 없다면 배열은 회수 대상이 된다. 실제 회수 시점은 GC가 결정하며, 즉시 회수나 일정 시간 뒤의 회수는 보장되지 않는다. GC 알고리즘과 지연 시간은 [[perf.allocation-gc]]에서 이어간다.

## 백엔드에서는

### 작은 힙에서도 누적 생성량은 더 클 수 있다

동봉한 `os.process.demo.java`는 최대 64회의 요청만 실행하는 실험이다. 요청마다 1 MiB 배열을 만들고 `data = null`을 실행한다. `keep`은 리스트에 계속 보관하고, `clear`는 요청마다 리스트의 참조를 제거한다.

```bash
javac -d /tmp/acestudy-process-demo notes/os/os.process.demo.java
java -Xmx32m -cp /tmp/acestudy-process-demo MemoryLayoutDemo keep
java -Xmx32m -cp /tmp/acestudy-process-demo MemoryLayoutDemo clear
```

macOS arm64, Microsoft OpenJDK 25.0.4 HotSpot에서 측정했다.

```text
mode=keep heapMaxMiB=32 completed=15 retainedArrays=15 outcome=OutOfMemoryError
mode=clear heapMaxMiB=32 completed=64 retainedArrays=0 outcome=completed
```

실패하는 정확한 개수는 JVM과 GC 설정 등에 따라 달라진다. 배열 데이터의 크기 외에 부가 공간과 할당 방식도 영향을 준다. 이 숫자를 용량 산정 공식으로 외우지 않는다.

`clear`에서는 접근 경로가 사라진 배열의 공간을 GC가 회수해 다음 배열에 재사용할 수 있었다. **누적 생성량 64 MiB와 한 시점의 힙 용량 32 MiB는 다른 양**이다. 학습자도 “배열을 하나 만들고 캐시를 비워서 GC가 처리하기 때문”이라고 설명했다. 다만 캐시를 비운 직후마다 GC가 반드시 실행되었다는 뜻은 아니다.

이 실험의 `OutOfMemoryError` 처리는 실패 시점의 결과를 출력하기 위한 장치다. 서버의 장애 복구 정책으로 사용하는 예시는 아니다.

### 힙 상한과 프로세스 전체 메모리를 함께 본다

```bash
java -Xmx32m -XX:NativeMemoryTracking=summary \
  -cp /tmp/acestudy-process-demo MemoryLayoutDemo memory
```

이 모드는 16 MiB 배열을 보관하고, 자기 프로세스에 `ps`와 `jcmd`를 실행한 뒤 종료한다. 재실행 시 PID와 측정값은 달라진다.

| 항목 | 이번 측정 |
|---|---:|
| Java 힙 최대 크기 | 32 MiB |
| 보관한 배열 데이터 | 16 MiB |
| `ps`의 RSS | 60,160 KiB = **58.75 MiB** |

RSS는 프로세스의 메모리 중 현재 물리 메모리에 상주하는 양이다. 이 기기의 macOS `man ps`에서 `rss`의 단위가 1024바이트임을 확인했다. `jcmd`의 NMT 출력에서도 Java Heap 외에 Thread, Code, GC, Metaspace 등의 항목을 확인했다. **NMT의 reserved·committed와 RSS는 같은 지표가 아니므로 서로 그대로 더하거나 대체하지 않는다.** NMT가 JVM 밖의 모든 네이티브 할당을 추적하는 것도 아니다.

```bash
ps -o pid,rss,vsz -p <pid>
jcmd <pid> VM.native_memory summary scale=MB
```

학습자는 “힙 메모리만 32이고 스택 같은 것을 포함하면 전체는 더 클 것 같다”고 설명했다. 실제 측정과 일치했다.

메모리 한도가 1 GiB인 컨테이너에서 `-Xmx1g`를 설정하면, 힙이 상한까지 증가할 때 힙 외의 영역에 필요한 여유가 부족할 수 있다. **대표 부하에서 힙, 프로세스 RSS, 컨테이너의 실제 사용량을 관측하고 힙 외의 사용량과 여유를 포함해 예산을 잡는다.** 일정 비율을 모든 서버에 그대로 적용하지 않는다.

## 연결

- 후속: [[os.thread]] — 프로세스의 주소 공간 안에서 스레드가 힙을 공유하고 각자 호출 스택을 갖는 구조로 이어진다. 기존 스레드 노트가 `os.process`를 선행으로 지정한 방향과 같다.
- 후속: [[os.virtual-memory]] — 프로세스의 주소 공간과 실제 물리 메모리 사용량을 구분한 다음 RSS·VSZ와 페이징을 자세히 이해한다.
- 후속: [[os.container]] — 힙 상한 외의 메모리까지 고려한 프로세스의 자원 예산을 컨테이너의 한도와 연결한다.
- 후속: [[perf.allocation-gc]] — 객체의 도달 가능성과 누적 할당량을 이해한 뒤 할당 속도와 GC 지연의 영향을 실험한다.
- 후속: [[practice.export-memory-spike]] — 내보내기 작업에서 결과 배열·목록을 계속 참조하면 데이터가 힙에 남는다는 원리로 메모리 급증을 진단한다.

## 확인 질문

frontmatter의 퀴즈 3개를 사용한다. 첫 퀴즈에서는 스택 프레임의 제거와 배열의 GC 회수를 혼동했으며, 호출자가 반환된 배열을 참조하는 장면으로 다시 확인했다. 재답변에서는 **프레임 제거, 힙의 배열 유지, 호출자 `result`의 참조**를 정확히 구분했다. 캐시의 참조 제거 조건과 컨테이너의 전체 메모리 예산도 설명했다.
