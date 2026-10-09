import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 sm:px-6">
      <PageHeader title="Page not found." />
      <Link href="/" className="text-[17px] text-accent hover:underline">
        Go home
      </Link>
    </main>
  );
}
