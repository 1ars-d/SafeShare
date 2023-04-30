const passwordForm = document.getElementById("password-form");
const passwordInput = document.getElementById("password-input");

passwordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (passwordInput.value == "") {
    return;
  }
  window.location.replace(
    `/join-secured/${room}/${name}/${user_id}/${passwordInput.value}`
  );
});
