// This page is called when a user joins via an invite link or qr-codes
const joinButton = document.getElementById("join");
const nameInput = document.getElementById("name");

joinButton.addEventListener("click", () => {
  if (nameInput.value == "") {
    return;
  }
  window.location.replace(`/join/${room}/${nameInput.value}/join`); // join is set to 'user_id' to specify where this request came from
});
