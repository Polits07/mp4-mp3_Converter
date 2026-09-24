(function(){
  const drop = document.getElementById('drop');
  const fileInput = document.getElementById('fileInput');
  const afterPick = document.getElementById('afterPick');
  const fileName = document.getElementById('fileName');
  const fileSize = document.getElementById('fileSize');
  const changeBtn = document.getElementById('changeBtn');
  const convertBtn = document.getElementById('convertBtn');
  const pills = document.querySelectorAll('.pill');
  const progressWrap = document.getElementById('progressWrap');
  const progressText = document.getElementById('progressText');
  const progressPct = document.getElementById('progressPct');
  const barFill = document.getElementById('barFill');
  const result = document.getElementById('result');
  const downloadLink = document.getElementById('downloadLink');
  const errorBox = document.getElementById('errorBox');

  const adModal = document.getElementById('adModal');
  const adContinueBtn = document.getElementById('adContinueBtn');
  const adModalClose = document.getElementById('adModalClose');

  let currentFile = null;
  let selectedBitrate = '192k';
  let ffmpeg = null;

  pills.forEach(p => {
    p.addEventListener('click', () => {
      pills.forEach(x => x.classList.remove('active'));
      p.classList.add('active');
      selectedBitrate = p.dataset.value;
    });
  });

  function fmtSize(bytes){
    if(bytes < 1024*1024) return (bytes/1024).toFixed(0) + ' KB';
    return (bytes/(1024*1024)).toFixed(1) + ' MB';
  }

  function showFile(file){
    currentFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = fmtSize(file.size);
    afterPick.style.display = 'block';
    result.style.display = 'none';
    errorBox.style.display = 'none';
    progressWrap.style.display = 'none';
  }

  drop.addEventListener('click', () => fileInput.click());
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('hover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('hover'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('hover');
    if(e.dataTransfer.files.length) showFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', e => {
    if(e.target.files.length) showFile(e.target.files[0]);
  });
  changeBtn.addEventListener('click', () => fileInput.click());

  // Clicking Convert opens the ad modal first. The Continue button (clickable
  // immediately, no forced delay — see the AdSense/Better Ads note in the
  // conversation this was built from) is what actually starts the conversion.
  convertBtn.addEventListener('click', () => {
    if(!currentFile) return;
    adModal.style.display = 'flex';
  });

  function closeAdModal(){
    adModal.style.display = 'none';
  }

  adModalClose.addEventListener('click', closeAdModal);
  adContinueBtn.addEventListener('click', () => {
    closeAdModal();
    runConversion();
  });
  // Clicking the dimmed backdrop also continues, same as pressing Continue —
  // avoids a dead end if someone taps outside the card.
  adModal.addEventListener('click', (e) => {
    if(e.target === adModal){
      closeAdModal();
      runConversion();
    }
  });

  async function runConversion(){
    errorBox.style.display = 'none';
    result.style.display = 'none';
    progressWrap.style.display = 'block';
    convertBtn.disabled = true;
    barFill.style.width = '0%';
    progressPct.textContent = '0%';
    progressText.textContent = 'Loading converter…';

    try{
      const { createFFmpeg, fetchFile } = FFmpeg;
      if(!ffmpeg){
        ffmpeg = createFFmpeg({
          log: false,
          corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
          progress: ({ ratio }) => {
            if(ratio >= 0 && ratio <= 1){
              const pct = Math.round(ratio*100);
              barFill.style.width = pct + '%';
              progressPct.textContent = pct + '%';
              progressText.textContent = 'Converting…';
            }
          }
        });
      }
      if(!ffmpeg.isLoaded()){
        await ffmpeg.load();
      }

      progressText.textContent = 'Reading file…';
      const inputName = 'input' + (currentFile.name.match(/\.[^.]+$/)?.[0] || '.mp4');
      ffmpeg.FS('writeFile', inputName, await fetchFile(currentFile));

      progressText.textContent = 'Converting…';
      await ffmpeg.run('-i', inputName, '-vn', '-ar', '44100', '-ac', '2', '-b:a', selectedBitrate, 'output.mp3');

      const data = ffmpeg.FS('readFile', 'output.mp3');
      const blob = new Blob([data.buffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      const outName = currentFile.name.replace(/\.[^.]+$/, '') + '.mp3';
      downloadLink.href = url;
      downloadLink.download = outName;

      barFill.style.width = '100%';
      progressPct.textContent = '100%';
      progressWrap.style.display = 'none';
      result.style.display = 'block';

      try{ ffmpeg.FS('unlink', inputName); ffmpeg.FS('unlink', 'output.mp3'); }catch(e){}

    }catch(err){
      console.error(err);
      progressWrap.style.display = 'none';
      const isFileProtocol = location.protocol === 'file:';
      let msg = 'Something went wrong converting this file. ';
      if(isFileProtocol){
        msg += 'This page is open as a local file (file://) — the converter needs to run from a real web server. Try running a local server (e.g. "npx serve ." in this folder, or "python3 -m http.server") and opening it via http://localhost, or deploy it to Vercel/GitHub Pages and test there.';
      } else {
        msg += 'Details: ' + (err && err.message ? err.message : String(err));
      }
      errorBox.textContent = msg;
      errorBox.style.display = 'block';
    }finally{
      convertBtn.disabled = false;
    }
  }
})();