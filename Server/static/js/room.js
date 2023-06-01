// Create socket connection
var socketio = io();

// HTML Elements
const error = document.getElementById("error");
const messages = document.getElementById("messages");
const membersPopup = document.getElementById("members-popup");

let roomPassword;

// generate qr code
new QRCode(
  document.getElementById("qr-image"),
  `${window.location.origin}/join/${roomCode}`
);

// ---------------------------------------------------------------- //
// ---------------------------------------------------------------- //
// Item creators                                                    //
// ---------------------------------------------------------------- //
// ---------------------------------------------------------------- //

// Create HTML Elements from Data

const createMessageItem = (name, message, timestamp) => {
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
  messages.insertAdjacentHTML("beforeend", content);
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
        <p class="message-name">@${username}</p>
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
  messages.insertAdjacentHTML("beforeend", content);
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

const createLogItem = (content, timestamp) => {
  messages.insertAdjacentHTML(
    "beforeend",
    `<p>${content} - ${formatDate(new Date(timestamp))}</p>`
  );
};

const addMemberItem = (name) => {
  membersPopup.insertAdjacentHTML(
    "beforeend",
    `<p class="${name == userName ? "primary-color" : ""}">
    ${name}
  </p>`
  );
};

// ---------------------------------------------------------------- //
// ---------------------------------------------------------------- //
// Socket events                                                    //
// ---------------------------------------------------------------- //
// ---------------------------------------------------------------- //

// Updates members list when a new user joins
socketio.on("join", (members) => {
  membersPopup.innerHTML = "";
  members.forEach((member) => addMemberItem(member));
});

// Called when receiving a message -> Forwards decrypted message contents to the Item Creators when
socketio.on("message", (data) => {
  if (data.type == "text") {
    let message = data.data;
    if (roomType == "secured") {
      decrypted = CryptoJS.AES.decrypt(data.data, roomPassword);
      message = decrypted.toString(CryptoJS.enc.Utf8);
    }
    createMessageItem(data.name, message, data.timestamp);
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

// If first join -> saves room to localstorage
// Processes message history from backend
socketio.on("connect", (_) => {
  addRecentRoom(roomCode, targetDateString);
  const recentRooms = JSON.parse(localStorage.getItem("recent_rooms")) || {};
  if (recentRooms[roomCode].type == "secured") {
    roomPassword = recentRooms[roomCode].password;
    document.getElementById(
      "room-password-text"
    ).innerText += ` ${roomPassword}`;
  }
  for (let message of messagesFromBackend) {
    if (message.type == "message") {
      let content = message.content;
      if (roomType == "secured") {
        decrypted = CryptoJS.AES.decrypt(message.content, roomPassword);
        content = decrypted.toString(CryptoJS.enc.Utf8);
      }
      createMessageItem(message.author, content, message.timestamp);
    } else if (message.type == "file") {
      createFileItem(
        message.author,
        message.fileName,
        message.timestamp,
        message.fileId,
        message.fileSize
      );
    } else if (message.type == "log") {
      createLogItem(message.content, message.timestamp);
    }
  }
});

socketio.on("log", (data) => {
  createLogItem(data.log, data.timestamp);
});

// ---------------------------------------------------------------- //
// ---------------------------------------------------------------- //
// Sending Message                                                  //
// ---------------------------------------------------------------- //
// ---------------------------------------------------------------- //

const messageSendCallback = () => {
  messageInputContainer.classList.remove("message-sending");
  messageInputContainer.classList.add("message-sent");
  setTimeout(() => {
    messageInputContainer.classList.remove("message-sent");
  }, 800);
};

const sendMessage = (event) => {
  event.preventDefault();
  if (fileInput.files.length > 0) {
    messageInputContainer.classList.add("message-sending");
    const file = fileInput.files[0];
    if (roomType == "secured") {
      var reader = new FileReader();
      reader.readAsBinaryString(file);
      reader.onload = function (evt) {
        const encrypted = CryptoJS.AES.encrypt(
          evt.target.result,
          roomPassword
        ).toString();
        socketio.emit(
          "message",
          {
            data: encrypted.toString(),
            type: "file",
            fileType: file.type,
            fileName: file.name,
            fileSize: file.size,
          },
          messageSendCallback
        );
      };
    } else {
      socketio.emit(
        "message",
        {
          data: file,
          type: "file",
          fileType: file.type,
          fileName: file.name,
          fileSize: file.size,
        },
        messageSendCallback
      );
    }
    fileInput.value = "";
    fileInput.type = "";
    fileInput.type = "file";
    filePreview.classList.add("dp-none");
    messageInput.classList.remove("dp-none");
  } else {
    const message = document.getElementById("message");
    if (message.value == "") return;
    messageInputContainer.classList.add("message-sending");
    let data = message.value;
    if (roomType == "secured") {
      data = CryptoJS.AES.encrypt(message.value, roomPassword).toString();
    }
    socketio.emit(
      "message",
      {
        data: data,
        type: "text",
      },
      messageSendCallback
    );
  }
  message.value = "";
  message.blur();
};

// ---------------------------------------------------------------- //
// ---------------------------------------------------------------- //
// Input listeners                                                  //
// ---------------------------------------------------------------- //
// ---------------------------------------------------------------- //
const chat = document.getElementById("chat");
const fileDragOverlay = document.getElementById("file-drag-overlay");
const fileDragInput = document.getElementById("drag-file-input");

const fileInput = document.getElementById("file-select");
const form = document.getElementById("message-form");

const messageInput = document.getElementById("message");
const messageInputContainer = document.getElementById(
  "message-input-container"
);

const filePreview = document.getElementById("file-preview");
const filePreviewText = document.getElementById("file-preview-text");

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
  if (fileSizeMB > maxUpload) {
    displayError("Cannot upload files larger than 50mb");
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

fileInput.addEventListener("change", (_) => {
  var files = fileInput.files;
  var fileSizeMB = files[0].size / 1024 ** 2;
  if (fileSizeMB > maxUpload) {
    displayError("Cannot upload files larger than 50mb");
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

const onClose = () => {
  location.replace("/");
};

// ---------------------------------------------------------------- //
// ---------------------------------------------------------------- //
// Utils                                                            //
// ---------------------------------------------------------------- //
// ---------------------------------------------------------------- //

const createLoader = (fileName) => {
  const loaderContainer = document.createElement("div");
  loaderContainer.classList.add("loader-container");

  const loader = document.createElement("div");
  loader.classList.add("loader");

  const text = document.createElement("p");
  text.innerText = "Downloading";

  const nameText = document.createElement("span");
  nameText.innerText = fileName;

  loaderContainer.append(text);
  loaderContainer.append(nameText);
  loaderContainer.append(loader);

  document.body.append(loaderContainer);

  return () => {
    loaderContainer.style.animation = "loader-remove 0.2s ease-in-out forwards";
    setTimeout(() => {
      loaderContainer.remove();
    }, 300);
  };
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

const errorList = document.getElementById("error-list");

const displayError = (message) => {
  let error = document.createElement("div");
  error.classList.add("error");
  error.innerText = message;
  errorList.appendChild(error);
  setTimeout(() => {
    error.remove();
  }, 4000);
};

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

const truncate = (str, n) => {
  return str.length > n ? str.slice(0, n - 1) + "&hellip;" : str;
};

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

const clearFileInput = () => {
  fileInput.value = "";
  fileInput.type = "";
  fileInput.type = "file";
  filePreview.classList.add("dp-none");
  messageInput.classList.remove("dp-none");
};

async function downloadFile(url, fileName) {
  try {
    // Create Loading state
    const removeLoader = createLoader(fileName);

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

    // Close Loading state
    setTimeout(() => {
      document.body.removeChild(downloadLink);
      removeLoader();
    }, 100);
  } catch (error) {
    console.error("Error downloading the file:", error.message);
  }
}
