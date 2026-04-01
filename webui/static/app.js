async function fetchJSON(url, options) {
  const r = await fetch(url, options);
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  return r.json();
}

function $(id) {
  return document.getElementById(id);
}

function setTab(name) {
  document.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === name);
  });
  document.querySelectorAll("pre.out").forEach((p) => {
    p.classList.toggle("active", p.id === `out-${name}`);
  });
}

document.querySelectorAll(".tab").forEach((b) => {
  b.addEventListener("click", () => setTab(b.dataset.tab));
});

async function refreshExamples() {
  const data = await fetchJSON("/api/examples");
  const ul = $("example-list");
  ul.innerHTML = "";
  (data.examples || []).forEach((ex, i) => {
    const li = document.createElement("li");
    const id = `ex-${i}`;
    li.innerHTML = `<label><input type="radio" name="ex" id="${id}" value="${ex.name}" ${i === 0 ? "checked" : ""}/> ${ex.name}</label>`;
    ul.appendChild(li);
  });
}

function selectedExampleName() {
  const el = document.querySelector('input[name="ex"]:checked');
  return el ? el.value : null;
}

$("btn-load-example").addEventListener("click", async () => {
  const name = selectedExampleName();
  if (!name) return;
  const bundle = await fetchJSON(`/api/examples/${encodeURIComponent(name)}`);
  $("ir-editor").value = JSON.stringify(bundle, null, 2);
});

$("btn-run").addEventListener("click", async () => {
  const status = $("status");
  status.textContent = "Running…";
  status.className = "status";
  let demoInputs = {};
  try {
    demoInputs = JSON.parse($("demo-inputs").value || "{}");
  } catch {
    status.textContent = "Demo inputs must be valid JSON.";
    status.className = "status bad";
    return;
  }
  let irBundle;
  try {
    irBundle = JSON.parse($("ir-editor").value);
  } catch (e) {
    status.textContent = "IR bundle JSON parse error.";
    status.className = "status bad";
    return;
  }
  try {
    const body = {
      ir_bundle: irBundle,
      demo_inputs: demoInputs,
      engine_mode: $("engine-mode").value,
    };
    const out = await fetchJSON("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    status.textContent = out.ir_valid
      ? "IR valid (structural + handoff). See semantic tab for verifier details."
      : "IR validation failed — see Validation tab.";
    status.className = out.ir_valid ? "status ok" : "status bad";

    $("out-validation").textContent = JSON.stringify(
      {
        ir_valid: out.ir_valid,
        validation_errors: out.validation_errors,
        handoff_errors: out.handoff_errors,
        fingerprint: out.fingerprint,
      },
      null,
      2
    );
    $("out-semantic").textContent = JSON.stringify(out.semantic, null, 2);
    $("out-engine").textContent = JSON.stringify(out.engine, null, 2);
    const arts = out.orchestrator.artifacts || [];
    const summary = arts.map((a) => ({
      target_language: a.target_language,
      purpose: a.purpose,
      files: (a.files || []).map((f) => ({
        filename: f.filename,
        content_preview: (f.content || "").slice(0, 400),
      })),
    }));
    $("out-artifacts").textContent = JSON.stringify(summary, null, 2);
    $("out-raw").textContent = JSON.stringify(out, null, 2);
    setTab("validation");
  } catch (e) {
    status.textContent = String(e.message || e);
    status.className = "status bad";
  }
});

refreshExamples().catch((e) => {
  $("status").textContent = String(e);
  $("status").className = "status bad";
});
