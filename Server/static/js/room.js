var socketio = io();

const chat = document.getElementById("chat");
const fileDragOverlay = document.getElementById("file-drag-overlay");
const fileDragInput = document.getElementById("drag-file-input");

const error = document.getElementById("error");

const messages = document.getElementById("messages");
const membersButton = document.getElementById("btn-members");
const membersPopup = document.getElementById("members-popup");
const fileInput = document.getElementById("file-select");
const form = document.getElementById("message-form");

const messageInput = document.getElementById("message");
const filePreview = document.getElementById("file-preview");
const filePreviewText = document.getElementById("file-preview-text");
const qrImageContainer = document.getElementById("qr-image");
const roomPasswordText = document.getElementById("room-password-text");

let roomPassword;

// create qr code
new QRCode(qrImageContainer, `${window.location.origin}/join/${roomCode}`);

fileInput.addEventListener("change", (_) => {
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

let startDate = new Date(startDateString);

const setCountdown = () => {
  currentDate = startDate;
  const timeRemaining = targetDate.getTime() - currentDate.getTime();
  const minutes = Math.max(
    0,
    Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))
  );
  const seconds = Math.max(0, Math.floor((timeRemaining % (1000 * 60)) / 1000));

  // Check if room is expired
  if (closeRoom == "True" && minutes == 0 && seconds == 0) {
    window.location.replace("/");
  }
  countdown.innerHTML = `${minutes.toLocaleString(undefined, {
    minimumIntegerDigits: 2,
  })}:${seconds.toLocaleString(undefined, {
    minimumIntegerDigits: 2,
  })}`;
};

setCountdown();
setInterval(() => startDate.setSeconds(currentDate.getSeconds() + 1), 1000);
setInterval(setCountdown, 1000);

