import java.util.ArrayList;
import java.util.List;

// javac -d /tmp/acestudy-process-demo notes/os/os.process.demo.java
// java -Xmx32m -cp /tmp/acestudy-process-demo MemoryLayoutDemo keep
// java -Xmx32m -cp /tmp/acestudy-process-demo MemoryLayoutDemo clear
// java -Xmx32m -XX:NativeMemoryTracking=summary -cp /tmp/acestudy-process-demo MemoryLayoutDemo memory
// 의도적으로 작은 힙에서 최대 64회만 실행하는 학습용 실험이다.
class MemoryLayoutDemo {
    static final int MIB = 1024 * 1024;
    static final List<byte[]> cache = new ArrayList<>();
    static byte[] retainedForInspection;

    static void handleRequest(boolean clearAfterRequest) {
        byte[] data = new byte[MIB];
        data[0] = 7;
        cache.add(data);
        data = null; // 지역 참조를 지워도 cache의 참조는 유지된다.
        if (clearAfterRequest) {
            cache.clear(); // 다른 참조가 없으므로 배열이 회수 대상이 된다.
        }
    }

    static void inspectMemory() throws Exception {
        retainedForInspection = new byte[16 * MIB];
        long pid = ProcessHandle.current().pid();
        System.out.println("heapMaxMiB=" + Runtime.getRuntime().maxMemory() / MIB
                + " retainedPayloadMiB=16 pid=" + pid);
        System.out.println("ps: PID RSS_KiB VSZ_KiB");
        new ProcessBuilder("ps", "-o", "pid=,rss=,vsz=", "-p", Long.toString(pid))
                .inheritIO().start().waitFor();
        Process nmt = new ProcessBuilder("jcmd", Long.toString(pid),
                "VM.native_memory", "summary", "scale=MB")
                .redirectErrorStream(true).start();
        try (var reader = nmt.inputReader()) {
            reader.lines().filter(line -> line.startsWith("Total:")
                    || line.matches(".*- +(?:Java Heap|Class|Thread|Code|GC|Metaspace) .*"))
                    .forEach(System.out::println);
        }
        if (nmt.waitFor() != 0) {
            throw new IllegalStateException("jcmd failed");
        }
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 1 || !(args[0].equals("keep") || args[0].equals("clear") || args[0].equals("memory"))) {
            throw new IllegalArgumentException("mode: keep | clear | memory");
        }
        if (args[0].equals("memory")) {
            inspectMemory();
            return;
        }
        boolean clearAfterRequest = args[0].equals("clear");
        int completed = 0;
        String outcome = "completed";
        int retained = 0;
        try {
            for (; completed < 64; completed++) {
                handleRequest(clearAfterRequest);
            }
            retained = cache.size();
        } catch (OutOfMemoryError error) {
            // 실패한 시점의 개수를 기록하고, 출력에 필요한 여유를 확보한다.
            // 이 catch는 실험 결과를 보여주기 위한 것이며 서버 복구 정책이 아니다.
            retained = cache.size();
            cache.clear();
            outcome = "OutOfMemoryError";
        }
        System.out.println("mode=" + args[0]
                + " heapMaxMiB=" + Runtime.getRuntime().maxMemory() / MIB
                + " completed=" + completed
                + " retainedArrays=" + retained
                + " outcome=" + outcome);
    }
}
