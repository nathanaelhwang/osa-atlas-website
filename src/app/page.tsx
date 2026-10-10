import type { Metadata } from "next";
import { AskBox } from "@/components/ask/AskBox";
import { HomeBackground } from "@/components/home/HomeBackground";

export const metadata: Metadata = {
  title: { absolute: "OSA Atlas" },
};

export default function Home() {
  return (
    <>
      <HomeBackground />
      <main className="relative z-10 flex min-h-[calc(100svh-48px)] flex-col items-center justify-center px-4 pb-[10svh] sm:px-6">
        <h1 className="text-center text-[40px] leading-[1.1] font-semibold tracking-[-0.025em] sm:text-[56px] sm:leading-[1.07]">
          Ask anything
        </h1>
        <AskBox large className="mt-8 max-w-[720px] sm:mt-10" />
      </main>
    </>
  );
}