const createMessage = (name, message, timestamp) => {
  const date = formatDate(new Date(timestamp));
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

const createFileItem = (
  username,
  fileName,
  timestamp,
  downloadId,
  fileSize // in bytes
) => {
  const date = formatDate(new Date(timestamp));
  const content = `
    <div class="message-item ${
      userName == username ? "message-item-self" : ""
    }">
      <div class="message-info">
        <p class="message-name">${username}</p>
        <p class="message-time">${date}</p>
      </div>
      <div class="file-container">
        <div class="file-download" id="file-${downloadId}"><svg xmlns="http://www.w3.org/2000/svg"  viewBox="0 0 30 30" width="30px" height="30px" fill="${
    username == userName ? "white" : "#4285f4"
  }">    <path d="M24.707,8.793l-6.5-6.5C18.019,2.105,17.765,2,17.5,2H7C5.895,2,5,2.895,5,4v22c0,1.105,0.895,2,2,2h16c1.105,0,2-0.895,2-2 V9.5C25,9.235,24.895,8.981,24.707,8.793z M18,10c-0.552,0-1-0.448-1-1V3.904L23.096,10H18z"/></svg><p>${fileName}</p><div class="btn-file-download"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="${
    username == userName ? "white" : "#4285f4"
  }" >
  <path d="M17 12v5H3v-5H1v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5z"/>
  <path d="M10 15l5-6h-4V1H9v8H5l5 6z"/>
  </svg><p>${formatBytes(fileSize)}</p></div></div>
      
      </div>
    </div>
    `;
  messages.innerHTML += content;
  messages.scrollTop = messages.scrollHeight;
  document
    .getElementById(`file-${downloadId}`)
    .addEventListener("click", (_) => {
      downloadFile(
        `file/${downloadId}/${roomType == "secured" ? "encrypted" : "open"}`,
        fileName
      );
    });
};

function formatBytes(bytes) {
  if (bytes < 1024) {
    return bytes + " bytes";
  } else if (bytes < 1048576) {
    return (bytes / 1024).toFixed(2) + " KB";
  } else if (bytes < 1073741824) {
    return (bytes / 1048576).toFixed(2) + " MB";
  } else {
    return (bytes / 1073741824).toFixed(2) + " GB";
  }
}

const formatDate = (date) => {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();

  const formattedDate = `${day}. ${month} ${year}`;
  const formattedTime = `${hours}:${minutes < 10 ? "0" + minutes : minutes}`;

  return `${formattedTime} ${formattedDate}`;
};

socketio.on("message", (data) => {
  if (data.type == "text") {
    let message = data.data;
    if (roomType == "secured") {
      decrypted = CryptoJS.AES.decrypt(data.data, roomPassword);
      message = decrypted.toString(CryptoJS.enc.Utf8);
    }
    createMessage(data.name, message, data.timestamp);
  } else if (data.type == "file") {
    createFileItem(
      data.name,
      data.fileName,
      data.timestamp,
      data.fileId,
      data.fileSize
    );
  }
});

socketio.on("connect", (_) => {
  addRecentRoom(roomCode, targetDateString);
  const recentRooms = JSON.parse(localStorage.getItem("recent_rooms")) || {};
  if (recentRooms[roomCode].type == "secured") {
    roomPassword = recentRooms[roomCode].password;
    roomPasswordText.innerText = roomPassword;
  }
  for (let message of messagesFromBackend) {
    if (message.type == "message") {
      let content = message.content;
      if (roomType == "secured") {
        decrypted = CryptoJS.AES.decrypt(message.content, roomPassword);
        content = decrypted.toString(CryptoJS.enc.Utf8);
      }
      createMessage(message.author, content, message.timestamp);
    } else if (message.type == "file") {
      createFileItem(
        message.author,
        message.fileName,
        message.timestamp,
        message.fileId,
        message.fileSize
      );
    }
  }
});

const addRecentRoom = (code, timestampString) => {
  const recentRooms = JSON.parse(localStorage.getItem("recent_rooms")) || {};
  const lastTypedPassword = localStorage.getItem("last_typed_password");
  if (!recentRooms[code]) {
    recentRooms[code] = {
      username: userName,
      userId: userId,
      timestamp: timestampString,
      type: roomType,
      password: lastTypedPassword,
      closeTime: closeTime,
    };
    localStorage.setItem("recent_rooms", JSON.stringify(recentRooms));
  }
  localStorage.removeItem("last_typed_password");
};

const createLogItem = (content, timestamp) => {
  messages.innerHTML += `<p>${content} - ${formatDate(
    new Date(timestamp)
  )}</p>`;
};

socketio.on("log", (data) => {
  createLogItem(data.log, data.timestamp);
});

const sendMessage = (event) => {
  event.preventDefault();
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    if (roomType == "secured") {
      var reader = new FileReader();
      reader.readAsBinaryString(file);
      reader.onload = function (evt) {
        const encrypted = CryptoJS.AES.encrypt(
          evt.target.result,
          roomPassword
        ).toString();
        socketio.emit("message", {
          data: encrypted.toString(),
          type: "file",
          fileType: file.type,
          fileName: file.name,
          fileSize: file.size,
        });
      };
    } else {
      socketio.emit("message", {
        data: file,
        type: "file",
        fileType: file.type,
        fileName: file.name,
        fileSize: file.size,
      });
    }
    fileInput.value = "";
    fileInput.type = "";
    fileInput.type = "file";
    filePreview.classList.add("dp-none");
    messageInput.classList.remove("dp-none");
  } else {
    const message = document.getElementById("message");
    if (message.value == "") return;
    let data = message.value;
    if (roomType == "secured") {
      data = CryptoJS.AES.encrypt(message.value, roomPassword).toString();
    }
    socketio.emit("message", {
      data: data,
      type: "text",
    });
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

async function downloadFile(url) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    let base64String = data.file;
    if (roomType == "secured") {
      const decrypted = CryptoJS.AES.decrypt(data.file, roomPassword);
      base64String = btoa(decrypted.toString(CryptoJS.enc.Utf8));
    }
    const downloadLink = document.createElement("a");
    downloadLink.href = `data:${data["content-type"]};base64,${base64String}`;
    downloadLink.download = data.fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    setTimeout(() => {
      document.body.removeChild(downloadLink);
    }, 100);
  } catch (error) {
    console.error("Error downloading the file:", error.message);
  }
}
