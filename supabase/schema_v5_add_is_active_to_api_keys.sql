-- Migration: Add is_active column to api_keys table

ALTER TABLE api_keys ADD COLUMN is_active boolean DEFAULT true;
