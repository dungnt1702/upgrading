let speechEnabled = false;
document.addEventListener('click', () => { speechEnabled = true; }, { once: true });

function speak(text) {
  if (!speechEnabled) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'vi-VN';
  speechSynthesis.speak(utter);
}

function formatTime(seconds) {
  if (seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0');
}

let currentFilter = 'all';
let timers = {};
let vehicleData = {};
const vehicles = 22;
const db = firebase.database();

function setFilter(filter) {
  currentFilter = filter;
  localStorage.setItem('activeTab', filter);
  document.querySelectorAll('.tabs button').forEach(btn => btn.classList.remove('active'));
  document.getElementById('tab-' + filter).classList.add('active');
  renderVehicles();
}

function renderVehicles() {
  const container = document.getElementById('vehicle-list');
  container.innerHTML = '';
  for (let i = 1; i <= vehicles; i++) {
    const data = vehicleData[i] || {};
    if (currentFilter === 'active' && !data.active) continue;
    if (currentFilter === 'inactive' && data.active) continue;

    const secondsLeft = data.endAt ? Math.floor((data.endAt - Date.now()) / 1000) : 0;
    const div = document.createElement('div');
    div.className = 'vehicle';
    if (data.active === false) div.classList.add('inactive');
    if (secondsLeft <= 60 && secondsLeft > 0) div.classList.add('warning');
    if (secondsLeft <= 0 && data.endAt) div.classList.add('expired');
    if (data.paused) div.classList.add('paused');
    if (data.endAt && !data.paused) div.classList.add('running');

    div.innerHTML = `
  <h3>Xe ${i}</h3>
  <div class="timer" id="timer-${i}">${data.paused ? 'Tạm hoãn' : (data.endAt ? formatTime(secondsLeft) : '00:00')}</div>
  <div class="controls">
    <div class="controls-row">
      <button onclick="startTimer(${i}, 15)" class="highlight ${data.endAt ? 'btn-hidden' : ''}" id="btn15-${i}">Bắt đầu 15p</button>
      <button onclick="startTimer(${i}, 30)" class="highlight ${data.endAt ? 'btn-hidden' : ''}" id="btn30-${i}">Bắt đầu 30p</button>
    </div>
    <div class="controls-row">
      <button onclick="resetTimer(${i})">Reset</button>
      <button onclick="toggleVehicle(${i})" class="toggle-btn">${data.active === false ? 'Bật xe' : 'Tắt xe'}</button>
    </div>
    <div class="controls-row">
      <button onclick="pauseTimer(${i})" id="pause-${i}" class="${data.paused || !data.endAt ? 'btn-hidden' : ''}">Tạm hoãn</button>
      <button onclick="resumeTimer(${i})" id="resume-${i}" class="${!data.paused ? 'btn-hidden' : ''}">Tiếp tục</button>
    </div>
  </div>
`;

    container.appendChild(div);
  }
}

function toggleVehicle(id) {
  const active = !(vehicleData[id] && vehicleData[id].active === false);
  db.ref('timers/' + id).update({ active: !active });
}

function startTimer(id, minutes) {
  const endAt = Date.now() + minutes * 60000;
  db.ref('timers/' + id).set({ endAt, active: true, minutes, paused: false });
}

function pauseTimer(id) {
  db.ref('timers/' + id).once('value').then(snap => {
    const data = snap.val();
    if (data) {
      const remaining = Math.floor((data.endAt - Date.now()) / 1000);
      db.ref('timers/' + id).update({ paused: true, remaining });
    }
  });
}

function resumeTimer(id) {
  db.ref('timers/' + id).once('value').then(snap => {
    const data = snap.val();
    if (data && data.remaining) {
      const endAt = Date.now() + data.remaining * 1000;
      db.ref('timers/' + id).update({ paused: false, endAt, remaining: null });
    }
  });
}

function resetTimer(id) {
  db.ref('timers/' + id).update({ endAt: null, paused: false, remaining: null });
}

function syncData() {
  setInterval(() => {
    for (let i = 1; i <= vehicles; i++) {
      const data = vehicleData[i];
      if (!data || data.paused || !data.endAt) continue;
      const secondsLeft = Math.floor((data.endAt - Date.now()) / 1000);
      const display = document.getElementById(`timer-${i}`);
      if (!display) continue;

      if (secondsLeft === 300 && !data.warned5) {
        speak(`Xe số ${i} còn 5 phút`);
        db.ref('timers/' + i).update({ warned5: true });
      }
      if (secondsLeft === 60 && !data.warned1) {
        speak(`Xe số ${i} còn 1 phút`);
        db.ref('timers/' + i).update({ warned1: true });
      }

      if (secondsLeft <= 0) {
        display.textContent = 'Hết giờ';
        speak(`Xe số ${i} đã hết thời gian`);
      } else {
        display.textContent = formatTime(secondsLeft);
      }
    }
  }, 1000);

  for (let i = 1; i <= vehicles; i++) {
    db.ref('timers/' + i).on('value', snap => {
      vehicleData[i] = snap.val() || {};
      renderVehicles();
    });
  }
}

window.onload = () => {
  const savedFilter = localStorage.getItem('activeTab') || 'all';
  setFilter(savedFilter);
  syncData();
};
