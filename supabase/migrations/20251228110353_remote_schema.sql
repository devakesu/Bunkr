alter table "public"."tracker" add column "attendance" numeric not null default '110'::numeric;

alter table "public"."tracker" add column "remarks" text;

alter table "public"."tracker" add column "status" text default 'correction'::text;

alter table "public"."tracker" add constraint "tracker_status_check" CHECK ((status = ANY (ARRAY['correction'::text, 'extra'::text]))) not valid;

alter table "public"."tracker" validate constraint "tracker_status_check";


