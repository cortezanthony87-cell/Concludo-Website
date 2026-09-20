-- Bridges the naming mismatch between migration 17 and migrations 18 to 23.
-- Migration 17 defines is_organization_member and get_organization_role.
-- Migrations 18 to 23 call is_org_member and is_org_admin, which were never defined.

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT public.is_organization_member(p_org_id, p_user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT public.get_organization_role(p_org_id, p_user_id)
           IN ('organization_owner', 'organization_admin')
$$;

GRANT EXECUTE ON FUNCTION public.is_org_member(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_admin(UUID, UUID) TO authenticated, service_role;
