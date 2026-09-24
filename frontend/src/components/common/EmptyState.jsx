import React from 'react';

export default function EmptyState({ icon = '🗂️', title = 'Nothing here yet', description, action }) {
  return (
    <div className="state-block">
      <div className="state-icon">{icon}</div>
      <div className="state-title">{title}</div>
      {description && <div className="state-desc">{description}</div>}
      {action}
    </div>
  );
}
