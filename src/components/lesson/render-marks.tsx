import { Fragment, type ReactNode } from "react";

/** 【…】 marks an underlined part in a seed text. */
export function renderMarks(text: string): ReactNode[] {
  return text.split(/(【[^】]*】)/).map((part, i) =>
    part.startsWith("【") && part.endsWith("】") ? (
      <u key={i} className="decoration-2 underline-offset-4">
        {part.slice(1, -1)}
      </u>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}
