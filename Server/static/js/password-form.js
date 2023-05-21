// Page called when user tries to enter secured room

const passwordForm = document.getElementById("password-form");
const passwordInput = document.getElementById("password-input");

passwordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (passwordInput.value == "") {
    return;
  }
  localStorage.setItem("last_typed_password", passwordInput.value);
  window.location.replace(
    `/join-secured/${room}/${name}/${user_id}/${passwordInput.value}`
  );
});
