import type { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  reveal?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  reveal = true,
}: PageHeaderProps) {
  return (
    <div className={`head${reveal ? " rv" : ""}`}>
      <div>
        <h1>{title}</h1>
        {subtitle ? <div className="sub">{subtitle}</div> : null}
      </div>
      {actions ? <div className="btns">{actions}</div> : null}
    </div>
  );
}
