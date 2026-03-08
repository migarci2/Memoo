import Link from 'next/link';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/ssr';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--app-bg)] px-6 text-center">
      <span className="mb-4 text-[var(--app-muted)] inline-flex">
        <MagnifyingGlass size={56} weight="regular" />
      </span>
      <span className="font-mono text-8xl font-extrabold leading-none text-[var(--app-chip)]">
        404
      </span>
      <h1 className="mt-4 text-3xl font-extrabold">Page not found</h1>
      <p className="mt-2 max-w-[34ch] text-[var(--app-muted)]">
        The page you are looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/" className="btn-primary mt-8 inline-block rounded-full px-6 py-2.5 font-semibold">
        Go home
      </Link>
    </div>
  );
}
