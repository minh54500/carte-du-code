CREATE TABLE IF NOT EXISTS "public"."orders" ("id" bigint NOT NULL);
ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read" ON "public"."orders" FOR SELECT TO "authenticated" USING (true);
CREATE OR REPLACE FUNCTION "public"."order_count"() RETURNS bigint LANGUAGE "sql" AS $$ select count(*) from "public"."orders" $$;
ALTER FUNCTION "public"."order_count"() SECURITY DEFINER;
