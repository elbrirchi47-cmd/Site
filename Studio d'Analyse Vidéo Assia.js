<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Analyse Vidéo en Direct — Assia.js Studio</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #161f30;
      --accent: #00e5ff;
      --text: #e2e8f0;
      --muted: #64748b;
    }

    body {
      font-family: system-ui, -apple-system, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 20px;
    }

    .dashboard {
      max-width: 1200px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 20px;
    }

    .card {
      background: var(--card-bg);
      padding: 20px;
      border-radius: 12px;
      border: 1px solid #1e293b;
    }

    .full-width {
      grid-column: 1 / -1;
    }

    /* Conteneur Superposition Vidéo & Analyse Canvas */
    .video-container {
      position: relative;
      width: 100%;
      background: #000;
      border-radius: 8px;
      overflow: hidden;
      aspect-ratio: 16 / 9;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    video {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    .controls {
      display: flex;
      gap: 10px;
      margin-top: 15px;
      flex-wrap: wrap;
    }

    button, label.btn-upload {
      background: var(--accent);
      color: #000;
      border: none;
      padding: 10px 18px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 700;
      display: inline-block;
    }

    input[type="file"] {
      display: none;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .metric-card {
      background: #0f172a;
      padding: 12px 16px;
      border-radius: 8px;
      border-left: 4px solid var(--accent);
    }

    .metric-label {
      font-size: 0.8em;
      color: var(--muted);
      text-transform: uppercase;
    }

    .metric-value {
      font-size: 1.4em;
      font-weight: bold;
      color: #fff;
    }

    textarea {
      width: 100%;
      height: 140px;
      background: #0b0f19;
      color: #38bdf8;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 10px;
      font-family: monospace;
      box-sizing: border-box;
    }
  </style>
  <script src="Assia.js"></script>
</head>
<body>

  <div class="dashboard">

    <!-- En-tête / Contrôles principaux -->
    <div class="card full-width">
      <h2>Studio d'Analyse Vidéo Assia.js</h2>
      <div class="controls">
        <label class="btn-upload">
          📁 Joindre une vidéo
          <input type="file" id="videoFileInput" accept="video/*">
        </label>
        <button id="btnWebcam">📹 Activer le Live Webcam</button>
        <button id="btnStart">▶️ Lancer l'analyse</button>
        <button id="btnStop" style="background:#ef4444; color:#fff;">⏹️ Arrêter</button>
      </div>
    </div>

    <!-- ZONE VIDEO + ANALYSE SUPERPOSÉE EN DIRECT -->
    <div class="card">
      <h3>Lecteur & Overlay en Direct</h3>
      <div class="video-container">
        <video id="mainVideo" autoplay playsinline muted controls></video>
        <canvas id="overlayCanvas"></canvas>
      </div>
    </div>

    <!-- VARIABLES & MÉTRIQUES DE L'ANALYSE EN TEMPS RÉEL -->
    <div class="card">
      <h3>Variables d'Analyse</h3>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Objets / Cibles détectées</div>
          <div class="metric-value" id="varObjects">0</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Indice de Confiance</div>
          <div class="metric-value" id="varConfidence">0%</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Fréquence (FPS)</div>
          <div class="metric-value" id="varFps">0</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">État de l'analyse</div>
          <div class="metric-value" id="varStatus">Inactif</div>
        </div>
      </div>
    </div>

    <!-- RAPPORT FINAL ET TÉLÉCHARGEMENT -->
    <div class="card full-width">
      <h3>Rapport d'Analyse & Téléchargements</h3>
      <textarea id="reportOutput" readonly placeholder="Le rapport généré apparaîtra ici..."></textarea>
      <div class="controls">
        <button id="btnDownloadReport">📄 Télécharger le Rapport (JSON)</button>
        <button id="btnDownloadVideo">🎥 Télécharger la Vidéo d'Analyse</button>
      </div>
    </div>

  </div>

  <script>
    // Variables de suivi et d'état
    let isAnalyzing = false;
    let animFrameId = null;
    let mediaRecorder = null;
    let recordedChunks = [];
    
    // Éléments du DOM
    const video = document.getElementById('mainVideo');
    const canvas = document.getElementById('overlayCanvas');
    const ctx = canvas.getContext('2d');
    const fileInput = document.getElementById('videoFileInput');

    // Mettre à jour la taille du Canvas sur la vidéo
    function adjustCanvasSize() {
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
    }
    video.addEventListener('loadedmetadata', adjustCanvasSize);
    window.addEventListener('resize', adjustCanvasSize);

    // Chargement d'une vidéo locale
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        video.srcObject = null;
        video.src = URL.createObjectURL(file);
        video.play();
      }
    });

    // Flux Webcam Live
    document.getElementById('btnWebcam').addEventListener('click', async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        video.src = '';
        video.srcObject = stream;
        video.play();
        initRecorder(stream);
      } catch (err) {
        alert("Impossible d'accéder à la webcam : " + err.message);
      }
    });

    // Enregistreur vidéo (pour téléchargement)
    function initRecorder(stream) {
      recordedChunks = [];
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };
    }

    // Boucle d'Analyse en Direct (superposition Canvas + Variables)
    function runAnalysisLoop() {
      if (!isAnalyzing) return;

      adjustCanvasSize();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Variables mises à jour dynamique
      const simulatedData = {
        objects: Math.floor(Math.random() * 4) + 1,
        confidence: (Math.random() * 15 + 85).toFixed(1),
        fps: Math.floor(Math.random() * 5 + 27),
        x: Math.random() * (canvas.width - 120),
        y: Math.random() * (canvas.height - 120),
        w: 120,
        h: 120
      };

      // Mettre à jour les variables à l'écran
      document.getElementById('varObjects').innerText = simulatedData.objects;
      document.getElementById('varConfidence').innerText = simulatedData.confidence + '%';
      document.getElementById('varFps').innerText = simulatedData.fps;
      document.getElementById('varStatus').innerText = 'En cours';

      // Dessin du cadre d'analyse superposé à la vidéo
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 3;
      ctx.strokeRect(simulatedData.x, simulatedData.y, simulatedData.w, simulatedData.h);
      ctx.fillStyle = '#00e5ff';
      ctx.font = '14px sans-serif';
      ctx.fillText(`Assia.js: ${simulatedData.confidence}%`, simulatedData.x, simulatedData.y - 6);

      animFrameId = requestAnimationFrame(runAnalysisLoop);
    }

    // Démarrage de l'analyse
    document.getElementById('btnStart').addEventListener('click', () => {
      if (!video.src && !video.srcObject) {
        alert("Veuillez charger un fichier vidéo ou démarrer la webcam.");
        return;
      }
      isAnalyzing = true;
      if (mediaRecorder && mediaRecorder.state === 'inactive') mediaRecorder.start();
      runAnalysisLoop();
    });

    // Arrêt de l'analyse et construction du rapport
    document.getElementById('btnStop').addEventListener('click', () => {
      isAnalyzing = false;
      cancelAnimationFrame(animFrameId);
      document.getElementById('varStatus').innerText = 'Terminé';

      if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();

      // Génération du rapport final
      const reportData = {
        horodatage: new Date().toISOString(),
        statut: "Analyse terminée",
        donneesAnalyse: {
          derniersObjetsDetectes: document.getElementById('varObjects').innerText,
          scoreConfianceMoyen: document.getElementById('varConfidence').innerText,
          fpsMoyen: document.getElementById('varFps').innerText
        }
      };

      document.getElementById('reportOutput').value = JSON.stringify(reportData, null, 2);
    });

    // Télécharger le rapport JSON
    document.getElementById('btnDownloadReport').addEventListener('click', () => {
      const content = document.getElementById('reportOutput').value;
      if (!content) return alert("Aucun rapport à télécharger.");
      
      const blob = new Blob([content], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `rapport_assia_${Date.now()}.json`;
      a.click();
    });

    // Télécharger la vidéo de la session
    document.getElementById('btnDownloadVideo').addEventListener('click', () => {
      if (recordedChunks.length === 0) return alert("Aucun flux vidéo enregistré.");
      
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `session_video_${Date.now()}.webm`;
      a.click();
    });
  </script>
</body>
</html>
