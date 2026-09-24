import React, { useRef, useState } from 'react';
import './common.css';

export default function FileUploader({ label = 'Upload file', accept, onFileSelected }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  function handleFiles(files) {
    const f = files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setError('File must be under 5MB'); return; }
    setError('');
    setFile(f);
    onFileSelected?.(f);
  }

  return (
    <div>
      <div
        className={`file-drop ${dragOver ? 'dragover' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        role="button"
        tabIndex={0}
      >
        <div>{label}</div>
        <div className="form-help">Drag & drop or click to browse</div>
        <input ref={inputRef} type="file" accept={accept} hidden onChange={(e) => handleFiles(e.target.files)} />
      </div>
      {error && <span className="form-error">{error}</span>}
      {file && (
        <div className="file-preview">
          <span>{file.name} · {(file.size / 1024).toFixed(0)} KB</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setFile(null)}>Remove</button>
        </div>
      )}
    </div>
  );
}
