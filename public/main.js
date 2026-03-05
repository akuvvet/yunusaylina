const fileInput = document.getElementById('file-input');
const fileDrop = document.getElementById('file-drop');
const uploadButton = document.getElementById('upload-button');
const uploadStatus = document.getElementById('upload-status');
const selectedPreview = document.getElementById('selected-preview');
const gallery = document.getElementById('gallery');
const emptyState = document.getElementById('empty-state');
const refreshButton = document.getElementById('refresh-button');
const downloadSelectedButton = document.getElementById('download-selected');
const uploaderInput = document.getElementById('uploader-name');

let selectedFiles = [];
let gallerySelection = new Set();

function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function setUploadStatus(message, isError = false) {
  uploadStatus.textContent = message;
  uploadStatus.classList.toggle('error', isError);
}

function renderSelectedPreview() {
  selectedPreview.innerHTML = '';

  if (!selectedFiles.length) {
    uploadButton.disabled = true;
    return;
  }

  uploadButton.disabled = false;

  selectedFiles.forEach((file, index) => {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    const card = document.createElement('article');
    card.className = 'card';

    const media = document.createElement('div');
    media.className = 'card-media';

    if (isImage) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.alt = file.name;
      img.onload = () => URL.revokeObjectURL(img.src);
      media.appendChild(img);
    } else if (isVideo) {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.autoplay = true;
      video.onloadeddata = () => URL.revokeObjectURL(video.src);
      media.appendChild(video);
    } else {
      const placeholder = document.createElement('div');
      placeholder.style.width = '100%';
      placeholder.style.height = '100%';
      placeholder.style.display = 'flex';
      placeholder.style.alignItems = 'center';
      placeholder.style.justifyContent = 'center';
      placeholder.style.color = '#9ca3af';
      placeholder.textContent = 'Datei';
      media.appendChild(placeholder);
    }

    const badge = document.createElement('span');
    badge.className = 'card-badge';
    badge.textContent = isImage ? 'Bild' : isVideo ? 'Video' : 'Datei';
    media.appendChild(badge);

    const footer = document.createElement('div');
    footer.className = 'card-footer';

    const meta = document.createElement('div');

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = file.name;

    const size = document.createElement('div');
    size.className = 'card-meta';
    size.textContent = formatSize(file.size);

    meta.appendChild(title);
    meta.appendChild(size);
    footer.appendChild(meta);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn ghost';
    removeBtn.style.padding = '4px 8px';
    removeBtn.style.fontSize = '0.75rem';
    removeBtn.textContent = 'Entfernen';
    removeBtn.addEventListener('click', () => {
      selectedFiles.splice(index, 1);
      renderSelectedPreview();
    });

    footer.appendChild(removeBtn);

    card.appendChild(media);
    card.appendChild(footer);
    selectedPreview.appendChild(card);
  });
}

function handleFiles(files) {
  const array = Array.from(files || []);
  if (!array.length) return;

  const allowed = array.filter((file) => {
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) return true;

    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
    const videoExts = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
    const ext = file.name.split('.').pop();
    if (!ext) return false;
    const lowerExt = `.${ext.toLowerCase()}`;
    return imageExts.includes(lowerExt) || videoExts.includes(lowerExt);
  });

  if (!allowed.length) {
    setUploadStatus('Keine unterstützten Dateien ausgewählt.', true);
    return;
  }

  setUploadStatus('');
  selectedFiles = allowed;
  renderSelectedPreview();
}

fileInput.addEventListener('change', (event) => {
  handleFiles(event.target.files);
});

['dragenter', 'dragover'].forEach((eventName) => {
  fileDrop.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    fileDrop.classList.add('drag-over');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  fileDrop.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    fileDrop.classList.remove('drag-over');
  });
});

fileDrop.addEventListener('drop', (event) => {
  handleFiles(event.dataTransfer.files);
});



