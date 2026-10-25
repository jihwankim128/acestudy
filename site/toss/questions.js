// 토스증권 서버 필기 대비 문제은행. 문항 id 는 제출 기록(Firestore toss_submissions.qid)의 키라서 바꾸지 않는다.
// c: 코딩, k: 주관식(단답), d: 서술형(설계), s: 서술형(개념)

export const CODING = [
{
  id: "c1", title: "지정가 주문 매칭 엔진", chips: ["우선순위 큐", "lazy deletion"], case: "주문 체결",
  body: `
<p>한 종목의 주문 명령이 시간 순서대로 주어집니다. 각 명령을 처리하며 체결 내역을 순서대로 반환하세요.</p>
<ul>
  <li><code>"B id price qty"</code>: 매수 지정가 주문, <code>"S id price qty"</code>: 매도 지정가 주문</li>
  <li><code>"C id"</code>: 아직 남은 수량이 있는 주문 <code>id</code>를 취소합니다. 이미 전부 체결된 주문이면 무시합니다.</li>
  <li>새 매수 주문은 <b>가격이 자신의 가격 이하인 매도 주문</b>과, 새 매도 주문은 <b>가격이 자신의 가격 이상인 매수 주문</b>과 체결됩니다.</li>
  <li>체결 상대는 가격 우선(매도는 낮은 가격, 매수는 높은 가격), 같은 가격이면 먼저 들어온 주문 우선입니다.</li>
  <li>체결 가격은 <b>먼저 호가창에 있던 주문의 가격</b>입니다. 부분 체결될 수 있고, 남은 수량은 호가창에 올라갑니다.</li>
  <li>체결 내역 형식: <code>"매수id 매도id 가격 수량"</code></li>
</ul>
<p class="muted">제한: 명령 수 ≤ 200,000, 가격 ≤ 10<sup>9</sup>, 수량 ≤ 10<sup>6</sup>, 주문 id는 모두 다릅니다.</p>`,
  io: `입력
["S 1 70100 5", "S 2 70000 3", "S 3 70000 4", "B 4 70100 10", "C 1", "B 5 70100 1"]

출력
["4 2 70000 3", "4 3 70000 4", "4 1 70100 3"]

설명: 매수 4(10주)는 70000원 매도 2, 3을 시간 순으로 먹고 70100원 매도 1에서 3주를 체결합니다.
매도 1의 남은 2주는 취소되므로 매수 5는 체결 없이 호가창에 올라갑니다.`,
  approach: `
<ul>
  <li>매도 호가창은 (가격 오름차순, 순번 오름차순), 매수 호가창은 (가격 내림차순, 순번 오름차순) 우선순위 큐로 둡니다. 체결마다 맨 위만 보면 되므로 주문당 O(log N).</li>
  <li>취소는 힙 중간 삭제가 비싸므로 취소 id를 Set에 넣어 두고 <b>힙 맨 위로 올라왔을 때 버리는 lazy deletion</b>으로 처리합니다.</li>
  <li>체결 가격을 들어온 주문 가격으로 쓰는 실수, 같은 가격 내 시간 우선을 빼먹는 실수가 흔한 감점 포인트입니다.</li>
  <li>꼬리 질문 대비: 실제 거래소 매칭 엔진은 가격별 FIFO 큐를 TreeMap으로 묶고, 단일 스레드로 종목당 직렬 처리해 락 없이 순서를 보장합니다.</li>
</ul>`,
  code: `import java.util.*;

class Solution {
    static class Order {
        final int id; final long price; final long seq; long qty;
        Order(int id, long price, long seq, long qty) {
            this.id = id; this.price = price; this.seq = seq; this.qty = qty;
        }
    }

    public List<String> solution(String[] commands) {
        PriorityQueue<Order> buys = new PriorityQueue<>((a, b) ->
            a.price != b.price ? Long.compare(b.price, a.price) : Long.compare(a.seq, b.seq));
        PriorityQueue<Order> sells = new PriorityQueue<>((a, b) ->
            a.price != b.price ? Long.compare(a.price, b.price) : Long.compare(a.seq, b.seq));
        Set<Integer> cancelled = new HashSet<>();
        List<String> trades = new ArrayList<>();
        long seq = 0;

        for (String cmd : commands) {
            String[] p = cmd.split(" ");
            if (p[0].equals("C")) { cancelled.add(Integer.parseInt(p[1])); continue; }

            boolean isBuy = p[0].equals("B");
            Order in = new Order(Integer.parseInt(p[1]), Long.parseLong(p[2]), seq++, Long.parseLong(p[3]));
            PriorityQueue<Order> opposite = isBuy ? sells : buys;

            while (in.qty > 0 && !opposite.isEmpty()) {
                Order top = opposite.peek();
                if (cancelled.contains(top.id)) { opposite.poll(); continue; } // lazy deletion
                boolean crosses = isBuy ? top.price <= in.price : top.price >= in.price;
                if (!crosses) break;

                long q = Math.min(in.qty, top.qty);
                int buyId = isBuy ? in.id : top.id;
                int sellId = isBuy ? top.id : in.id;
                trades.add(buyId + " " + sellId + " " + top.price + " " + q);
                in.qty -= q;
                top.qty -= q;
                if (top.qty == 0) opposite.poll();
            }
            if (in.qty > 0) (isBuy ? buys : sells).add(in);
        }
        return trades;
    }
}`
},
{
  id: "c2", title: "멱등 원장 반영", chips: ["해시맵", "해시셋"], case: "잔고 정합성",
  body: `
<p>계좌 이벤트가 메시지 큐에서 들어옵니다. 메시지 큐는 같은 이벤트를 <b>두 번 이상 보낼 수 있습니다</b>. 이벤트를 순서대로 반영한 최종 잔고와 거절된 이벤트를 구하세요.</p>
<ul>
  <li><code>"eventId account DEPOSIT amount"</code>: 입금</li>
  <li><code>"eventId account WITHDRAW amount"</code>: 출금. 잔고가 부족하면 거절합니다.</li>
  <li><code>"eventId from TRANSFER to amount"</code>: 이체. 출금 계좌 잔고가 부족하면 <b>양쪽 모두 반영하지 않고</b> 거절합니다.</li>
  <li>이미 처리한 <code>eventId</code>가 다시 오면 아무 일도 하지 않습니다. 처음에 거절된 이벤트가 다시 와도 마찬가지입니다.</li>
  <li>반환: 이벤트에 등장한 모든 계좌를 계좌명 사전순으로 <code>"계좌:잔고"</code>, 마지막 원소는 <code>"REJECTED:"</code> 뒤에 거절된 eventId를 처리 순서대로 쉼표로 이어 붙입니다.</li>
</ul>
<p class="muted">제한: 이벤트 수 ≤ 300,000, 금액은 원 단위 정수, 잔고 합은 long 범위.</p>`,
  io: `입력
["e1 A DEPOSIT 10000", "e2 A WITHDRAW 3000", "e2 A WITHDRAW 3000",
 "e3 A TRANSFER B 8000", "e4 B DEPOSIT 500", "e5 A TRANSFER B 7000"]

출력
["A:0", "B:7500", "REJECTED:e3"]`,
  approach: `
<ul>
  <li>처리한 eventId를 HashSet에 기록하고, <code>add</code>가 false면 건너뜁니다. 거절된 이벤트도 "처리됨"으로 기록해야 재전송 시 결과가 바뀌지 않습니다. 이것이 멱등성의 정의입니다.</li>
  <li>이체는 검사 후 두 계좌를 함께 바꾸고, 실패하면 아무것도 바꾸지 않습니다. 실제 DB에서는 한 트랜잭션입니다.</li>
  <li>금액은 <code>long</code>. 부동소수점을 쓰면 감점 대상입니다 (서술형 개념 10 참고).</li>
  <li>꼬리 질문 대비: 실서비스에서는 처리 이력 테이블에 eventId를 unique key로 넣고 잔고 변경과 같은 트랜잭션으로 커밋합니다. 메모리 Set은 재시작하면 사라집니다.</li>
</ul>`,
  code: `import java.util.*;

class Solution {
    public String[] solution(String[] events) {
        Map<String, Long> balance = new TreeMap<>();
        Set<String> seen = new HashSet<>();
        List<String> rejected = new ArrayList<>();

        for (String e : events) {
            String[] p = e.split(" ");
            String id = p[0], acc = p[1], type = p[2];
            if (!seen.add(id)) continue; // 같은 eventId 재전송은 무시
            balance.putIfAbsent(acc, 0L);

            switch (type) {
                case "DEPOSIT" -> balance.merge(acc, Long.parseLong(p[3]), Long::sum);
                case "WITHDRAW" -> {
                    long amt = Long.parseLong(p[3]);
                    if (balance.get(acc) < amt) rejected.add(id);
                    else balance.merge(acc, -amt, Long::sum);
                }
                case "TRANSFER" -> {
                    String to = p[3];
                    long amt = Long.parseLong(p[4]);
                    balance.putIfAbsent(to, 0L);
                    if (balance.get(acc) < amt) rejected.add(id);
                    else {
                        balance.merge(acc, -amt, Long::sum);
                        balance.merge(to, amt, Long::sum);
                    }
                }
            }
        }

        List<String> out = new ArrayList<>();
        balance.forEach((k, v) -> out.add(k + ":" + v));
        out.add("REJECTED:" + String.join(",", rejected));
        return out.toArray(new String[0]);
    }
}`
},
{
  id: "c3", title: "1분봉 캔들 만들기", chips: ["안정 정렬", "구간 집계"], case: "실시간 시세",
  body: `
<p>한 종목의 체결 틱이 네트워크 사정으로 <b>시간 순서가 섞여서</b> 들어옵니다. 1분봉(OHLCV)을 만들어 반환하세요.</p>
<ul>
  <li>틱 형식: <code>"HH:MM:SS price volume"</code> (같은 날, 1개 이상)</li>
  <li>분봉은 첫 틱이 속한 분부터 마지막 틱이 속한 분까지 <b>빠짐없이</b> 만듭니다.</li>
  <li>시가(O)는 그 분의 가장 이른 틱, 종가(C)는 가장 늦은 틱입니다. 같은 초의 틱은 입력 순서를 따릅니다.</li>
  <li>틱이 없는 분은 O=H=L=C=직전 분의 종가, 거래량 0입니다.</li>
  <li>출력 형식: <code>"HH:MM O H L C V"</code></li>
</ul>
<p class="muted">제한: 틱 수 ≤ 500,000.</p>`,
  io: `입력
["09:00:05 70000 10", "09:00:01 70100 5", "09:00:59 69900 2", "09:02:10 70200 1"]

출력
["09:00 70100 70100 69900 69900 17",
 "09:01 69900 69900 69900 69900 0",
 "09:02 70200 70200 70200 70200 1"]`,
  approach: `
<ul>
  <li>초 단위로 바꿔 정렬합니다. 같은 초는 입력 순서를 유지해야 하므로 <b>안정 정렬</b>이 필요합니다. Java의 객체 배열 정렬(TimSort)은 안정적이고, 기본형 배열 정렬(Dual-Pivot Quicksort)은 아닙니다.</li>
  <li>정렬 후 분 단위로 한 번 훑으며 O, H, L, C, V를 갱신합니다. 빈 분은 직전 종가로 채웁니다. 전체 O(N log N).</li>
  <li>흔한 실수: 빈 분을 빼먹음, 시가를 첫 입력 틱으로 잡음.</li>
  <li>꼬리 질문 대비: 스트리밍이라면 정렬 대신 워터마크(늦게 오는 틱을 얼마나 기다릴지)로 분봉을 확정합니다.</li>
</ul>`,
  code: `import java.util.*;

class Solution {
    public String[] solution(String[] ticks) {
        int n = ticks.length;
        int[] sec = new int[n];
        long[] price = new long[n], vol = new long[n];
        Integer[] idx = new Integer[n];

        for (int i = 0; i < n; i++) {
            String[] p = ticks[i].split(" ");
            String[] t = p[0].split(":");
            sec[i] = Integer.parseInt(t[0]) * 3600 + Integer.parseInt(t[1]) * 60 + Integer.parseInt(t[2]);
            price[i] = Long.parseLong(p[1]);
            vol[i] = Long.parseLong(p[2]);
            idx[i] = i;
        }
        Arrays.sort(idx, Comparator.comparingInt(i -> sec[i])); // 안정 정렬: 같은 초는 입력 순서 유지

        List<String> out = new ArrayList<>();
        int k = 0;
        long prevClose = 0;
        for (int m = sec[idx[0]] / 60; m <= sec[idx[n - 1]] / 60; m++) {
            long o = -1, h = Long.MIN_VALUE, l = Long.MAX_VALUE, c = 0, v = 0;
            while (k < n && sec[idx[k]] / 60 == m) {
                long pr = price[idx[k]];
                if (o < 0) o = pr;
                h = Math.max(h, pr);
                l = Math.min(l, pr);
                c = pr;
                v += vol[idx[k]];
                k++;
            }
            if (o < 0) { o = h = l = c = prevClose; }
            prevClose = c;
            out.add(String.format("%02d:%02d %d %d %d %d %d", m / 60, m % 60, o, h, l, c, v));
        }
        return out.toArray(new String[0]);
    }
}`
},
{
  id: "c4", title: "브로커 유량 제어", chips: ["덱", "슬라이딩 윈도우"], case: "외부 브로커 TPS",
  body: `
<p>외부 브로커로 나가는 주문 요청을 제한합니다. 요청은 시간순으로 <code>"timestampMs userId"</code> 형식으로 주어집니다.</p>
<ul>
  <li>각 요청 시각 <code>t</code>에 대해, 구간 <code>(t − windowMs, t]</code> 안에서 <b>허용된</b> 요청 수를 셉니다.</li>
  <li>해당 사용자의 허용 수가 <code>userLimit</code> 미만이고, 전체 허용 수가 <code>globalLimit</code> 미만이면 <code>"ALLOW"</code>, 아니면 <code>"DENY"</code>입니다.</li>
  <li>거절된 요청은 사용자 한도와 전체 한도 어느 쪽에도 세지 않습니다.</li>
</ul>
<p class="muted">제한: 요청 수 ≤ 500,000, 사용자 수 ≤ 100,000.</p>`,
  io: `입력
requests = ["0 a", "100 a", "200 a", "300 b", "400 c", "1000 a", "1100 a"]
userLimit = 2, globalLimit = 3, windowMs = 1000

출력
["ALLOW", "ALLOW", "DENY", "ALLOW", "DENY", "ALLOW", "ALLOW"]`,
  approach: `
<ul>
  <li>사용자별 덱과 전역 덱에 <b>허용된</b> 요청 시각만 넣습니다. 새 요청마다 앞에서 <code>t − windowMs</code> 이하인 시각을 빼면, 덱 크기가 곧 구간 내 허용 수입니다.</li>
  <li>각 시각은 한 번 들어가고 한 번 나오므로 전체 O(N).</li>
  <li>구간 경계(열린 구간인지 닫힌 구간인지)를 문제대로 처리했는지가 채점 포인트입니다. 예시의 1000ms 요청에서 0ms 요청이 빠져야 합니다.</li>
  <li>꼬리 질문 대비: 고정 윈도우는 경계에서 2배 버스트가 생기고, 토큰 버킷은 메모리 O(1)로 평균 속도와 버스트 크기를 따로 조절합니다. 여러 서버에서 공유하려면 Redis에 원자적 스크립트로 둡니다.</li>
</ul>`,
  code: `import java.util.*;

class Solution {
    public String[] solution(String[] requests, int userLimit, int globalLimit, long windowMs) {
        Map<String, ArrayDeque<Long>> perUser = new HashMap<>();
        ArrayDeque<Long> global = new ArrayDeque<>();
        String[] out = new String[requests.length];

        for (int i = 0; i < requests.length; i++) {
            String[] p = requests[i].split(" ");
            long t = Long.parseLong(p[0]);
            ArrayDeque<Long> q = perUser.computeIfAbsent(p[1], k -> new ArrayDeque<>());

            while (!q.isEmpty() && q.peekFirst() <= t - windowMs) q.pollFirst();
            while (!global.isEmpty() && global.peekFirst() <= t - windowMs) global.pollFirst();

            if (q.size() < userLimit && global.size() < globalLimit) {
                q.addLast(t);
                global.addLast(t);
                out[i] = "ALLOW";
            } else {
                out[i] = "DENY";
            }
        }
        return out;
    }
}`
},
{
  id: "c5", title: "서비스 기동 순서", chips: ["위상 정렬", "사이클 탐지"], case: "MSA 의존성",
  body: `
<p>MSA 서비스 간 의존 관계가 <code>"A B"</code>(A가 B를 호출하므로 B가 먼저 떠 있어야 함) 형태로 주어집니다. 모든 서비스를 띄우는 순서를 반환하세요.</p>
<ul>
  <li>동시에 띄울 수 있는 서비스가 여럿이면 <b>이름 사전순으로 가장 앞선 것</b>을 먼저 띄웁니다.</li>
  <li>순환 의존이 있어 모두 띄울 수 없으면 빈 배열을 반환합니다.</li>
  <li>같은 의존 관계가 중복으로 주어질 수 있습니다.</li>
</ul>
<p class="muted">제한: 의존 관계 수 ≤ 200,000. 2022년 공개 기출 「Lockfile을 만들어보자」처럼 그래프 탐색 + 결정적 순서를 묻는 유형입니다.</p>`,
  io: `입력
["order account", "order market", "balance account", "order balance", "gateway order"]

출력
["account", "balance", "market", "order", "gateway"]`,
  approach: `
<ul>
  <li>간선 방향을 B → A(먼저 떠야 하는 쪽 → 의존하는 쪽)로 잡고 진입 차수를 셉니다.</li>
  <li>Kahn 알고리즘에서 큐 대신 <b>PriorityQueue&lt;String&gt;</b>을 쓰면 사전순 조건이 해결됩니다. O((V + E) log V).</li>
  <li>꺼낸 노드 수가 전체 노드 수보다 적으면 사이클입니다.</li>
  <li>중복 간선은 진입 차수와 인접 리스트에 똑같이 두 번 들어가므로 따로 처리하지 않아도 결과가 맞습니다.</li>
</ul>`,
  code: `import java.util.*;

class Solution {
    public String[] solution(String[] deps) {
        Map<String, List<String>> next = new HashMap<>();
        Map<String, Integer> indeg = new HashMap<>();

        for (String d : deps) {
            String[] p = d.split(" ");
            String a = p[0], b = p[1]; // a가 b에 의존 → b가 먼저
            indeg.putIfAbsent(a, 0);
            indeg.putIfAbsent(b, 0);
            next.computeIfAbsent(b, k -> new ArrayList<>()).add(a);
            indeg.merge(a, 1, Integer::sum);
        }

        PriorityQueue<String> ready = new PriorityQueue<>();
        indeg.forEach((k, v) -> { if (v == 0) ready.add(k); });

        List<String> order = new ArrayList<>();
        while (!ready.isEmpty()) {
            String cur = ready.poll();
            order.add(cur);
            for (String n : next.getOrDefault(cur, List.of())) {
                if (indeg.merge(n, -1, Integer::sum) == 0) ready.add(n);
            }
        }
        return order.size() == indeg.size() ? order.toArray(new String[0]) : new String[0];
    }
}`
}
];

