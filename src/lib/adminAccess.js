export const hasAdminClaim = (tokenResult) => tokenResult?.claims?.admin === true;

export function resolveAdminRoute({ loading, admin }) {
  if (loading) return "loading";
  return admin ? "allowed" : "denied";
}
