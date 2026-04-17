/**
 * Andromeda Studio 2026 - Phase 01 Engine
 * Focused strictly on Remove.bg API Background Removal
 */

const Andromeda = {
    init() {
        this.cacheDOM();
        this.bindEvents();
        console.log("Andromeda Phase 01: Initialized.");
    },

    cacheDOM() {
        this.uploadInput = document.getElementById('image-upload');
        this.processBtn = document.getElementById('process-btn');
        this.mainCanvas = document.getElementById('main-preview');
        this.statusText = document.getElementById('canvas-overlay');
        this.downloadBtn = document.getElementById('download-btn');
    },

    bindEvents() {
        this.processBtn.addEventListener('click', () => this.handleProcess());
    },

    async handleProcess() {
        const file = this.uploadInput.files[0];
        if (!file) return alert("Please select an image.");

        this.setLoading(true, "Initial Loading (API Processing)...");

        const formData = new FormData();
        formData.append('file', file);

        try {
            // Note: Sending to our local 8080 server
            const response = await fetch('http://localhost:8080/remove-bg', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error("Processing Error. Check terminal for RAM limits.");

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            this.mainCanvas.src = url;
            this.downloadBtn.href = url;
            this.downloadBtn.style.display = 'inline-flex';
            this.setLoading(false);
        } catch (err) {
            console.error(err);
            this.setLoading(true, "Error: Check 8GB RAM limit in terminal.");
        }
    },

    setLoading(isLoading, message = "Processing...") {
        this.statusText.innerText = isLoading ? message : "";
        this.processBtn.disabled = isLoading;
        this.processBtn.innerText = isLoading ? "Processing..." : "Run Remove-Bg API";
    }
};

document.addEventListener('DOMContentLoaded', () => Andromeda.init());