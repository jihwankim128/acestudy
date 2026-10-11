\set ON_ERROR_STOP on
SELECT version();
CREATE TABLE customers (id integer PRIMARY KEY, name text NOT NULL);
CREATE TABLE orders (id integer PRIMARY KEY, customer_id integer NOT NULL);
INSERT INTO customers SELECT g, 'customer-' || g FROM generate_series(1, 10000) g;
INSERT INTO orders SELECT g, (g * 7919 % 10000) + 1 FROM generate_series(1, 30000) g;
CREATE INDEX orders_customer_idx ON orders(customer_id);
ANALYZE customers;
ANALYZE orders;

\echo '1. Small outer input: default planner'
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT o.id, c.name FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id <= 10;

\echo '2. Full join: default planner'
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT o.id, c.name FROM orders o JOIN customers c ON c.id = o.customer_id;

\echo '3. Merge join: alternatives discouraged ONLY for this teaching transaction'
BEGIN;
SET LOCAL enable_hashjoin = off;
SET LOCAL enable_nestloop = off;
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT o.id, c.name FROM orders o JOIN customers c ON c.id = o.customer_id;
ROLLBACK;

\echo '4. Duplicate orders, unique customers: four output rows'
SELECT o.id AS order_id, o.customer_id, c.name
FROM (VALUES (1,2), (2,4), (3,4), (4,9)) AS o(id,customer_id)
JOIN customers c ON c.id = o.customer_id
ORDER BY o.id;

\echo '5. IN + covering index can be combined'
CREATE INDEX customers_id_name_idx ON customers(id) INCLUDE(name);
VACUUM ANALYZE customers;
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT id, name FROM customers WHERE id IN (2, 4, 9);

\echo '6. Unsorted inputs: PostgreSQL sorts both sides before merging'
BEGIN;
SET LOCAL enable_hashjoin = off;
SET LOCAL enable_nestloop = off;
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT o.id, c.name
FROM (VALUES (1,9), (2,4), (3,2), (4,4)) AS o(id,customer_id)
JOIN (VALUES (7,'customer-7'), (2,'customer-2'), (9,'customer-9'),
             (1,'customer-1'), (4,'customer-4')) AS c(id,name)
ON c.id = o.customer_id;
ROLLBACK;
