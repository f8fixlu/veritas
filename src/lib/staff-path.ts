export function staffBasePath(role: string): string {
  return role === "INSTRUCTOR" ? "/instructor" : "/admin";
}

export function staffPath(role: string, path: string): string {
  if (role !== "INSTRUCTOR") return path;
  return path.replace(/^\/admin(?=\/|$)/, "/instructor");
}
