-- Run the whole file once in Neon SQL Editor (Dashboard → SQL Editor → paste → Run).

CREATE OR REPLACE FUNCTION public.get_random_sites(lim int)
RETURNS setof text
LANGUAGE sql
VOLATILE
AS $$
  WITH sample AS (
    SELECT url, score, random() AS r FROM sites TABLESAMPLE BERNOULLI(1)
  ),
  top AS (
    SELECT url FROM sample ORDER BY score DESC LIMIT (lim / 2)
  ),
  rest AS (
    SELECT url FROM sample
    WHERE url NOT IN (SELECT url FROM top)
    ORDER BY r
    LIMIT (lim - lim / 2)
  )
  SELECT url FROM top
  UNION ALL
  SELECT url FROM rest;
$$;