export const QUIZ = [
{ id: "k1", type: "용어", ref: "개념 4",
  q: `같은 요청이나 이벤트를 여러 번 처리해도 결과가 한 번 처리한 것과 같은 성질을 무엇이라고 합니까?`,
  a: `<p><b>정답:</b> 멱등성 (idempotency)</p><p>at-least-once 전달에서 생기는 중복을 흡수하는 핵심 성질입니다. 처리 이력에 eventId를 unique key로 남겨 구현합니다.</p>` },
{ id: "k2", type: "용어", ref: "개념 1",
  q: `두 트랜잭션이 같은 행을 읽고 각자 계산한 값으로 덮어써서, 한쪽의 변경이 사라지는 현상을 무엇이라고 합니까?`,
  a: `<p><b>정답:</b> 갱신 손실 (lost update)</p><p>InnoDB의 REPEATABLE READ는 이를 감지하지 않습니다. 조건부 UPDATE, <code>SELECT ... FOR UPDATE</code>, 버전 컬럼으로 막습니다.</p>` },
{ id: "k3", type: "빈칸", ref: "개념 1",
  q: `잔고가 부족하면 차감되지 않도록 원자적으로 출금하는 SQL의 빈칸을 채우세요.<br><code>UPDATE account SET balance = balance - 70000 WHERE id = 1 AND ( 빈칸 )</code>`,
  a: `<p><b>정답:</b> <code>balance &gt;= 70000</code></p><p>실행 후 영향받은 행 수가 0이면 잔고 부족으로 처리합니다. 읽기와 검사와 쓰기가 한 문장 안에서 행 락을 잡고 일어나므로 경쟁 조건이 없습니다.</p>` },
{ id: "k4", type: "빈칸", ref: "개념 16",
  q: `MySQL InnoDB의 기본 트랜잭션 격리수준은 무엇입니까?`,
  a: `<p><b>정답:</b> REPEATABLE READ</p><p>PostgreSQL과 Oracle의 기본값은 READ COMMITTED입니다. 구현마다 다르다는 점까지 말할 수 있으면 좋습니다.</p>` },
{ id: "k5", type: "용어", ref: "개념 16",
  q: `InnoDB에서 locking read가 레코드와 그 앞의 간격을 함께 잠가, 범위 안에 새 행이 삽입되는 것을 막는 락은?`,
  a: `<p><b>정답:</b> 넥스트키 락 (next-key lock)</p><p>레코드 락과 갭 락을 합친 것입니다. REPEATABLE READ에서 팬텀을 막는 장치입니다.</p>` },
{ id: "k6", type: "빈칸", ref: "개념 2",
  q: `<code>WHERE account_id = ? AND traded_at &gt; ? ORDER BY traded_at DESC LIMIT 20</code> 쿼리에 맞는 복합 인덱스의 컬럼 순서를 쓰세요.`,
  a: `<p><b>정답:</b> <code>(account_id, traded_at)</code></p><p>등치 조건 컬럼을 앞에, 범위·정렬 컬럼을 뒤에 둡니다. 그래야 한 계좌 구간을 역순으로 20건만 읽고 멈춥니다.</p>` },
{ id: "k7", type: "용어", ref: "개념 2",
  q: `쿼리에 필요한 컬럼이 모두 인덱스에 들어 있어, 테이블(클러스터 인덱스)을 다시 읽지 않아도 되는 인덱스를 무엇이라고 합니까?`,
  a: `<p><b>정답:</b> 커버링 인덱스 (covering index)</p><p>MySQL <code>EXPLAIN</code>의 Extra에 <code>Using index</code>로 표시됩니다.</p>` },
{ id: "k8", type: "빈칸", ref: "개념 3",
  q: `Kafka는 ( 빈칸 ) 단위 안에서만 메시지 순서를 보장합니다.`,
  a: `<p><b>정답:</b> 파티션 (partition)</p><p>그래서 같은 계좌의 순서가 필요하면 accountId를 메시지 키로 써서 같은 파티션에 보냅니다.</p>` },
{ id: "k9", type: "용어", ref: "개념 3",
  q: `Kafka 프로듀서의 재시도로 인한 메시지 중복과 순서 역전을 막기 위해 켜는 프로듀서 설정 이름은?`,
  a: `<p><b>정답:</b> <code>enable.idempotence=true</code></p><p>프로듀서 ID와 시퀀스 번호로 브로커가 중복을 걸러 냅니다. Kafka 3.0부터 기본값이 true입니다.</p>` },
{ id: "k10", type: "용어", ref: "개념 4",
  q: `컨슈머가 "처리 후 오프셋 커밋" 순서로 동작할 때, 커밋 직전에 죽으면 메시지가 다시 처리됩니다. 이 전달 보장 수준의 이름은?`,
  a: `<p><b>정답:</b> at-least-once (최소 한 번)</p><p>반대로 커밋을 먼저 하면 at-most-once가 되어 유실이 생깁니다.</p>` },
{ id: "k11", type: "용어", ref: "개념 5",
  q: `DB 저장과 이벤트 발행을 원자적으로 묶기 위해, 같은 트랜잭션에서 이벤트 테이블에 먼저 기록하고 별도 프로세스가 발행하는 패턴은?`,
  a: `<p><b>정답:</b> 트랜잭셔널 아웃박스 (Transactional Outbox)</p><p>릴레이는 폴링이나 CDC로 동작하고, 전달은 at-least-once이므로 컨슈머는 멱등해야 합니다.</p>` },
{ id: "k12", type: "용어", ref: "개념 5",
  q: `DB의 변경 로그(MySQL binlog 등)를 읽어 변경 사항을 이벤트로 내보내는 기법을 약어로 쓰세요.`,
  a: `<p><b>정답:</b> CDC (Change Data Capture)</p><p>대표 도구는 Debezium입니다. 토스증권은 대규모 CDC 파이프라인 운영기를 toss.tech에 공개했습니다.</p>` },
{ id: "k13", type: "계산", ref: "개념 6",
  q: `초당 100건이 들어오고 요청 하나가 평균 3초 걸린다면, 동시에 처리 중인 요청은 평균 몇 개입니까?`,
  a: `<p><b>정답:</b> 300개</p><p>동시 처리 수 = 처리량 × 지연 = 100 × 3. 스레드가 200개뿐이면 풀이 고갈됩니다.</p>` },
{ id: "k14", type: "용어", ref: "개념 6",
  q: `"시스템 안의 평균 요청 수 = 도착률 × 평균 체류 시간"이라는 관계를 무엇이라고 합니까?`,
  a: `<p><b>정답:</b> 리틀의 법칙 (Little's Law)</p><p>L = λW. 스레드 풀, 커넥션 풀 크기를 정할 때 바로 씁니다.</p>` },
{ id: "k15", type: "용어", ref: "개념 6",
  q: `외부 호출의 실패율이 임계치를 넘으면 호출 자체를 일정 시간 막고 즉시 실패시키는 패턴은?`,
  a: `<p><b>정답:</b> 서킷 브레이커 (circuit breaker)</p><p>상태는 CLOSED, OPEN, HALF_OPEN 세 가지입니다. resilience4j가 대표 구현입니다.</p>` },
{ id: "k16", type: "용어", ref: "개념 6",
  q: `외부 브로커 호출 전용 스레드 풀(또는 세마포어)을 따로 두어, 한 의존성의 장애가 다른 기능으로 번지지 않게 하는 패턴은?`,
  a: `<p><b>정답:</b> 벌크헤드 (bulkhead)</p><p>배의 격벽에서 온 이름입니다. 한 칸이 침수돼도 배 전체가 가라앉지 않게 합니다.</p>` },
{ id: "k17", type: "용어", ref: "개념 7",
  q: `데드락 4조건 중, "락을 항상 계좌 ID가 작은 쪽부터 잡는다"는 규칙으로 깨는 조건은?`,
  a: `<p><b>정답:</b> 순환 대기 (circular wait)</p><p>나머지 셋은 상호 배제, 점유 대기, 비선점입니다.</p>` },
{ id: "k18", type: "용어", ref: "개념 8",
  q: `TCP에서 연결을 먼저 끊은 쪽이 마지막 ACK를 보낸 뒤 2MSL 동안 머무는 상태는?`,
  a: `<p><b>정답:</b> TIME_WAIT</p><p>먼저 끊은 쪽(active close)에 생깁니다. 서버가 먼저 끊으면 서버에, 클라이언트가 먼저 끊으면 클라이언트에 쌓입니다.</p>` },
{ id: "k19", type: "숫자", ref: "개념 8",
  q: `리눅스의 기본 ephemeral 포트 범위(<code>net.ipv4.ip_local_port_range</code>)는?`,
  a: `<p><b>정답:</b> 32768 ~ 60999</p><p>약 2.8만 개입니다. 같은 목적지 IP:port로 연결을 계속 새로 열면 이 범위가 TIME_WAIT로 고갈됩니다.</p>` },
{ id: "k20", type: "용어", ref: "개념 9",
  q: `캐시 TTL이 만료되는 순간 수많은 요청이 동시에 원천 저장소로 몰리는 현상은?`,
  a: `<p><b>정답:</b> 캐시 스탬피드 (cache stampede)</p><p>thundering herd, dogpile이라고도 합니다. 키별 단일 갱신, 조기 갱신, TTL jitter로 막습니다.</p>` },
{ id: "k21", type: "출력 예측", ref: "개념 10",
  q: `다음 Java 코드의 출력은?<br><code>System.out.println(0.1 + 0.2 == 0.3);</code>`,
  a: `<p><b>정답:</b> false</p><p>0.1 + 0.2는 0.30000000000000004입니다. 이진 부동소수점은 10진 소수를 정확히 표현하지 못합니다.</p>` },
{ id: "k22", type: "출력 예측", ref: "개념 10",
  q: `다음 Java 코드의 출력은?<br><code>System.out.println(new BigDecimal("1.0").equals(new BigDecimal("1.00")));</code>`,
  a: `<p><b>정답:</b> false</p><p><code>equals</code>는 scale(1과 2)까지 비교합니다. 값만 비교하려면 <code>compareTo(...) == 0</code>을 씁니다.</p>` },
{ id: "k23", type: "용어", ref: "개념 11",
  q: `CQRS 읽기 뷰의 전파 지연 때문에 "내가 방금 쓴 데이터를 내가 바로 읽지 못하는" 문제에서, 깨진 일관성 보장의 이름은?`,
  a: `<p><b>정답:</b> read-your-writes (자기 쓰기 읽기) 일관성</p><p>쓰기 직후 원본에서 읽기, 버전 비교 후 fallback으로 보완합니다.</p>` },
{ id: "k24", type: "용어", ref: "개념 12",
  q: `SSE(Server-Sent Events) 연결이 끊겼다 다시 붙을 때, 브라우저가 마지막으로 받은 이벤트 ID를 서버에 알리는 HTTP 요청 헤더는?`,
  a: `<p><b>정답:</b> <code>Last-Event-ID</code></p><p>서버가 이벤트에 <code>id:</code> 필드를 붙여 보내면 브라우저가 자동으로 기억해 재연결 때 보냅니다.</p>` },
{ id: "k25", type: "숫자", ref: "개념 13",
  q: `컨테이너가 메모리 limit을 넘어 OOMKilled 되었을 때의 exit code는?`,
  a: `<p><b>정답:</b> 137</p><p>128 + 9(SIGKILL). 커널이 죽였기 때문에 JVM의 OutOfMemoryError 로그가 남지 않습니다.</p>` },
{ id: "k26", type: "계산", ref: "개념 15",
  q: `예약주문 1,000,000건을 초당 2,000건 한도로 보내면 최소 몇 초가 걸립니까?`,
  a: `<p><b>정답:</b> 500초</p><p>약 8분 20초입니다. 여유 마진 20%를 두어 1,600 TPS로 보내면 625초입니다.</p>` },
{ id: "k27", type: "계산", ref: "개념 15",
  q: `"1초 고정 윈도우마다 2,000건"으로 제한하면, 윈도우 경계를 걸친 임의의 1초 동안 최대 몇 건이 나갈 수 있습니까?`,
  a: `<p><b>정답:</b> 4,000건</p><p>앞 윈도우 끝에 2,000건, 다음 윈도우 시작에 2,000건이 몰리는 경우입니다. 슬라이딩 윈도우나 토큰 버킷이 이 문제를 줄입니다.</p>` },
{ id: "k28", type: "용어", ref: "개념 17",
  q: `Kafka 클러스터 전환 시 timestamp로 대상 클러스터의 오프셋을 찾을 때 쓰는 KafkaConsumer 메서드 이름은?`,
  a: `<p><b>정답:</b> <code>offsetsForTimes</code></p><p>파티션별로 주어진 timestamp 이후 첫 메시지의 오프셋을 돌려줍니다. 토스증권 Kafka 이중화 #3 글의 timestamp 검색 방식입니다.</p>` },
{ id: "k29", type: "용어", ref: "코딩 3",
  q: `Java에서 객체 배열(<code>Integer[]</code>, <code>List</code>)을 정렬할 때 쓰이는 안정 정렬 알고리즘의 이름은?`,
  a: `<p><b>정답:</b> TimSort</p><p>기본형 배열(<code>int[]</code>)은 Dual-Pivot Quicksort라 안정 정렬이 아닙니다.</p>` },
{ id: "k30", type: "용어", ref: "코딩 1",
  q: `호가창에서 "가장 낮은 매도 호가"를 O(log N)에 꺼내고 넣을 수 있는 자료구조는? (Java 클래스 이름으로 써도 됩니다)`,
  a: `<p><b>정답:</b> 우선순위 큐 / 힙 (<code>PriorityQueue</code>)</p><p>가격별 FIFO가 필요하면 <code>TreeMap&lt;가격, Deque&lt;주문&gt;&gt;</code>도 정답으로 볼 수 있습니다.</p>` }
];

