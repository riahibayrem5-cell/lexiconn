import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAdminSettings, type PageKey } from "@/lib/adminSettings";

interface Props {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, right }: Props) {
  const { pathname } = useLocation();
  const { settings } = useAdminSettings();
  const copy = settings.pages[pathname as PageKey];
  const renderedEyebrow = copy?.eyebrow ?? eyebrow;
  const renderedTitle = copy ? <>{copy.title} <em className="font-display italic text-primary/90">{copy.emphasis}</em></> : title;
  const renderedSubtitle = copy?.subtitle ?? subtitle;
  return (
    <header className="relative px-4 sm:px-8 lg:px-14 pt-12 pb-8 border-b border-border/60">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          {renderedEyebrow && (
            <div className="flex items-center gap-3 mb-3">
              <span className="h-px w-8 bg-primary/60" />
              <span className="eyebrow">{renderedEyebrow}</span>
            </div>
          )}
          <h1 className="font-display text-5xl md:text-6xl text-foreground leading-[0.95]">
            {renderedTitle}
          </h1>
          {renderedSubtitle && (
            <p className="mt-3 font-serif italic text-muted-foreground max-w-xl">
              {renderedSubtitle}
            </p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      <div className="gold-rule mt-8" />
    </header>
  );
}
