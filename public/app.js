const state = {
  mode: "today",
  pc: null,
  dc: null,
  stream: null,
  callId: null,
  transcript: [],
  assistantDraft: "",
  startedAt: null,
  report: null
};

const modeMeta = {
  today: {
    label: "Today: Weekend",
    status: "Tap Start and speak English with Lily.",
    opening: "Start the lesson now. First greet Emma, then ask: What do you usually do on Saturday?"
  },
  photo: {
    label: "Photo Talk",
    status: "Look at the picture, then tell Lily what you can see.",
    opening:
      "Start PET Speaking Part 2 practice. Ask Emma to describe the kitchen picture on screen. Speak slowly."
  },
  mock: {
    label: "Mini Mock",
    status: "Try a short PET speaking test with Lily.",
    opening:
      "Start a friendly mini PET speaking test. Begin with two personal questions, then guide Emma through the next parts."
  }
};

const els = {
  kidView: document.querySelector("#kidView"),
  parentView: document.querySelector("#parentView"),
  parentToggle: document.querySelector("#parentToggle"),
  backButton: document.querySelector("#backButton"),
  modeButtons: [...document.querySelectorAll(".mode-button")],
  topicLabel: document.querySelector("#topicLabel"),
  statusText: document.querySelector("#statusText"),
  photoCard: document.querySelector("#photoCard"),
  liveCaption: document.querySelector("#liveCaption"),
  transcriptList: document.querySelector("#transcriptList"),
  startButton: document.querySelector("#startButton"),
  finishButton: document.querySelector("#finishButton"),
  accessPanel: document.querySelector("#accessPanel"),
  accessInput: document.querySelector("#accessInput"),
  saveAccessButton: document.querySelector("#saveAccessButton"),
  coachPanel: document.querySelector(".coach-panel"),
  remoteAudio: document.querySelector("#remoteAudio"),
  feedbackPanel: document.querySelector("#feedbackPanel"),
  praiseText: document.querySelector("#praiseText"),
  bestSentence: document.querySelector("#bestSentence"),
  correctionText: document.querySelector("#correctionText"),
  newWords: document.querySelector("#newWords"),
  pinGate: document.querySelector("#pinGate"),
  pinInput: document.querySelector("#pinInput"),
  unlockButton: document.querySelector("#unlockButton"),
  reportContent: document.querySelector("#reportContent"),
  summaryZh: document.querySelector("#summaryZh"),
  scoreRows: document.querySelector("#scoreRows"),
  nextPracticeZh: document.querySelector("#nextPracticeZh"),
  parentTranscript: document.querySelector("#parentTranscript")
};

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => null);
}

els.modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (state.pc) return;
    state.mode = button.dataset.mode;
    els.modeButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderMode();
  });
});

els.startButton.addEventListener("click", startPractice);
els.finishButton.addEventListener("click", finishPractice);
els.saveAccessButton.addEventListener("click", saveAccessCode);
els.parentToggle.addEventListener("click", showParent);
els.backButton.addEventListener("click", showKid);
els.unlockButton.addEventListener("click", unlockParent);
els.pinInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") unlockParent();
});

renderMode();
renderSavedReport();
renderAccessState();

function getAccessCode() {
  return localStorage.getItem("petCoachAccessCode") || "";
}

function authHeaders(extra = {}) {
  const code = getAccessCode();
  return code ? { ...extra, "X-App-Access-Code": code } : extra;
}

function saveAccessCode() {
  const code = els.accessInput.value.trim();
  if (!code) return;
  localStorage.setItem("petCoachAccessCode", code);
  els.accessInput.value = "";
  els.accessPanel.classList.add("hidden");
  els.liveCaption.textContent = "Access code saved. Tap Start Speaking.";
}

function renderAccessState() {
  els.accessPanel.classList.toggle("hidden", Boolean(getAccessCode()));
}

function renderMode() {
  const meta = modeMeta[state.mode];
  els.topicLabel.textContent = meta.label;
  els.statusText.textContent = meta.status;
  els.photoCard.classList.toggle("hidden", state.mode !== "photo");
}

