-- Run the whole file once in Neon SQL Editor (Dashboard → SQL Editor → paste → Run).

CREATE OR REPLACE FUNCTION public.get_random_sites(lim int)
RETURNS setof text
LANGUAGE sql
VOLATILE
AS $$
  WITH total AS (
    SELECT count(*)::int AS n FROM sites WHERE score >= 0
  ),
  r AS (
    SELECT floor(random() * greatest(0, (SELECT n FROM total) - lim))::int AS off
  )
  SELECT url FROM sites
  WHERE score >= 0
  ORDER BY ctid
  OFFSET (SELECT off FROM r)
  LIMIT lim;
$$;
