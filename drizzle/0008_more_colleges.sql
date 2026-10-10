-- Three well-known campuses so the live map isn't empty. Skipped if a bubble with the same slug already exists.
INSERT INTO "bubbles" ("slug", "name", "description", "kind", "lat", "lng", "county_fips", "county_name", "state_name", "is_official")
VALUES
  ('alabama', 'Alabama', 'University of Alabama', 'CAMPUS', 33.2140, -87.5391, '01125', 'Tuscaloosa', 'Alabama', true),
  ('ohio-state', 'Ohio State', 'The Ohio State University', 'CAMPUS', 40.0076, -83.0300, '39049', 'Franklin', 'Ohio', true),
  ('michigan', 'Michigan', 'University of Michigan', 'CAMPUS', 42.2780, -83.7382, '26161', 'Washtenaw', 'Michigan', true)
ON CONFLICT ("slug") DO NOTHING;
