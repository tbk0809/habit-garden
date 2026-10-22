-- Runs only on first creation of this project's local volume.
\getenv runtime_password RUNTIME_PASSWORD
CREATE ROLE habit_garden_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD :'runtime_password';
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
