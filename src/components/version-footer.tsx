import pkg from "../../package.json";

export default function VersionFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 py-4 print:hidden">
      <p className="text-center text-xs text-slate-400">
        Veritas v{pkg.version}
      </p>
    </footer>
  );
}