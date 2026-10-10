import java.lang.management.ManagementFactory;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

public class DeadlockDemo {
    static final Object account1 = new Object();
    static final Object account2 = new Object();
    static final CountDownLatch firstLocks = new CountDownLatch(2);
    static final CountDownLatch done = new CountDownLatch(2);

    static void transfer(boolean reversed, boolean ordered) {
        Object first = reversed && !ordered ? account2 : account1;
        Object second = reversed && !ordered ? account1 : account2;
        synchronized (first) {
            System.out.println(Thread.currentThread().getName()
                    + " acquired account " + (first == account1 ? 1 : 2));
            if (!ordered) {
                // Force both threads to hold their first lock before attempting the second.
                firstLocks.countDown();
                try {
                    firstLocks.await();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                }
            }
            synchronized (second) {
                System.out.println(Thread.currentThread().getName() + " completed transfer");
            }
        }
        done.countDown();
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 1 || !(args[0].equals("deadlock") || args[0].equals("ordered"))) {
            throw new IllegalArgumentException("Usage: DeadlockDemo.java deadlock|ordered");
        }
        boolean ordered = args[0].equals("ordered");
        Thread a = new Thread(() -> transfer(false, ordered), "A");
        Thread b = new Thread(() -> transfer(true, ordered), "B");
        // Daemon threads let this educational process exit even when deliberately deadlocked.
        a.setDaemon(true);
        b.setDaemon(true);
        a.start();
        b.start();
        if (ordered) {
            System.out.println("Both transfers completed: " + done.await(2, TimeUnit.SECONDS));
        }
        var bean = ManagementFactory.getThreadMXBean();
        long[] ids = bean.findDeadlockedThreads();
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(2);
        while (!ordered && ids == null && System.nanoTime() < deadline) {
            Thread.sleep(10);
            ids = bean.findDeadlockedThreads();
        }
        System.out.println("Deadlocked threads: " + (ids == null ? 0 : ids.length));
        if (ids != null) {
            for (var info : bean.getThreadInfo(ids, true, true)) {
                System.out.println(info.getThreadName() + " state=" + info.getThreadState()
                        + " waiting for lock held by " + info.getLockOwnerName());
            }
        }
        if (args.length > 1 && args[1].equals("dump")) {
            System.out.println("PID=" + ProcessHandle.current().pid());
            Thread.sleep(30000);
        }
    }
}
