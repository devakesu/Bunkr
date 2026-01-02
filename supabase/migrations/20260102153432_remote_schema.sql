CREATE INDEX idx_tracker_username ON public.tracker USING btree (username);

CREATE UNIQUE INDEX tracker_unique_session ON public.tracker USING btree (username, date, course, session);