async function uploadSelectedFiles() {
  if (!selectedFiles.length) return;

  const formData = new FormData();
  const uploaderValue = uploaderInput ? uploaderInput.value.trim() : '';

  if (uploaderValue) {
    formData.append('uploader', uploaderValue);
  }

  selectedFiles.forEach((file) => {
    formData.append('files', file);
  });

  setUploadStatus('Lade hoch …');
  uploadButton.disabled = true;

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload fehlgeschlagen: ${response.status}`);
    }

    await response.json();
    setUploadStatus('Upload erfolgreich!');
    selectedFiles = [];
    renderSelectedPreview();
    await loadGallery();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    setUploadStatus('Upload fehlgeschlagen. Bitte erneut versuchen.', true);
  } finally {
    fileInput.value = '';
  }
}

uploadButton.addEventListener('click', uploadSelectedFiles);

async function loadGallery() {
  try {
    const response = await fetch('/api/files');
    if (!response.ok) {
      throw new Error(`Fehler beim Laden: ${response.status}`);
    }

    const data = await response.json();
    const files = data.files || [];

    gallery.innerHTML = '';
    gallerySelection = new Set();
    downloadSelectedButton.disabled = true;

    if (!files.length) {
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    files.forEach((file) => {
      const card = document.createElement('article');
      card.className = 'card';

      const media = document.createElement('div');
      media.className = 'card-media';

      if (file.type === 'image') {
        const img = document.createElement('img');
        img.src = file.url;
        img.alt = file.originalName || file.id;
        media.appendChild(img);
      } else if (file.type === 'video') {
        const video = document.createElement('video');
        video.src = file.url;
        video.controls = true;
        video.playsInline = true;
        media.appendChild(video);
      } else {
        const placeholder = document.createElement('div');
        placeholder.style.width = '100%';
        placeholder.style.height = '100%';
        placeholder.style.display = 'flex';
        placeholder.style.alignItems = 'center';
        placeholder.style.justifyContent = 'center';
        placeholder.style.color = '#9ca3af';
        placeholder.textContent = 'Datei';
        media.appendChild(placeholder);
      }

      const badge = document.createElement('span');
      badge.className = 'card-badge';
      badge.textContent = file.type === 'image' ? 'Bild' : file.type === 'video' ? 'Video' : 'Datei';
      media.appendChild(badge);

      const footer = document.createElement('div');
      footer.className = 'card-footer';

      const meta = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'card-title';
      title.textContent = file.originalName || file.id;

      const info = document.createElement('div');
      info.className = 'card-meta';
      const infoParts = [];
      if (file.uploader) infoParts.push(file.uploader);
      if (file.uploadedAt) infoParts.push(formatDateTime(file.uploadedAt));
      info.textContent = infoParts.join(' • ');

      const size = document.createElement('div');
      size.className = 'card-meta';
      size.textContent = file.size != null ? formatSize(file.size) : '';

      meta.appendChild(title);
      if (info.textContent) {
        meta.appendChild(info);
      }
      if (size.textContent) {
        meta.appendChild(size);
      }
      footer.appendChild(meta);

      const selectWrapper = document.createElement('label');
      selectWrapper.className = 'card-select';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          gallerySelection.add(file.id);
        } else {
          gallerySelection.delete(file.id);
        }
        downloadSelectedButton.disabled = gallerySelection.size === 0;
      });

      const selectText = document.createElement('span');
      selectText.textContent = 'Auswählen';

      selectWrapper.appendChild(checkbox);
      selectWrapper.appendChild(selectText);
      footer.appendChild(selectWrapper);

      card.appendChild(media);
      card.appendChild(footer);
      gallery.appendChild(card);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }
}

refreshButton.addEventListener('click', () => {
  loadGallery();
});

function downloadSelected() {
  gallerySelection.forEach((id) => {
    const link = document.createElement('a');
    link.href = `/uploads/${encodeURIComponent(id)}`;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

downloadSelectedButton.addEventListener('click', downloadSelected);

loadGallery();

