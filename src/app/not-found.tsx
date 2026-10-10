import Link from "next/link";
export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <div className="text-5xl">🦆</div>
      <h1 className="h1 mt-2">Out for a duck</h1>
      <p className="mt-1 muted">We couldn&apos;t find that page.</p>
      <Link href="/" className="btn-primary mt-4">Back to today</Link>
    </div>
  );
}
