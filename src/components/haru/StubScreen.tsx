import { Mascot } from "@/components/mascot/Mascot";
import { TabBar } from "./TabBar";

export function StubScreen({ title, admin = false }: { title: string; admin?: boolean }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[390px] flex-col items-center justify-center bg-paper px-6 pb-[calc(var(--tabbar-h)+2rem)] text-center">
      <Mascot mood="reading" className="mb-5 h-20 w-20" />
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-2 max-w-[260px] text-sm leading-6 text-ink-2">
        Màn hình này đã sẵn đường dẫn và sẽ được hoàn thiện ở bước tiếp theo.
      </p>
      {!admin && <TabBar />}
    </main>
  );
}
