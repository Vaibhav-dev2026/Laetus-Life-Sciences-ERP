import React, { useEffect, useRef, useState } from 'react';
import './common.css';

export default function Dropdown({ trigger, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div className="dropdown" ref={ref}>
      <span onClick={() => setOpen((o) => !o)}>{trigger}</span>
      {open && <div className="dropdown-menu" onClick={() => setOpen(false)}>{children}</div>}
    </div>
  );
}
