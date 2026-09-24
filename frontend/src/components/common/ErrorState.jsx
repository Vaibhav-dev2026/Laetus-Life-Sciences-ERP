import React from 'react';

export default function ErrorState({ message = 'Something went wrong while loading this data.', onRetry }) {
  return (
    <div className="state-block">
      <div className="state-icon">⚠️</div>
      <div className="state-title">We hit a snag</div>
      <div className="state-desc">{message}</div>
      {onRetry && <button className="btn btn-secondary btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}