async function startPractice() {
  resetPractice();
  setBusy(true, "Asking for microphone access...");

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    state.pc = new RTCPeerConnection();
    state.dc = state.pc.createDataChannel("oai-events");
    state.startedAt = new Date().toISOString();

    state.pc.ontrack = (event) => {
      els.remoteAudio.srcObject = event.streams[0];
      els.remoteAudio.play().catch(() => null);
    };

    state.stream.getAudioTracks().forEach((track) => state.pc.addTrack(track, state.stream));
    wireDataChannel();

    const offer = await state.pc.createOffer();
    await state.pc.setLocalDescription(offer);

    setBusy(true, "Connecting to Lily...");
    const response = await fetch("/api/realtime/call", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ sdp: offer.sdp, mode: state.mode })
    });

    const payload = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem("petCoachAccessCode");
        renderAccessState();
      }
      throw new Error(payload.error || "Could not start the voice lesson.");
    }

    state.callId = payload.callId;
    await state.pc.setRemoteDescription({ type: "answer", sdp: payload.sdp });

    els.startButton.disabled = true;
    els.finishButton.disabled = false;
    els.statusText.textContent = "Lily is listening.";
    els.liveCaption.textContent = "Lily will start in a moment.";
  } catch (error) {
    await cleanupConnection();
    els.statusText.textContent = "I could not start the voice lesson.";
    els.liveCaption.textContent = error.message;
    setBusy(false);
  }
}

function wireDataChannel() {
  state.dc.addEventListener("open", () => {
    sendRealtimeEvent({
      type: "response.create",
      response: {
        instructions: modeMeta[state.mode].opening,
        modalities: ["audio"]
      }
    });
  });

  state.dc.addEventListener("message", (message) => {
    let event;
    try {
      event = JSON.parse(message.data);
    } catch {
      return;
    }
    handleRealtimeEvent(event);
  });
}

function handleRealtimeEvent(event) {
  if (event.type === "input_audio_buffer.speech_started") {
    els.statusText.textContent = "I hear you.";
    els.coachPanel.classList.remove("speaking");
  }

  if (event.type === "input_audio_buffer.speech_stopped") {
    els.statusText.textContent = "Nice. Lily is thinking...";
  }

  if (event.type === "conversation.item.input_audio_transcription.completed") {
    addTurn("child", event.transcript || "");
  }

  if (event.type === "response.output_audio_transcript.delta" || event.type === "response.audio_transcript.delta") {
    state.assistantDraft += event.delta || "";
    els.liveCaption.textContent = state.assistantDraft;
    els.statusText.textContent = "Lily is speaking.";
    els.coachPanel.classList.add("speaking");
  }

  if (event.type === "response.output_audio_transcript.done" || event.type === "response.audio_transcript.done") {
    const text = event.transcript || state.assistantDraft;
    if (text) addTurn("lily", text);
    state.assistantDraft = "";
    els.liveCaption.textContent = text || "Your turn.";
  }

  if (event.type === "response.done") {
    els.coachPanel.classList.remove("speaking");
    els.statusText.textContent = "Your turn.";
  }

  if (event.type === "error") {
    els.liveCaption.textContent = event.error?.message || "Something went wrong.";
  }
}

function sendRealtimeEvent(event) {
  if (state.dc?.readyState === "open") {
    state.dc.send(JSON.stringify(event));
  }
}

function addTurn(role, text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const last = state.transcript[state.transcript.length - 1];
  if (last?.role === role && last.text === trimmed) return;
  state.transcript.push({ role, text: trimmed, at: new Date().toISOString() });
  renderTranscript();
}

function renderTranscript() {
  els.transcriptList.innerHTML = "";
  for (const turn of state.transcript.slice(-8)) {
    const div = document.createElement("div");
    div.className = `turn ${turn.role === "child" ? "child" : "lily"}`;
    div.innerHTML = `<strong>${turn.role === "child" ? "Emma" : "Lily"}</strong><span></span>`;
    div.querySelector("span").textContent = turn.text;
    els.transcriptList.append(div);
  }
  els.transcriptList.scrollTop = els.transcriptList.scrollHeight;
}

