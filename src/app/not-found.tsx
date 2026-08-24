import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
        V
      </span>
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">
        Page not found
      </h1>
      <p className="text-sm text-slate-500">
        The page you are looking for does not exist or is not available.
      </p>
      <Link href="/" className="btn btn-primary mt-2">
        Go home
      </Link>
    </main>
  );
}
