var socketio = io();

const chat = document.getElementById("chat");
const fileDragOverlay = document.getElementById("file-drag-overlay");
const fileDragInput = document.getElementById("drag-file-input");

const error = document.getElementById("error");

const membersButton = document.getElementById("btn-members");
const membersPopup = document.getElementById("members-popup");
const messages = document.getElementById("messages");
const fileInput = document.getElementById("file-select");
const form = document.getElementById("message-form");

const messageInput = document.getElementById("message");
const filePreview = document.getElementById("file-preview");
const filePreviewText = document.getElementById("file-preview-text");

// create qr code
new QRCode(
  document.getElementById("qr-image"),
  `${window.location.origin}/join/${roomCode}`
);

fileInput.addEventListener("change", (event) => {
  var files = fileInput.files;
  var fileSizeMB = files[0].size / 1024 ** 2;
  if (fileSizeMB > 50) {
    error.innerHTML = "Cannot upload files larger than 50mb";
    error.classList.remove("dp-none");
    fileInput.value = "";
    fileInput.type = "";
    fileInput.type = "file";
    return;
  }
  if (files.length) {
    filePreview.classList.remove("dp-none");
    messageInput.classList.add("dp-none");
    filePreviewText.innerHTML = truncate(files[0].name, 20);
  } else {
    filePreview.classList.add("dp-none");
    messageInput.classList.remove("dp-none");
  }
});

// Room Countdown
const targetDate = new Date(targetDateString);
targetDate.setMinutes(targetDate.getMinutes() + closeTime);
const countdown = document.getElementById("remaining-time");

const setCountdown = () => {
  const currentDate = new Date();
  const timeRemaining = targetDate.getTime() - currentDate.getTime();
  const minutes = Math.max(
    0,
    Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))
  );
  const seconds = Math.max(0, Math.floor((timeRemaining % (1000 * 60)) / 1000));

  // Check if room is expired
  /* if (minutes == 0 && seconds == 0) {
    window.location.replace("/");
  } */

  // display the countdown
  countdown.innerHTML = `${minutes.toLocaleString(undefined, {
    minimumIntegerDigits: 2,
  })}:${seconds.toLocaleString(undefined, {
    minimumIntegerDigits: 2,
  })}`;
};

setCountdown();
const chatTime = setInterval(setCountdown, 1000);

const createMessage = (name, message, timestamp) => {
  const date = new Date(timestamp).toDateString();
  const content = `
    <div class="message-item ${userName == name ? "message-item-self" : ""}">
      <div class="message-info">
        <p class="message-name">@${name}</p>
        <p class="message-time">${date}</p>
      </div>
      <p class="message-content">${message}</p>
    </div>
    `;
  messages.innerHTML += content;
  messages.scrollTop = messages.scrollHeight;
};

const getImageDimensions = (url) => {
  const img = new Image();
  img.src = url;
  return new Promise((resolve, reject) => {
    img.onload = () => {
      const { naturalWidth, naturalHeight } = img;
      resolve({ width: naturalWidth, height: naturalHeight });
    };
    img.onerror = () => {
      reject(new Error(`Failed to load image: ${url}`));
    };
  });
};

const createFileItem = (
  name,
  src,
  fileType,
  fileName,
  timestamp,
  download_id
) => {
  const date = new Date(timestamp).toDateString();
  let content;
  if (fileType.split("/")[0] == "image") {
    const availableWidth = messages.clientWidth;
    const availableHeight = messages.clientHeight;
    getImageDimensions(src).then(({ width, height }) => {
      console.log(width, height);
      let imgWidth = 0;
      let imgHeight = 0;
      if (width > height) {
        imgWidth = Math.min(availableWidth / 2, 350);
      } else {
        imgHeight = Math.min(availableHeight / 2, 150);
      }
      content = `
      <div class="message-item ${userName == name ? "message-item-self" : ""}">
        <div class="message-info">
          <p class="message-name">${name}</p>
          <p class="message-time">${date}</p>
        </div>
        <div class="file-container image-container">
          <a href="/file/${download_id}" style="padding: 0"><img src="${src}" alt="${fileName}" ${
        imgWidth > 0 ? `width="${imgWidth}"` : ""
      } ${imgHeight > 0 ? `width="${imgHeight}"` : ""} />
      <div class="btn-img-download">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="white">
  <path d="M17 12v5H3v-5H1v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5z"/>
  <path d="M10 15l5-6h-4V1H9v8H5l5 6z"/>
</svg><p>400 kB</p></div></a>
        </div>
      </div>
      `;
      messages.innerHTML += content;
      messages.scrollTop = messages.scrollHeight;
    });
  } else {
    content = `
      <div class="message-item ${userName == name ? "message-item-self" : ""}">
        <div class="message-info">
          <p class="message-name">${name}</p>
          <p class="message-time">${date}</p>
        </div>
        <div class="file-container">
          <a href="/file/${download_id}" class="file-download"><svg xmlns="http://www.w3.org/2000/svg"  viewBox="0 0 30 30" width="30px" height="30px" fill="${
      name == userName ? "white" : "#04be8c"
    }">    <path d="M24.707,8.793l-6.5-6.5C18.019,2.105,17.765,2,17.5,2H7C5.895,2,5,2.895,5,4v22c0,1.105,0.895,2,2,2h16c1.105,0,2-0.895,2-2 V9.5C25,9.235,24.895,8.981,24.707,8.793z M18,10c-0.552,0-1-0.448-1-1V3.904L23.096,10H18z"/></svg><p>${fileName}</p></a>
        </div>
      </div>
      `;
    messages.innerHTML += content;
    messages.scrollTop = messages.scrollHeight;
  }
};