export const DESIGN = [
{ id: "d1", chips: ["대용량 트래픽", "외부 연동"], case: true,
  q: `해외주식 주문 서버를 운영합니다. 미국 정규장 개장(한국시간 22:30, 서머타임 기준) 직후 주문 TPS가 평소의 20배 이상으로 뛰고, 개장 시점에 예약주문 약 100만 건을 외부 브로커로 보내야 합니다. 브로커는 TPS 상한이 있고 가끔 응답이 수 초로 느려집니다. 고객 주문을 <b>유실하거나 이중으로 내지 않으면서</b> 안정적으로 처리하는 구조를 설계하고, 브로커가 장애일 때의 대응을 서술하세요.`,
  a: `<ul>
<li><b>문제 정의:</b> 병목은 우리 서버가 아니라 브로커의 TPS 상한과 지연입니다. 깨지면 안 되는 것은 주문 유실, 이중 주문, 그리고 브로커 지연이 다른 기능(잔고, 시세)으로 번지는 것입니다.</li>
<li><b>분리:</b> 예약주문 배치와 실시간 주문을 다른 큐와 스레드 풀로 나눕니다(벌크헤드). 브로커 한도를 둘이 어떻게 나눌지 정합니다. 실시간 주문 우선이 자연스럽습니다.</li>
<li><b>유량 제어:</b> 브로커 상한 이하로 RateLimiter를 둡니다. TPS는 배포 없이 바꿀 수 있게 런타임 파라미터로 주입합니다. 100만 건 ÷ 상한 = 소요 시간을 계산해 둡니다.</li>
<li><b>주문 상태 머신:</b> 접수 → 전송 중 → 브로커 접수 확인 → 체결/거부. 전송 전에 DB에 먼저 기록해 서버가 죽어도 이어서 보냅니다.</li>
<li><b>타임아웃은 "결과 모름":</b> 브로커가 받았는지 모르므로 바로 재전송하면 이중 주문이 됩니다. 고유 주문키(client order id)를 붙여 멱등하게 보내고, 재시도 전에 주문 조회 API로 상태를 확인합니다.</li>
<li><b>장애 감지와 전환:</b> 1분 실패 수나 실패율이 임계치를 넘으면 서킷을 열고, 이상 감지 이벤트로 서브 브로커에 자동 failover합니다. 복구 시 원래 브로커로 돌아오는 조건도 정합니다. 사람이 24시간 지켜보지 않아도 되게 자동화합니다.</li>
<li><b>관측:</b> 브로커 p99 지연, 실패율, 큐 길이와 대기 시간, 예약주문 처리 진척도. 장 마감 후 브로커 체결 내역과 우리 원장을 대사합니다.</li>
</ul>
<p class="src">근거: toss.tech 「우리는 어떻게 해외주식 서비스 안정화를 이뤘는가」. 정규장 TPS 20배 이상, 예약주문 100만 건, RateLimiter, 1분 실패 100건 초과 시 failover.</p>` },
{ id: "d2", chips: ["원장", "정합성"], case: true,
  q: `거래소(또는 브로커)에서 받은 체결 이벤트로 고객의 예수금과 보유 수량을 갱신하는 원장 서비스를 설계하세요. 체결 이벤트는 <b>중복될 수 있고, 순서가 뒤바뀔 수 있으며, 드물게 누락</b>됩니다. 각 상황에서 원장이 틀어지지 않게 하는 방법과, 틀어졌을 때 알아채는 방법을 서술하세요.`,
  a: `<ul>
<li><b>원장 구조:</b> 거래 기록은 append-only로 쌓고, 잔고는 그 합에서 파생되는 스냅샷으로 둡니다. 수정은 덮어쓰지 않고 취소·정정 기록을 추가합니다. 언제든 재계산과 감사가 가능합니다.</li>
<li><b>중복:</b> 체결 번호를 unique key로 원장에 insert하고, 잔고 갱신과 같은 트랜잭션으로 묶습니다. 중복은 unique 위반으로 버립니다.</li>
<li><b>순서:</b> 계좌(또는 주문) 키로 파티셔닝해 같은 계좌의 이벤트는 한 컨슈머가 직렬 처리합니다. 주문별 체결 시퀀스로 gap을 감지하면 보류하고 기다리거나 원천에 재요청합니다. 매도가 매수보다 먼저 와서 보유 수량이 음수가 되는 상황을 막습니다.</li>
<li><b>누락:</b> 시퀀스 gap 감지, 주문 수량 대비 체결 합계 확인, 원천의 체결 조회 API로 주기적 보정.</li>
<li><b>동시성:</b> 같은 계좌에 체결 반영과 출금이 동시에 오면 조건부 UPDATE나 행 락으로 음수 잔고를 막습니다.</li>
<li><b>대사(reconciliation):</b> 장 마감 후 거래소·브로커의 체결 원장과 건수, 금액, 수량을 맞춰 보고 차이를 리포트합니다. 읽기 뷰가 있으면 원본과도 대사합니다.</li>
<li><b>관측:</b> 컨슈머 lag, 보류 중인 이벤트 수, 대사 불일치 건수에 알람을 겁니다.</li>
</ul>
<p class="src">참고: 토스 유튜브 「체결부터 잔고까지 0.03초, 통합원장 서버 개발」, SLASH 22 「애플 한 주가 고객에게 전달되기까지」.</p>` },
{ id: "d3", chips: ["실시간", "fan-out"], case: true,
  q: `인기 종목의 시세는 초당 수십 번 바뀌고, 동시 접속자 수십만 명이 각자 관심 종목의 시세를 화면에서 봅니다. 거래소 시세 수신부터 앱 화면 갱신까지의 구조를 설계하세요. 특히 메시지 양, 느린 클라이언트, 서버 증설, 재접속을 어떻게 다루는지 서술하세요.`,
  a: `<ul>
<li><b>흐름:</b> 거래소 피드 수신 → Kafka(종목 코드 키) → 시세 처리기가 종목별 최신 상태를 메모리나 Redis에 유지 → push 게이트웨이(SSE 또는 WebSocket)가 구독자에게 전달.</li>
<li><b>메시지 양 계산:</b> 전송량 = 종목 변경 빈도 × 그 종목 구독자 수. 초당 30회 × 10만 명이면 한 종목만 초당 300만 메시지입니다. 사람 눈에는 초당 몇 번이면 충분하므로 클라이언트별로 100~200ms 단위로 <b>최신값만 합쳐(conflation)</b> 보냅니다.</li>
<li><b>느린 클라이언트:</b> 연결별 송신 버퍼에 상한을 두고, 넘치면 오래된 시세를 버리고 최신값만 남깁니다. 시세는 중간값이 아니라 최신값이 의미 있으므로 버려도 됩니다. 계속 못 따라오면 연결을 끊습니다.</li>
<li><b>증설:</b> 게이트웨이는 연결을 들고 있는 stateful 서버입니다. 서버당 연결 수(파일 디스크립터, 메모리)로 용량을 잡고, 각 게이트웨이는 자기 연결이 구독한 종목만 브로커에서 받습니다. 배포 시 연결이 한꺼번에 끊기므로 순차 배포와 재연결 지터가 필요합니다.</li>
<li><b>재접속:</b> 접속 직후 현재 스냅샷을 먼저 주고 이후 변경분을 스트리밍합니다. 메시지에 시퀀스를 붙여 순서 역전과 누락을 클라이언트가 판단하게 합니다.</li>
<li><b>장애 시:</b> push가 안 되면 짧은 주기 polling으로 fallback합니다.</li>
</ul>
<p class="src">참고: SLASH 22 「토스증권 실시간 시세 적용기」, SLASH 23 「실시간 시세 데이터 안전하고 빠르게 처리하기」, SLASH 24 「SSE 이벤트 푸쉬로 불필요한 Polling 제거하기」.</p>` },
{ id: "d4", chips: ["장애 대응", "관측"], case: true,
  q: `평일 23시 40분, 주문 API 실패율 알람이 울리고 p99 지연이 200ms에서 4초로 올라갔습니다. 30분 전에 주문 서버 배포가 한 건 있었습니다. 원인을 좁혀 가는 순서와, 각 단계에서 볼 지표·도구, 그리고 조치를 서술하세요.`,
  a: `<ul>
<li><b>영향 범위 먼저:</b> 모든 주문인지, 특정 시장(국내/해외), 특정 서버, 특정 사용자군인지. 에러가 같은 특성을 공유하는지 봅니다.</li>
<li><b>완화가 원인 분석보다 먼저:</b> 최근 변경이 있고 시점이 맞으면 롤백이 가장 빠른 완화입니다. 장중(미국장)이므로 고객 피해를 줄이는 것이 우선입니다.</li>
<li><b>변경 이력 확인:</b> 배포, 설정 변경, DB 작업, 외부 브로커 공지.</li>
<li><b>분산 추적:</b> Jaeger·Pinpoint로 느린 요청에서 처음 지연이나 에러가 난 서비스와 구간을 찾습니다.</li>
<li><b>해당 서비스 상세:</b> thread dump(BLOCKED·WAITING이 어디에 몰렸나), 커넥션 풀 대기, GC 로그, CPU·메모리, Kafka lag, 필요하면 tcpdump로 외부 연동 패킷 확인.</li>
<li><b>가설 → 검증 → 조치:</b> 하나씩 확인하고, 조치 후 지표가 돌아오는지 봅니다.</li>
<li><b>커뮤니케이션:</b> 장애 채널에 현황과 다음 업데이트 시각을 공유하고, 필요하면 고객 공지.</li>
<li><b>사후:</b> RCA, 재발 방지(테스트, 점진 배포, 알람 개선), 장애 중 실패한 주문의 상태 대사.</li>
</ul>
<p class="src">근거: 토스증권 서버 챕터 FAQ. 변경 이력 → Jaeger·Pinpoint로 최초 에러 서비스 식별 → tcpdump·thread dump로 상세 분석. 알람 전파 시간을 5분에서 1분으로 단축.</p>` },
{ id: "d5", chips: ["통합 레이어", "MSA"], case: true,
  q: `국내주식과 해외주식의 보유 내역이 서로 다른 서버, 다른 DB, 다른 API 형식으로 나뉘어 있습니다. 두 데이터를 합쳐 총 평가금액과 수익률을 보여 주는 "내 자산" 화면용 API를 설계하세요. 한쪽 서버가 느리거나 죽었을 때의 동작과, 이 통합 계층 자체의 위험을 함께 서술하세요.`,
  a: `<ul>
<li><b>두 가지 선택지:</b> (1) 요청 시점에 각 API를 호출해 합치는 aggregation 레이어(BFF). 항상 최신이지만 하위 서비스 지연과 장애를 그대로 받습니다. (2) CDC나 이벤트로 미리 합친 읽기 모델(CQRS). 빠르고 견고하지만 지연된 데이터와 정합성 관리 부담이 생깁니다.</li>
<li><b>aggregation이라면:</b> 병렬 호출, 호출마다 개별 타임아웃, 전체 응답 시간 예산을 정합니다.</li>
<li><b>부분 실패:</b> 성공한 부분은 보여 주고 실패한 섹션은 "불러오지 못함"으로 표시합니다. 총액은 틀린 숫자를 보여 주는 것보다 "일부 제외" 표시나 마지막 성공 값 + 기준 시각을 보여 주는 편이 금융에서 안전합니다.</li>
<li><b>계산 통일:</b> 수익률 계산식, 환율 적용 시점, 반올림 정책을 한 곳에 둡니다. 국내와 해외가 다르게 계산되면 화면마다 숫자가 달라집니다.</li>
<li><b>통합 계층의 위험:</b> 모든 화면이 거치므로 새로운 단일 장애점이자 병목이 됩니다. 비즈니스 로직을 많이 넣을수록 상위 서비스 변경이 이 계층을 깨뜨립니다. 로직은 최소화하고, 하위 API와 계약 테스트를 두고, 변경 공유 절차를 만듭니다.</li>
<li><b>관측:</b> 하위 호출별 지연과 실패율, 부분 응답 비율.</li>
</ul>
<p class="src">근거: 토스증권 서버 챕터 FAQ. 국내·해외 데이터가 다른 DB와 API에 흩어져 aggregation 코드가 늘어난 문제, 통합 레이어의 장점과 위험.</p>` },
{ id: "d6", chips: ["마이그레이션", "검증"], case: true,
  q: `수년간 운영된 레거시 원장 시스템을 새 시스템으로 교체해야 합니다. 서비스를 멈추지 않고, 데이터 정합성을 보장하며 전환하는 전략을 서술하세요. 새 시스템의 계산 결과가 레거시와 같다는 것을 어떻게 증명합니까?`,
  a: `<ul>
<li><b>리플레이 검증:</b> 운영 트래픽(또는 원장 입력 이벤트)을 기록해 새 시스템에 같은 순서로 다시 넣고, 결과 잔고와 원장을 레거시와 비교(diff)합니다. 차이가 0이 될 때까지 반복합니다.</li>
<li><b>섀도 운영:</b> 운영 요청을 새 시스템에도 복제해 보내되 응답은 버리고 결과만 비교합니다. 외부로 나가는 부작용(주문 전송, 알림)은 반드시 막습니다.</li>
<li><b>데이터 동기화:</b> 초기 적재는 배치로, 이후 변경분은 CDC로 따라잡습니다. 애플리케이션 이중 쓰기는 한쪽 실패 시 어긋나므로 피합니다.</li>
<li><b>점진 전환:</b> 계좌 비율이나 기능 단위로 조금씩 넘기고, 각 단계에서 대사합니다.</li>
<li><b>롤백 경로:</b> 전환 후에도 일정 기간 레거시로 되돌릴 수 있게 역방향 동기화나 전환 단위를 설계합니다.</li>
<li><b>증명:</b> 건수, 금액 합계, 계좌별 잔고 해시 같은 대사 지표와 차이 0 리포트를 남깁니다.</li>
</ul>
<p class="src">근거: SLASH 24 「리플레이 검증으로 새로운 금융 시스템 안전하게 도입하기」(토스증권 국내원장 차세대 프로젝트).</p>` }
];

