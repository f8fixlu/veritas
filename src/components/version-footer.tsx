import pkg from "../../package.json";

function displayVersion(v: string): string {
  return v.replace(/^(\d+\.\d+)\.(\d+)$/, "$1$2");
}

export default function VersionFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 py-4 print:hidden">
      <p className="text-center text-xs text-slate-400">
        Veritas v{displayVersion(pkg.version)}
      </p>
    </footer>
  );
}