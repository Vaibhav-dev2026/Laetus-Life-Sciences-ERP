import axiosClient from '../api/axiosClient';

/**
 * Reusable utility to download a binary file from the backend.
 * Automatically handles path normalization so leading '/api/' does not cause double /api/api paths.
 * Validates file headers and manages Blob URLs cleanly.
 *
 * @param {string} url - API endpoint URL
 * @param {string} filename - Filename to save as
 * @param {object} [params] - Query parameters
 * @returns {Promise<boolean>}
 */
export async function downloadFile(url, filename, params = {}) {
  try {
    let targetUrl = url || '';
    if (targetUrl.startsWith('/api/')) {
      targetUrl = targetUrl.substring(4);
    } else if (targetUrl.startsWith('api/')) {
      targetUrl = '/' + targetUrl.substring(4);
    }

    const response = await axiosClient.get(targetUrl, {
      responseType: 'blob',
      params,
      timeout: 60000,
    });

    if (!response.data || response.data.size === 0) {
      throw new Error('Server returned an empty file.');
    }

    const contentType = response.headers?.['content-type'] || response.data?.type || '';

    // Handle JSON error response wrapped in blob
    if (contentType.includes('application/json')) {
      const text = await response.data.text();
      let message = 'Export failed.';
      try {
        const parsed = JSON.parse(text);
        message = parsed.message || message;
      } catch (_) {
        if (text) message = text;
      }
      throw new Error(message);
    }

    // Determine filename extension based on returned content type
    const isHtmlFallback = contentType.includes('text/html');
    const finalFilename = (isHtmlFallback && filename.endsWith('.pdf')) ? filename.replace(/\.pdf$/i, '.html') : filename;
    const blob = new Blob([response.data], { type: contentType || 'application/pdf' });
    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.target = '_blank';
    link.download = finalFilename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      try {
        if (link.parentNode) link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      } catch (_) {}
    }, 15000);

    return true;
  } catch (err) {
    if (err.response && err.response.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        throw new Error(json.message || 'File download failed.');
      } catch (_) {
        throw new Error(`File download failed with status ${err.response.status}.`);
      }
    }

    if (err.request && !err.response) {
      throw new Error('Network error: Unable to connect to the server. Please check if the backend is running.');
    }

    throw new Error(err.message || 'File download failed.');
  }
}