async function finishPractice() {
  els.finishButton.disabled = true;
  els.statusText.textContent = "Making today’s feedback...";
  await cleanupConnection();

  const payload = {
    mode: state.mode,
    startedAt: state.startedAt,
    endedAt: new Date().toISOString(),
    transcript: state.transcript
  };

  let report;
  try {
    const response = await fetch("/api/report", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    report = data.report;
  } catch {
    report = null;
  }

  if (!report) {
    report = {
      childPraise: "Great job speaking today!",
      bestSentence: state.transcript.find((turn) => turn.role === "child")?.text || "I tried my best today.",
      correction: {
        original: "I like play tennis.",
        improved: "I like playing tennis.",
        reasonZh: "like 后面接动词时，通常用 -ing。"
      },
      newWords: ["usually", "weekend", "friend"],
      summaryZh: "今天完成了一次口语练习。",
      scores: { fluency: 3, vocabulary: 3, grammar: 3, pronunciation: 3, interaction: 3 },
      nextPracticeZh: "下次继续练习用 because 说原因。"
    };
  }

  state.report = report;
  payload.report = report;
  savePractice(payload);
  await fetch("/api/sessions", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload)
  }).catch(() => null);

  renderFeedback(report);
  renderParentReport(payload);
  setBusy(false);
  els.startButton.disabled = false;
  els.statusText.textContent = "Finished. You earned your stars.";
}

async function cleanupConnection() {
  if (state.callId) {
    fetch(`/api/realtime/call/${encodeURIComponent(state.callId)}`, { method: "POST" }).catch(() => null);
  }
  state.stream?.getTracks().forEach((track) => track.stop());
  state.dc?.close();
  state.pc?.close();
  state.stream = null;
  state.dc = null;
  state.pc = null;
  state.callId = null;
  els.coachPanel.classList.remove("speaking");
}

function resetPractice() {
  state.transcript = [];
  state.assistantDraft = "";
  state.report = null;
  els.transcriptList.innerHTML = "";
  els.liveCaption.textContent = "Lily will speak here.";
  els.feedbackPanel.classList.add("hidden");
}

function renderFeedback(report) {
  els.praiseText.textContent = report.childPraise;
  els.bestSentence.textContent = report.bestSentence;
  els.correctionText.textContent = `${report.correction.original} → ${report.correction.improved}`;
  els.newWords.textContent = report.newWords.join(", ");
  els.feedbackPanel.classList.remove("hidden");
}

function savePractice(payload) {
  const history = JSON.parse(localStorage.getItem("petCoachHistory") || "[]");
  history.unshift(payload);
  localStorage.setItem("petCoachHistory", JSON.stringify(history.slice(0, 30)));
}

function renderSavedReport() {
  const latest = JSON.parse(localStorage.getItem("petCoachHistory") || "[]")[0];
  if (latest) renderParentReport(latest);
}

function renderParentReport(session) {
  const report = session.report;
  if (!report) return;
  els.summaryZh.textContent = report.summaryZh;
  els.nextPracticeZh.textContent = report.nextPracticeZh;
  els.scoreRows.innerHTML = "";

  const labels = {
    fluency: "流利度",
    vocabulary: "词汇",
    grammar: "语法",
    pronunciation: "发音",
    interaction: "互动"
  };

  for (const [key, label] of Object.entries(labels)) {
    const value = report.scores[key] || 1;
    const row = document.createElement("div");
    row.className = "score-row";
    row.innerHTML = `<span>${label}</span><div class="bar"><span style="width:${value * 20}%"></span></div><strong>${value}</strong>`;
    els.scoreRows.append(row);
  }

  els.parentTranscript.innerHTML = "";
  for (const turn of session.transcript || []) {
    const div = document.createElement("div");
    div.className = `turn ${turn.role === "child" ? "child" : "lily"}`;
    div.innerHTML = `<strong>${turn.role === "child" ? "Emma" : "Lily"}</strong><span></span>`;
    div.querySelector("span").textContent = turn.text;
    els.parentTranscript.append(div);
  }
}

function showParent() {
  els.kidView.classList.add("hidden");
  els.parentView.classList.remove("hidden");
}

function showKid() {
  els.parentView.classList.add("hidden");
  els.kidView.classList.remove("hidden");
}

function unlockParent() {
  if (els.pinInput.value.trim() !== "2580") {
    els.pinInput.value = "";
    els.pinInput.placeholder = "Try again";
    return;
  }
  els.pinGate.classList.add("hidden");
  els.reportContent.classList.remove("hidden");
}

function setBusy(isBusy, text) {
  els.startButton.disabled = isBusy;
  if (text) els.statusText.textContent = text;
}
