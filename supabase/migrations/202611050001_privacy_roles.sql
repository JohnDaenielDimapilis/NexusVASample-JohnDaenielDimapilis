-- Enum values must commit before they are used by functions and policies in the next migration.
alter type public.account_role add value if not exists 'support_reviewer';
alter type public.account_role add value if not exists 'privacy_officer';
alter type public.account_role add value if not exists 'super_admin';
