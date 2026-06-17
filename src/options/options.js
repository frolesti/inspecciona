const defaults = {
  variant: "general",
  autoOpenHelper: true
};

const statusEl = document.getElementById("status");
const saveButton = document.getElementById("save");

saveButton.addEventListener("click", save);
restore();

function restore() {
  chrome.storage.sync.get(defaults, (items) => {
    const variantInput = document.querySelector(`input[name="variant"][value="${items.variant}"]`);
    if (variantInput) {
      variantInput.checked = true;
    }
    document.getElementById("autoOpenHelper").checked = Boolean(items.autoOpenHelper);
  });
}

function save() {
  const variant = document.querySelector('input[name="variant"]:checked')?.value || defaults.variant;
  const autoOpenHelper = document.getElementById("autoOpenHelper").checked;

  chrome.storage.sync.set({ variant, autoOpenHelper }, () => {
    statusEl.textContent = "Opcions desades.";
    window.setTimeout(() => {
      statusEl.textContent = "";
    }, 1400);
  });
}