const createLog = (log, timestamp) => {
  //const content = `<div class="log-item">${log} (${timestamp})</div>`;
  //messages.innerHTML += content;
};

socketio.on("message", (data) => {
  if (data.type == "text") {
    createMessage(data.name, data.data, data.timestamp);
  } else if (data.type == "file") {
    const blob = new Blob([data.data], { type: data.fileType });
    const objectURL = URL.createObjectURL(blob);
    createFileItem(
      data.name,
      objectURL,
      data.fileType,
      data.fileName,
      data.timestamp,
      data.fileId
    );
  }
});

socketio.on("connect", (_) => {
  addRecentRoom(roomCode, targetDateString);
});

const addRecentRoom = (code, timestampString) => {
  const recentRooms = JSON.parse(localStorage.getItem("recent_rooms")) || {};

  if (!recentRooms[code]) {
    recentRooms[code] = [userName, userId, timestampString];
    localStorage.setItem("recent_rooms", JSON.stringify(recentRooms));
  }
};

socketio.on("log", (data) => {
  createLog(data.log, data.timestamp);
});

const sendMessage = (event) => {
  event.preventDefault();
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    socketio.emit("message", {
      data: file,
      type: "file",
      fileType: file.type,
      fileName: file.name,
    });
    fileInput.value = "";
    fileInput.type = "";
    fileInput.type = "file";
    filePreview.classList.add("dp-none");
    messageInput.classList.remove("dp-none");
  } else {
    const message = document.getElementById("message");
    if (message.value == "") return;
    socketio.emit("message", { data: message.value, type: "text" });
  }
  message.value = "";
  message.blur();
};

const onClose = () => {
  window.location.replace("/");
};

form.addEventListener("submit", sendMessage);

chat.addEventListener("dragover", () => {
  fileDragOverlay.classList.remove("dp-none");
});

fileDragOverlay.addEventListener("dragleave", () => {
  fileDragOverlay.classList.add("dp-none");
});

fileDragInput.addEventListener("change", (_) => {
  fileDragOverlay.classList.add("dp-none");
  fileInput.files = fileDragInput.files;
  var files = fileInput.files;
  var fileSizeMB = files[0].size / 1024 ** 2;
  if (fileSizeMB > 50) {
    error.innerHTML = "Cannot upload files larger than 50mb";
    error.classList.remove("dp-none");
    fileInput.value = "";
    fileInput.type = "";
    fileInput.type = "file";
    return;
  }
  if (files.length) {
    filePreview.classList.remove("dp-none");
    messageInput.classList.add("dp-none");
    filePreviewText.innerHTML = files[0].name;
  } else {
    filePreview.classList.add("dp-none");
    messageInput.classList.remove("dp-none");
  }
});

const clearFileInput = () => {
  fileInput.value = "";
  fileInput.type = "";
  fileInput.type = "file";
  filePreview.classList.add("dp-none");
  messageInput.classList.remove("dp-none");
};

const truncate = (str, n) => {
  return str.length > n ? str.slice(0, n - 1) + "&hellip;" : str;
};

const addMemberItem = (name) => {
  membersPopup.innerHTML += `<p class="${
    name == userName ? "primary-color" : ""
  }">
    ${name}
  </p>`;
};

membersButton.addEventListener("click", () => {
  membersPopup.classList.toggle("dp-none");
});
