/**
 * Andromeda Studio 2026 — Playground Engine v2.7
 * Integrated Manual Studio Module + Biometric Background Rendering
 */
const Andromeda = {
    // ─── State ───
    currentFile: null,
    resultBlob: null,
    resultBlobUrl: null,
    cropper: null,
    currentBgColor: 'transparent',

    // ─── Initialize ───
    init() {
        this.cacheDOM();
        this.bindEvents();
        this.startEngineStatusPolling();
        this.log('idle', 'radio_button_checked', 'Studio initialized. Ready for input.');
    },

    cacheDOM() {
        this.uploadInput     = document.getElementById('image-upload');
        this.uploadTrigger   = document.getElementById('upload-trigger');
        this.fileNameDisplay = document.getElementById('file-name-display');
        this.processBtn      = document.getElementById('process-btn');
        this.dropZone        = document.getElementById('drop-zone');
        this.previewContainer= document.getElementById('preview-container');
        this.previewImage    = document.getElementById('preview-image');
        this.viewportCanvas  = document.getElementById('viewport-canvas');
        this.viewportCtx     = this.viewportCanvas.getContext('2d');
        this.checkerLayer    = document.getElementById('checker-layer');

        this.scanLine        = document.getElementById('scan-line');
        this.processingOverlay = document.getElementById('processing-overlay');
        this.processingText  = document.getElementById('processing-text');
        this.statusLogger    = document.getElementById('status-logger');
        this.downloadBtn     = document.getElementById('download-btn');
        this.canvasWrapper   = document.getElementById('canvas-wrapper');
        this.statusIcon      = document.getElementById('status-icon');

        // Custom Dropdown
        this.dropdownTrigger = document.getElementById('dropdown-trigger-btn');
        this.dropdownMenu    = document.getElementById('dropdown-menu');
        this.ratioLabel      = document.getElementById('selected-ratio-label');
        this.dropdownItems   = document.querySelectorAll('.dropdown-item');

        // Studio Module DOM
        this.editBtn         = document.getElementById('edit-btn');
        this.editControls    = document.getElementById('edit-controls');
        this.ratioSelector   = document.getElementById('ratio-selector'); // Hidden select
        this.saveCropBtn     = document.getElementById('save-crop-btn');

        // Info chips
        this.infoDimensions  = document.getElementById('info-dimensions');
        this.infoSize        = document.getElementById('info-size');
        this.infoFormat      = document.getElementById('info-format');

    },

    bindEvents() {
        this.uploadInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));
        this.processBtn.addEventListener('click', () => this.handleProcess());

        // Drag-and-drop
        const dz = this.canvasWrapper;
        dz.addEventListener('dragover',  (e) => { e.preventDefault(); this.dropZone.classList.add('drag-over'); });
        dz.addEventListener('dragleave', ()  => { this.dropZone.classList.remove('drag-over'); });
        dz.addEventListener('drop',      (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) this.handleFileSelect(file);
        });

        this.dropZone.addEventListener('click', () => this.uploadInput.click());

        // Custom Dropdown Events
        this.dropdownTrigger.addEventListener('click', () => {
            this.dropdownMenu.classList.toggle('open');
        });

        this.dropdownItems.forEach(item => {
            item.addEventListener('click', () => {
                const value = item.dataset.value;
                this.handleDropdownSelect(value, item);
                this.dropdownMenu.classList.remove('open');
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.dropdownTrigger.contains(e.target) && !this.dropdownMenu.contains(e.target)) {
                this.dropdownMenu.classList.remove('open');
            }
        });

        // Studio Module Events
        this.editBtn.addEventListener('click', () => this.toggleEditMode());
        this.saveCropBtn.addEventListener('click', () => this.saveCrop());

    },

    // ─── File Selection ───
    handleFileSelect(file) {
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) return this.log('error', 'error', 'File too large. Max 20MB.');

        this.currentFile = file;
        this.fileNameDisplay.textContent = file.name;
        this.processBtn.disabled = false;
        
        // IMMEDIATE VISIBILITY FIX: Hide empty state now
        this.dropZone.classList.add('hidden');
        this.previewContainer.classList.remove('hidden');

        // Reset Studio actions
        this.editBtn.classList.add('hidden');
        this.downloadBtn.classList.add('hidden');
        this.editControls.classList.add('hidden');
        this.currentBgColor = 'transparent';
        this.checkerLayer.style.backgroundColor = 'transparent';
        this.checkerLayer.classList.remove('transparency-grid');
        this.previewImage.style.clipPath = 'none';
        this.destroyCropper();



        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            this.updateImageSource(dataUrl);
            
            const img = new Image();
            img.onload = () => {
                this.renderToViewport(img);
                this.updateInfoChips(file);
                
                // Point 1 Fix: Show buttons immediately after upload
                this.editBtn.classList.remove('hidden');
                this.downloadBtn.classList.remove('hidden');
                this.downloadBtn.href = dataUrl;
                
                this.log('info', 'check_circle', `Studio loaded: ${file.name} (${img.naturalWidth}x${img.naturalHeight})`);
            };
            img.src = dataUrl;

        };
        reader.readAsDataURL(file);
    },

    renderToViewport(img) {
        // High-res canvas setup
        this.viewportCanvas.width = img.naturalWidth;
        this.viewportCanvas.height = img.naturalHeight;
        this.viewportCtx.clearRect(0, 0, this.viewportCanvas.width, this.viewportCanvas.height);
        this.viewportCtx.drawImage(img, 0, 0);
        
        this.viewportCanvas.classList.remove('hidden');
        this.previewImage.classList.add('hidden');
    },





    // ─── Background Removal ───
    async handleProcess() {
        if (!this.currentFile) return;

        this.lockUI(true, 'Extracting Segments...');
        this.log('working', 'pending', 'Sending to Biometric Analysis Engine...');

        const formData = new FormData();
        formData.append('file', this.currentFile);

        try {
            const response = await fetch('/remove-bg', { method: 'POST', body: formData });
            if (!response.ok) throw new Error(`Engine Connection Failed`);

            this.log('working', 'auto_awesome', 'Applying transparent mask...');
            const blob = await response.blob();
            this.resultBlob = blob;
            this.resultBlobUrl = URL.createObjectURL(blob);

            // Bypass wave-wipe, show instantly over checkerboard
            const img = new Image();
            img.onload = () => {
                this.renderToViewport(img);
                this.checkerLayer.classList.add('transparency-grid');
                this.checkerLayer.style.backgroundColor = ''; // Clear inline to allow CSS class color

            };
            img.src = this.resultBlobUrl;

            this.updateImageSource(this.resultBlobUrl);
            this.previewImage.style.clipPath = 'none';
            this.previewContainer.classList.remove('scanning');

            this.downloadBtn.href = this.resultBlobUrl;

            
            this.lockUI(false);
            this.log('success', 'check_circle', 'Background cleared. Studio session ready.');


        } catch (err) {
            this.lockUI(false);
            this.log('error', 'error', err.message);
        }
    },

    // ─── Studio Edit Logic ───
    toggleEditMode() {
        if (!this.cropper) {
            this.editBtn.innerHTML = '<span class="material-symbols-outlined">close</span><span>Cancel</span>';
            this.editControls.classList.remove('hidden');
            
            // Switch to Image mode for Cropper
            this.viewportCanvas.classList.add('hidden');
            this.previewImage.classList.remove('hidden');
            
            this.initCropper();
            this.log('info', 'brush', 'Studio cropper initialized.');
            this.applyRatio(this.ratioSelector.value);
        } else {
            this.editBtn.innerHTML = '<span class="material-symbols-outlined">crop</span><span>Edit</span>';
            this.editControls.classList.add('hidden');
            
            // Revert to Canvas mode
            this.viewportCanvas.classList.remove('hidden');
            this.previewImage.classList.add('hidden');
            
            this.destroyCropper();
            this.log('info', 'close', 'Studio edit session closed.');
        }
    },


    initCropper() {
        this.destroyCropper();
        this.cropper = new Cropper(this.previewImage, {
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 1.0, // Match canvas exactly
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
            responsive: true,
            aspectRatio: NaN,
        });
    },

    applyRatio(value) {
        if (!this.cropper) return;
        
        const selectedOption = this.ratioSelector.selectedOptions[0];
        const bgColor = selectedOption.dataset.bg || 'transparent';
        const ratioText = selectedOption.dataset.ratio || 'NaN';
        const ratio = parseFloat(ratioText);
        
        this.currentBgColor = bgColor;
        
        // Handle Background Visuals - State Transition
        if (bgColor === 'transparent') {
            this.checkerLayer.classList.add('transparency-grid');
            this.checkerLayer.style.backgroundColor = ''; // Clear inline to allow CSS class color
        } else {

            this.checkerLayer.classList.remove('transparency-grid');
            this.checkerLayer.style.backgroundColor = bgColor;
        }

        // Handle Cropper Ratio
        this.cropper.setAspectRatio(isNaN(ratio) ? NaN : ratio);
        
        const modeLabel = isNaN(ratio) ? 'Free/Custom Mode' : 'Biometric Standard Lock';
        this.log('info', 'settings_overscan', `${modeLabel}: Color set to ${bgColor}`);
    },

    saveCrop() {
        if (!this.cropper) return;

        this.log('working', 'download_done', 'Baking layers into final export...');
        
        const canvasOptions = {
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high'
        };

        // Flatten ONLY if country is selected
        if (this.currentBgColor !== 'transparent') {
            canvasOptions.fillColor = this.currentBgColor;
        }

        const canvas = this.cropper.getCroppedCanvas(canvasOptions);
        
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            this.resultBlob = blob;
            this.resultBlobUrl = url;
            
            this.updateImageSource(url);
            this.downloadBtn.href = url;
            
            // Post-save cleanup
            this.destroyCropper();
            this.editControls.classList.add('hidden');
            this.editBtn.innerHTML = '<span class="material-symbols-outlined">crop</span><span>Edit</span>';
            
            this.updateInfoChips(blob);
            this.log('success', 'verified_user', `Studio export finalized: ${this.currentBgColor === 'transparent' ? 'Transparent' : 'Flattened'}.`);
        }, 'image/png');
    },


    destroyCropper() {
        if (this.cropper) {
            this.cropper.destroy();
            this.cropper = null;
        }
    },

    // ─── Utilities ───
    updateImageSource(src) {
        this.previewImage.src = src;
    },


    handleDropdownSelect(value, itemEl) {

        // Update selection state
        this.dropdownItems.forEach(i => i.classList.remove('active'));
        itemEl.classList.add('active');
        this.ratioLabel.textContent = itemEl.textContent;
        
        // Sync with hidden select
        this.ratioSelector.value = value;
        this.applyRatio(value);
    },


    updateInfoChips(blobOrFile) {
        const img = new Image();
        img.onload = () => {
            this.setInfoChip(this.infoDimensions, 'aspect_ratio', `${img.width} × ${img.height}`);
        };
        img.src = (blobOrFile instanceof Blob || blobOrFile instanceof File) ? URL.createObjectURL(blobOrFile) : blobOrFile;



        this.setInfoChip(this.infoSize, 'data_usage', this.formatBytes(blobOrFile.size || 0));
        const format = this.currentBgColor === 'transparent' ? 'PNG (Alpha)' : 'PNG (Flattened)';
        this.setInfoChip(this.infoFormat, 'photo_size_select_actual', format);
    },

    lockUI(isLocked, message = '') {
        this.processBtn.disabled = isLocked;
        this.processingOverlay.classList.toggle('hidden', !isLocked);
        if (message) this.processingText.textContent = message;
    },

    log(type, icon, message) {
        if (!this.statusLogger) return;
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        entry.innerHTML = `<span class="material-symbols-outlined log-icon">${icon}</span><span>${message}</span>`;
        this.statusLogger.appendChild(entry);
        this.statusLogger.scrollTop = this.statusLogger.scrollHeight;
        while (this.statusLogger.children.length > 20) this.statusLogger.removeChild(this.statusLogger.firstChild);
    },

    formatBytes(bytes) {
        if (!bytes) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },

    setInfoChip(el, icon, text) {
        el.innerHTML = `<span class="material-symbols-outlined">${icon}</span><span>${text}</span>`;
    },

    // ─── Engine Status Polling ───
    startEngineStatusPolling() {
        if (!this.statusIcon) return;
        
        const fetchStatus = async () => {
            try {
                const response = await fetch('/status');
                if (response.ok) {
                    const data = await response.json();
                    if (data.mode === 'cloud') {
                        this.statusIcon.classList.remove('local-mode');
                        this.statusIcon.classList.add('cloud-mode');
                        this.statusIcon.title = 'Cloud Mode (Online)';
                    } else {
                        this.statusIcon.classList.remove('cloud-mode');
                        this.statusIcon.classList.add('local-mode');
                        this.statusIcon.title = 'Local Mode (Offline)';
                    }
                }
            } catch (err) {
                // If backend is unreachable, assume local/offline or disconnected
                this.statusIcon.classList.remove('cloud-mode');
                this.statusIcon.classList.add('local-mode');
                this.statusIcon.title = 'Disconnected';
            }
        };

        // Initial check
        fetchStatus();
        // Poll every 5 seconds
        setInterval(fetchStatus, 5000);
    }
};

document.addEventListener('DOMContentLoaded', () => Andromeda.init());
