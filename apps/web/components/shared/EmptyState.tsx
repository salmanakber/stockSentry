import type { ReactNode } from "react";
import { Icon } from "../IconSprite";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: string;
  action?: ReactNode;
}

export function EmptyState({
  title,
  description,
  icon = "in",
  action,
}: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="empty-ic">
        <Icon id={icon} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div className="empty-act">{action}</div> : null}
    </div>
  );
}