export const CONCEPT = [
{ id: "s1", chips: ["DB", "동시성"], case: true,
  q: `잔고 10만 원인 계좌에 7만 원 출금 요청 두 건이 동시에 들어왔습니다. 애플리케이션은 <code>SELECT balance</code> → 잔고 검사 → <code>UPDATE account SET balance = ?</code> 순서로 처리합니다. MySQL InnoDB 기본 격리수준에서 어떤 일이 생기는지 쓰고, 해결책을 두 가지 이상 쓰세요.`,
  a: `<p><b>Lost update.</b> 기본 격리수준 REPEATABLE READ에서 두 트랜잭션은 각자 MVCC 스냅샷으로 10만 원을 읽고 검사를 통과합니다. 둘 다 계산한 값 30,000으로 덮어쓰므로 14만 원이 나갔는데 잔고는 3만 원입니다. 두 번째 UPDATE는 첫 번째 커밋까지 행 락을 기다리지만, 쓰는 값이 이미 낡은 읽기로 계산된 상수라 막지 못합니다.</p>
<ul>
<li>조건부 원자 UPDATE: <code>UPDATE account SET balance = balance - 70000 WHERE id = ? AND balance &gt;= 70000</code> 후 영향받은 행 수가 0이면 잔고 부족으로 처리. 가장 싸고 금융에서 기본으로 씁니다.</li>
<li>비관적 락: <code>SELECT ... FOR UPDATE</code>로 읽는 순간 행을 잠급니다. 경합이 많으면 대기가 길어집니다.</li>
<li>낙관적 락: <code>version</code> 컬럼을 <code>WHERE version = ?</code>로 확인하고 실패하면 재시도. 경합이 적을 때 유리합니다.</li>
<li>계좌 단위 직렬화: 같은 계좌 요청을 한 파티션이나 한 스레드로 몰아 처리합니다.</li>
</ul>
<p class="src">구현 차이: PostgreSQL의 REPEATABLE READ는 같은 행의 동시 수정을 감지해 직렬화 오류로 한쪽을 실패시킵니다. InnoDB는 감지하지 않습니다.</p>` },
{ id: "s2", chips: ["DB", "인덱스"], case: false,
  q: `체결 테이블 <code>trade(account_id, traded_at, symbol, price, qty, ...)</code>에서 "특정 계좌의 최근 30일 체결을 최신순으로 20건" 조회합니다. 어떤 인덱스를 만들고, 왜 <code>(traded_at, account_id)</code> 순서는 나쁜지 쓰세요.`,
  a: `<p><b><code>(account_id, traded_at)</code> 복합 인덱스</b>입니다. 등치 조건 컬럼을 앞에, 범위·정렬 컬럼을 뒤에 둡니다.</p>
<ul>
<li>B+Tree 안에서 한 계좌의 행들이 traded_at 순으로 붙어 있으므로, 그 구간 끝에서 역방향으로 20건만 읽고 멈춥니다. filesort가 없고 LIMIT으로 조기 종료됩니다.</li>
<li><code>(traded_at, account_id)</code>이면 최근 30일의 <b>모든 계좌</b> 구간을 훑으며 account_id를 걸러야 합니다. 일 체결이 수백만 건이면 수천만 엔트리를 읽습니다.</li>
<li>조회 컬럼까지 인덱스에 넣으면(커버링 인덱스) 테이블 랜덤 I/O도 사라집니다. InnoDB 보조 인덱스는 PK를 품고 있어 PK 컬럼은 공짜로 커버됩니다.</li>
<li>확인: <code>EXPLAIN</code>에서 key가 이 인덱스인지, Extra에 <code>Using filesort</code>가 없는지 봅니다.</li>
</ul>` },
{ id: "s3", chips: ["Kafka", "순서"], case: true,
  q: `주문 이벤트를 Kafka로 발행합니다. 같은 계좌의 주문은 반드시 들어온 순서대로 처리되어야 합니다. 메시지 키로 무엇을 쓰고, 그래도 순서가 깨질 수 있는 경우를 두 가지 이상 쓰세요.`,
  a: `<p><b>키를 accountId</b>로 둡니다. 같은 키는 같은 파티션으로 가고, Kafka는 파티션 안에서만 순서를 보장합니다.</p>
<ul>
<li>프로듀서 재시도: 멱등 프로듀서를 끈 채 <code>max.in.flight.requests.per.connection</code> &gt; 1이면 앞 배치가 실패 후 재전송되며 뒤 배치보다 늦게 들어갈 수 있습니다. <code>enable.idempotence=true</code>면 in-flight 5 이하에서 순서가 유지됩니다.</li>
<li>파티션 수 증설: 키 해시 → 파티션 매핑이 바뀌어, 증설 전 이벤트와 후 이벤트가 다른 파티션에 놓입니다.</li>
<li>컨슈머 병렬 처리: 한 파티션을 받아 스레드풀에 그냥 뿌리면 순서가 깨집니다. 키별로 같은 워커에 보내야 합니다.</li>
<li>재처리 토픽(retry topic)으로 일부만 우회시키면 뒤 이벤트가 먼저 처리됩니다.</li>
</ul>` },
{ id: "s4", chips: ["Kafka", "멱등성"], case: true,
  q: `잔고 반영 컨슈머가 "메시지 처리 → 오프셋 커밋" 순서로 동작합니다. 처리 직후, 커밋 직전에 프로세스가 죽었습니다. 무슨 일이 생기며, 잔고가 두 번 반영되는 것을 어떻게 막습니까? 커밋을 처리보다 먼저 하면 어떻게 되는지도 쓰세요.`,
  a: `<ul>
<li>재시작이나 리밸런스 뒤 마지막으로 커밋된 오프셋부터 다시 읽으므로 같은 메시지를 <b>다시 처리</b>합니다(at-least-once, 중복).</li>
<li>커밋을 먼저 하면 처리 전에 죽을 때 메시지를 건너뜁니다(at-most-once, <b>유실</b>). 금융에서 유실은 복구 불가이므로 at-least-once를 택하고 중복은 멱등으로 흡수합니다.</li>
<li>멱등 처리: 처리 이력 테이블에 eventId를 unique key로 insert하고, 잔고 변경과 <b>같은 DB 트랜잭션</b>에서 커밋합니다. 중복이면 unique 위반으로 건너뜁니다.</li>
<li>Kafka의 exactly-once(트랜잭션 프로듀서 + read_committed)는 Kafka → Kafka 구간만 보장하고, 외부 DB 쓰기까지 보장하지 않습니다.</li>
</ul>
<p class="src">토스증권 Kafka 이중화 글도 같은 원칙을 씁니다: 유실은 절대 없이, 중복은 최소화하고 멱등으로 보완.</p>` },
{ id: "s5", chips: ["분산", "정합성"], case: false,
  q: `주문을 DB에 저장하고 "주문 생성됨" 이벤트를 Kafka로 발행해야 합니다. <code>@Transactional</code> 메서드 안에서 <code>save()</code> 후 <code>kafkaTemplate.send()</code>를 호출하면 생길 수 있는 문제 두 가지와 대안을 쓰세요.`,
  a: `<ul>
<li><b>유령 이벤트:</b> send는 커밋 전에 나가므로, 이후 DB가 롤백되면 존재하지 않는 주문의 이벤트가 퍼집니다.</li>
<li><b>이벤트 유실:</b> 커밋 후로 옮겨도, 커밋과 send 사이에 프로세스가 죽거나 브로커가 응답하지 않으면 주문은 있는데 이벤트가 없습니다.</li>
<li>원인은 DB와 Kafka 두 곳에 원자적으로 쓸 수 없다는 것(dual write)입니다.</li>
<li><b>대안: Transactional Outbox.</b> 주문과 같은 트랜잭션으로 outbox 테이블에 이벤트를 insert합니다. 별도 릴레이가 폴링하거나 CDC(Debezium)로 binlog를 읽어 Kafka로 발행합니다. 릴레이는 at-least-once이므로 컨슈머는 멱등해야 합니다.</li>
<li>2PC(XA)는 Kafka가 지원하지 않고 가용성을 떨어뜨려 잘 쓰지 않습니다.</li>
</ul>` },
{ id: "s6", chips: ["OS", "스레드", "장애"], case: true,
  q: `외부 브로커 API의 응답이 평소 50ms에서 3초로 느려졌습니다. Tomcat 최대 스레드는 200개이고, 이 API를 동기로 호출하는 엔드포인트에 초당 100건이 들어옵니다. 서버에 무슨 일이 생기는지 숫자로 설명하고, 대응책을 쓰세요.`,
  a: `<p>Little's Law: 동시 처리 중인 요청 = 처리량 × 지연. 평소 100 × 0.05s = <b>5개</b> 스레드면 충분하지만, 지금은 100 × 3s = <b>300개</b>가 필요합니다. 200개를 넘으므로 <b>스레드 풀이 고갈</b>되고 요청이 accept 큐에 쌓입니다.</p>
<ul>
<li>브로커와 상관없는 잔고 조회, 시세 API도 같은 스레드 풀을 쓰므로 함께 느려집니다. 외부 장애가 서비스 전체로 번지는 연쇄 장애입니다.</li>
<li>타임아웃: connect와 read 타임아웃을 따로, 짧게 둡니다. 3초를 기다리지 않고 실패시킵니다.</li>
<li>벌크헤드: 브로커 호출 전용 스레드 풀이나 세마포어로 동시 호출 수를 묶어, 나머지 API를 보호합니다.</li>
<li>서킷 브레이커: 실패율이 임계치를 넘으면 호출 자체를 끊고 빠르게 실패합니다.</li>
<li>failover: 토스증권 해외주식 사례처럼 실패 수를 감지해 서브 브로커로 전환합니다.</li>
<li>주의: 주문은 타임아웃이 "실패"가 아니라 "결과 모름"입니다. 재시도 전에 주문 상태를 조회해야 이중 주문을 막습니다.</li>
</ul>` },
{ id: "s7", chips: ["DB", "데드락"], case: false,
  q: `계좌 이체에서 A→B 이체와 B→A 이체가 동시에 실행되어 데드락이 났습니다. 원인을 데드락 4조건으로 설명하고, 애플리케이션 수준의 해결책을 쓰세요.`,
  a: `<ul>
<li>T1은 A 행 락을 잡고 B를 기다리고, T2는 B 행 락을 잡고 A를 기다립니다. 상호 배제, 점유 대기, 비선점, <b>순환 대기</b>가 모두 성립합니다.</li>
<li>InnoDB는 대기 그래프에서 순환을 감지하면 한쪽을 롤백합니다(오류 1213). 감지를 끈 환경에서는 <code>innodb_lock_wait_timeout</code>까지 기다립니다.</li>
<li><b>락 순서 고정:</b> 두 계좌 중 ID가 작은 쪽부터 <code>SELECT ... FOR UPDATE</code>합니다. 순환 대기 조건이 깨집니다.</li>
<li>트랜잭션을 짧게 유지하고, 외부 호출을 트랜잭션 안에 두지 않습니다.</li>
<li>데드락으로 롤백되면 정해진 횟수만큼 재시도합니다. 이때 요청은 멱등해야 합니다.</li>
</ul>` },
{ id: "s8", chips: ["네트워크", "TCP"], case: false,
  q: `외부 API를 호출하는 서버에서 <code>ss -tan</code>을 보니 TIME_WAIT 소켓이 수만 개입니다. TIME_WAIT가 왜 존재하는지, 무엇이 문제가 되는지, 어떻게 해결하는지 쓰세요.`,
  a: `<ul>
<li>연결을 먼저 끊은 쪽(active close)이 2MSL 동안 TIME_WAIT에 머뭅니다. 마지막 ACK가 유실되면 상대의 FIN에 다시 응답하고, 늦게 도착한 옛 세그먼트가 같은 4-튜플의 새 연결에 섞이지 않게 하려는 장치입니다.</li>
<li>요청마다 연결을 새로 열고 닫으면 쌓입니다. 같은 목적지 IP:port로는 로컬 ephemeral 포트(리눅스 기본 32768~60999, 약 2.8만 개)가 고갈되어 <code>connect</code>가 실패합니다.</li>
<li><b>해결: HTTP keep-alive와 커넥션 풀로 연결을 재사용</b>합니다. 3-way handshake와 TLS 핸드셰이크 비용(왕복 1~2회)도 함께 사라집니다.</li>
<li>보조: 클라이언트 측 <code>net.ipv4.tcp_tw_reuse</code>. <code>tcp_tw_recycle</code>은 NAT 환경 문제로 리눅스 4.12에서 제거되었습니다.</li>
</ul>` },
{ id: "s9", chips: ["캐시"], case: false,
  q: `인기 종목의 시세 캐시 TTL이 만료되는 순간 수천 개 요청이 동시에 원천 저장소로 몰려 장애가 났습니다. 이 현상의 이름과 대책을 쓰세요.`,
  a: `<p><b>Cache stampede</b>(thundering herd, dogpile)입니다.</p>
<ul>
<li>키당 한 요청만 갱신: 분산 락이나 singleflight로 한 요청만 원천을 읽고, 나머지는 잠깐 기다리거나 직전 값을 받습니다.</li>
<li>만료 전 갱신: 만료가 가까워지면 백그라운드로 미리 갱신합니다(확률적 조기 갱신 포함).</li>
<li>TTL에 jitter를 섞어 여러 키가 동시에 만료되지 않게 합니다.</li>
<li>시세처럼 변경 이벤트가 있는 데이터는 TTL에 기대지 않고, 이벤트가 올 때 캐시를 덮어쓰는 push 방식이 맞습니다.</li>
</ul>` },
{ id: "s10", chips: ["금액", "정밀도"], case: true,
  q: `금액 계산에 <code>double</code>을 쓰면 안 되는 이유와 대안을 쓰세요. 해외주식처럼 달러 금액과 환율이 끼면 무엇을 추가로 정해야 합니까?`,
  a: `<ul>
<li>이진 부동소수점은 0.1 같은 10진 소수를 정확히 표현하지 못합니다. <code>0.1 + 0.2 != 0.3</code>이고, 오차가 누적되면 원장 대사에서 1원 단위 불일치가 납니다.</li>
<li>원화는 <code>long</code>(원 단위 정수), 달러는 <code>BigDecimal</code>이나 최소 단위 정수(센트 또는 정한 소수 자릿수)를 씁니다.</li>
<li>BigDecimal은 <code>new BigDecimal(0.1)</code> 대신 문자열이나 <code>valueOf</code>로 만들고, 비교는 scale까지 보는 <code>equals</code> 대신 <code>compareTo</code>를 씁니다.</li>
<li>추가로 정할 것: <b>반올림 모드</b>(올림, 절사, HALF_UP, HALF_EVEN), <b>반올림 시점</b>(건별 후 합산인지 합산 후인지), 어느 시점의 환율을 적용하는지, 그리고 이 정책을 모든 서버가 같은 코드로 쓰는지.</li>
</ul>` },
{ id: "s11", chips: ["CQRS", "일관성"], case: true,
  q: `원본 DB와 읽기 전용 뷰 DB를 분리(CQRS)한 뒤 "매수 직후 보유 종목 화면에 방금 산 주식이 안 보인다"는 문의가 들어옵니다. 원인과 대응을 쓰고, 읽기 뷰가 원본과 어긋나지 않았는지 어떻게 검증할지 쓰세요.`,
  a: `<ul>
<li>읽기 뷰는 CDC나 이벤트로 <b>비동기 전파</b>되므로 지연 동안 read-your-writes가 깨집니다(eventual consistency).</li>
<li>대응: 쓰기 직후 일정 시간 또는 해당 사용자 요청은 원본에서 읽도록 라우팅합니다. 쓰기 응답에 버전(시퀀스)을 담고, 읽기 뷰가 그 버전에 도달하지 않았으면 원본으로 fallback합니다. 클라이언트에서 낙관적으로 먼저 반영하는 방법도 있습니다.</li>
<li>전파 지연을 지표로 보고 알람을 겁니다(Kafka lag, CDC 지연).</li>
<li>검증: 변경 이벤트마다 원본과 비교하는 실시간 검증기, 하루 단위로 전체 차이를 찾는 잔차(대사) 배치. 어긋나면 원본 기준으로 재적재합니다.</li>
</ul>
<p class="src">토스증권은 원본 Oracle + Vitess 읽기 뷰 구조에서 실시간 검증기와 매일 잔차 배치로 오염을 확인한다고 공개했습니다.</p>` },
{ id: "s12", chips: ["네트워크", "실시간"], case: true,
  q: `실시간 시세를 클라이언트에 보내는 방법으로 polling, long polling, SSE, WebSocket을 비교하세요. 시세 push에 SSE를 고를 근거는 무엇입니까?`,
  a: `<ul>
<li><b>Polling:</b> 단순하지만 변화가 없어도 요청이 오고, 지연은 최대 폴링 주기만큼입니다.</li>
<li><b>Long polling:</b> 변화가 생길 때 응답해 지연은 줄지만 응답마다 재요청합니다.</li>
<li><b>SSE:</b> HTTP 위의 서버 → 클라이언트 단방향 텍스트 스트림. 브라우저가 자동 재연결하고 <code>Last-Event-ID</code>로 이어 받습니다. 기존 HTTP 인프라(로드밸런서, 인증, 게이트웨이)를 그대로 씁니다. HTTP/1.1에서는 브라우저의 도메인당 연결 수 제한(보통 6개)에 걸리고, HTTP/2에서는 완화됩니다.</li>
<li><b>WebSocket:</b> 양방향, 바이너리 지원. 프로토콜 업그레이드가 필요하고 연결 상태 관리와 프록시 설정 부담이 더 큽니다.</li>
<li>시세는 서버 → 클라이언트 단방향이므로 SSE로 충분하고 운영이 단순합니다. 주문처럼 클라이언트가 보내는 요청은 일반 HTTP로 둡니다.</li>
</ul>
<p class="src">SLASH 24 「SSE 이벤트 푸쉬로 불필요한 Polling 제거하기」(토스증권).</p>` },
{ id: "s13", chips: ["OS", "메모리", "JVM"], case: false,
  q: `컨테이너 메모리 limit이 2GB인 Pod에 <code>-Xmx2g</code>로 JVM을 띄웠더니 <code>OutOfMemoryError</code> 로그 없이 재시작됩니다(exit code 137). 왜 그런지 쓰세요.`,
  a: `<ul>
<li>JVM 프로세스 메모리는 힙만이 아닙니다. 메타스페이스, 스레드 스택(스레드당 기본 1MB 예약), JIT 코드 캐시, GC 자료구조, Netty 같은 Direct buffer가 더해집니다.</li>
<li>힙을 limit만큼 잡으면 나머지 때문에 RSS가 cgroup limit을 넘고, <b>커널 OOM killer</b>가 SIGKILL을 보냅니다. 137 = 128 + 9(SIGKILL). JVM은 죽는 줄도 모르므로 OutOfMemoryError가 남지 않습니다.</li>
<li>대응: <code>-XX:MaxRAMPercentage</code>로 limit의 70~75% 정도만 힙에 주고, <code>-XX:NativeMemoryTracking=summary</code>로 힙 밖 사용량을 확인합니다.</li>
</ul>` },
{ id: "s14", chips: ["성능", "관측"], case: true,
  q: `API의 p50은 정상인데 p99만 주기적으로 튑니다. 원인 후보를 네 가지 이상 들고, 각각 어떻게 확인하는지 쓰세요.`,
  a: `<ul>
<li><b>GC pause:</b> GC 로그(<code>-Xlog:gc*</code>)의 pause 시각과 p99 스파이크 시각을 맞춰 봅니다. 주기적이면 1순위 후보입니다.</li>
<li><b>커넥션 풀 대기:</b> HikariCP의 pending 스레드 수, 커넥션 획득 시간 지표.</li>
<li><b>스레드 풀 큐잉이나 락 경합:</b> thread dump에서 BLOCKED, WAITING 스레드가 어디에 몰려 있는지 봅니다.</li>
<li><b>외부 의존 지연:</b> 분산 추적으로 느린 요청의 구간을 쪼개 봅니다.</li>
<li><b>CPU throttling:</b> 컨테이너 CPU quota 초과(<code>container_cpu_cfs_throttled</code>).</li>
<li><b>주기 작업:</b> 배치, 캐시 동시 만료, 로그 롤링 같은 크론성 작업과 시각을 대조합니다.</li>
</ul>
<p class="src">토스증권 서버 챕터 아티클의 모니터링 지표(에러 수, 스레드 고갈, API 실패율, Kafka lag)와 도구(Jaeger, Pinpoint, thread dump, tcpdump)를 그대로 답에 써도 좋습니다.</p>` },
{ id: "s15", chips: ["유량 제어"], case: true,
  q: `브로커는 초당 2,000건까지만 받습니다. 장 시작 직후 예약주문 100만 건을 보내야 합니다. 고정 윈도우, 슬라이딩 윈도우, 토큰 버킷의 차이를 쓰고 어떤 방식을 고를지, 전송에 몇 분이 걸리는지 쓰세요.`,
  a: `<ul>
<li><b>고정 윈도우:</b> 구현이 쉽지만 윈도우 경계에서 순간적으로 2배(4,000건)가 나갈 수 있습니다.</li>
<li><b>슬라이딩 윈도우:</b> 어느 1초 구간에서도 2,000건을 넘지 않아 정확하지만 기록을 더 들고 있어야 합니다.</li>
<li><b>토큰 버킷:</b> 평균 속도와 버스트 크기를 따로 정합니다. 상대 한도가 엄격하면 버킷을 작게 잡아 버스트를 없앱니다(leaky bucket처럼 평탄화).</li>
<li>상대 상한이 하드 리밋이므로 버스트 없는 방식 + 10~20% 여유 마진을 둡니다.</li>
<li>시간: 1,000,000 ÷ 2,000 = 500초, 약 <b>8분 20초</b>. 여유 마진 20%면 1,600 TPS로 약 10분 25초. 고객 입장에서는 접수 순서대로 나가야 공정하므로 순서를 보존하는 큐가 필요하고, 실시간 신규 주문과 같은 한도를 나눌지 정해야 합니다.</li>
</ul>
<p class="src">토스증권은 resilience4j RateLimiter를 쓰고 TPS를 배치 파라미터로 실행 시점에 주입했습니다.</p>` },
{ id: "s16", chips: ["DB", "격리수준"], case: false,
  q: `Dirty read, Non-repeatable read, Phantom read를 예로 설명하고, MySQL InnoDB의 REPEATABLE READ가 팬텀을 어떻게 다루는지 쓰세요.`,
  a: `<ul>
<li><b>Dirty read:</b> 커밋되지 않은 다른 트랜잭션의 값을 읽음. 그 트랜잭션이 롤백되면 없던 값을 본 셈입니다.</li>
<li><b>Non-repeatable read:</b> 같은 행을 두 번 읽었는데 그 사이 다른 트랜잭션이 수정·커밋해 값이 다름.</li>
<li><b>Phantom read:</b> 같은 범위 조건으로 두 번 읽었는데 그 사이 삽입된 행이 새로 보임.</li>
<li>InnoDB RR의 일반 SELECT(consistent read)는 트랜잭션 첫 읽기 시점의 MVCC 스냅샷을 보므로 팬텀이 보이지 않습니다.</li>
<li><code>SELECT ... FOR UPDATE</code> 같은 locking read는 최신 값을 읽고, <b>next-key lock</b>(레코드 락 + 갭 락)으로 범위에 새 행이 삽입되는 것을 막습니다.</li>
<li>예외: 스냅샷 읽기와 locking read를 섞으면 팬텀처럼 보이는 결과가 나올 수 있습니다. PostgreSQL RR은 snapshot isolation이라 write skew가 가능하고, SERIALIZABLE(SSI)에서 막습니다.</li>
</ul>` },
{ id: "s17", chips: ["Kafka", "이중화"], case: true,
  q: `데이터센터 장애로 Kafka 클러스터를 다른 센터로 전환합니다. 컨슈머 오프셋을 그대로 옮기면 안 되는 이유와, 오프셋을 변환할 때 "유실"과 "중복" 중 무엇을 허용해야 하는지 쓰세요.`,
  a: `<ul>
<li>미러링된 클러스터는 같은 메시지라도 오프셋 숫자가 다릅니다. 미러가 시작된 시점, 재시도, 삭제 정책에 따라 어긋나므로 숫자를 그대로 쓰면 건너뛰거나 다시 읽습니다.</li>
<li>방법 1: 원본 오프셋 ↔ 대상 오프셋 매핑을 주기적으로 기록하고, 현재 오프셋 이하의 가장 가까운 매핑으로 변환합니다. 정확히 일치하지 않으면 매핑 지점 바로 다음부터 읽습니다(MirrorMaker 2 방식). 유실은 없고 중복이 생깁니다.</li>
<li>방법 2: 커밋된 오프셋 레코드의 timestamp를 구해 대상 클러스터에서 <code>offsetsForTimes</code>로 찾습니다.</li>
<li><b>유실은 허용하지 않고, 중복은 허용</b>한 뒤 컨슈머 멱등성으로 흡수합니다. 계획된 전환이라면 쓰기를 멈추고 양쪽이 같아진 뒤 옮겨 중복까지 없앨 수 있습니다.</li>
</ul>
<p class="src">toss.tech 「Kafka 이중화 #3」: 재난 시 유실은 절대 불가, 중복은 최소화. 작업 시 중복과 유실 모두 없음.</p>` }
];
