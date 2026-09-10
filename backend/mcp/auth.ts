import { UserContext } from "./manifest";

export function hasPermissions(
  userCtx: UserContext,
  requiredPermissions: string[],
): boolean {
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }
  const userPermSet = new Set(userCtx.permissions);
  return requiredPermissions.every((perm) => userPermSet.has(perm));
}
