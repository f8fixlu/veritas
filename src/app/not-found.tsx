import Image from "next/image";
import { ButtonLink } from "@/app/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <Image
        src="/icons/veritas-current-192.png"
        alt=""
        width={44}
        height={44}
        className="h-11 w-11 rounded-xl object-cover"
      />
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">
        Page not found
      </h1>
      <p className="text-sm text-slate-500">
        The page you are looking for does not exist or is not available.
      </p>
      <ButtonLink href="/" variant="primary" className="mt-2">
        Go home
      </ButtonLink>
    </main>
  );
}
